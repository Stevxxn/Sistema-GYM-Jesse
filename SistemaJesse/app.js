const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session'); // Importamos la sesión aquí arriba
const app = express();

// --- CONFIGURACIÓN BÁSICA ---
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine', 'ejs');
app.set('views', './views'); // Busca las vistas en la carpeta views

// ---------------------------------------------------------
// PASO CRÍTICO: CONFIGURACIÓN DE SESIÓN (ANTES DE LAS RUTAS)
// ---------------------------------------------------------
app.use(session({
    secret: 'secreto_super_seguro_jesse', // Palabra clave para encriptar
    resave: false,
    saveUninitialized: false
}));

// ---------------------------------------------------------
// PASO CRÍTICO: MIDDLEWARE MÁGICO (ANTES DE LAS RUTAS)
// ---------------------------------------------------------
app.use((req, res, next) => {
    // Si existe la sesión, pasamos true. Si no, false.
    // Esto evita el error "esAdmin is not defined"
    res.locals.esAdmin = req.session.esAdmin || false; 
    next(); // ¡Sigue con las rutas!
});

// --- IMPORTAR MODELO ---
const Socio = require('./src/models/Socio');
const Usuario = require('./src/models/Usuario');

// --- CONEXIÓN A MONGO ATLAS ---
const connectionString = 'mongodb+srv://stevenbautista717:2571@cluster0.sq5crqv.mongodb.net/?appName=Cluster0';

mongoose.connect(connectionString)
    .then(async () => { // <--- Fíjate que agregué 'async' aquí
        console.log('✅ BD CONECTADA');

        // --- VERIFICAR SI EXISTE ALGÚN ADMIN ---
        const adminExiste = await Usuario.findOne({ usuario: 'admin' });
        if (!adminExiste) {
            const defaultAdmin = new Usuario({
                usuario: 'admin',
                password: '1234',
                nombre: 'Administrador Principal'
            });
            await defaultAdmin.save();
            console.log('👑 Admin por defecto creado (User: admin / Pass: 1234)');
        }
    })
    .catch(err => console.log('❌ ERROR BD:', err));

// --- RUTAS Y CONTROLADORES ---

// 1. PANTALLA PRINCIPAL (DASHBOARD)
app.get('/', async (req, res) => {
    try {
        // Traemos todos los socios de la nube
        const socios = await Socio.find().sort({ 'membresia.fechaFin': 1 });
        // Renderizamos index.ejs enviando los datos y mensaje vacío
        res.render('index', { socios: socios, mensaje: null, tipoAlerta: null });
    } catch (error) {
        console.log(error);
        res.send("Error al cargar socios");
    }
});

// 2. PANTALLA DE REGISTRO (🔒 AHORA PROTEGIDA)
app.get('/registrar', (req, res) => {
    // Si NO es admin, lo mandamos al login
    if (!req.session.esAdmin) return res.redirect('/login');
    
    res.render('registrar');
});

// 3. GUARDAR NUEVO SOCIO (🔒 AHORA PROTEGIDA)
app.post('/registrar', async (req, res) => {
    // Doble seguridad: Si intenta enviar datos sin ser admin, ¡fuera!
    if (!req.session.esAdmin) return res.redirect('/login');

    try {
        // Calculamos fecha de vencimiento (30 días por defecto)
        const fechaInicio = new Date();
        const fechaFin = new Date();
        fechaFin.setDate(fechaFin.getDate() + 30); 

        const nuevoSocio = new Socio({
            cedula: req.body.cedula,
            nombres: req.body.nombres,
            apellidos: req.body.apellidos,
            huella: req.body.huella,
            membresia: {
                tipo: req.body.plan,
                costo: req.body.costo,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin,
                activa: true
            }
        });

        await nuevoSocio.save();
        console.log('Socio guardado: ' + req.body.nombres);
        res.redirect('/'); 
    } catch (error) {
        console.log(error);
        res.send("Error al guardar: " + error.message);
    }
});

// 4. VALIDAR ACCESO (La Lógica del Torno)
app.post('/acceso', async (req, res) => {
    const cedulaIngresada = req.body.cedula;
    
    // Buscar socio en Mongo
    const socio = await Socio.findOne({ cedula: cedulaIngresada });
    const listaSocios = await Socio.find(); // Para volver a pintar la tabla

    if (!socio) {
        // CASO 1: NO EXISTE
        return res.render('index', { 
            socios: listaSocios, 
            mensaje: '⛔ SOCIO NO ENCONTRADO', 
            tipoAlerta: 'danger' 
        });
    }

    // CASO 2: EXISTE, PERO VEMOS SI PAGÓ
    const hoy = new Date();
    if (socio.membresia.fechaFin >= hoy) {
        // ACCESO CONCEDIDO
        // Guardamos la asistencia (push al array)
        socio.asistencias.push({ fecha: hoy, estado: 'Permitido' });
        await socio.save();

        return res.render('index', { 
            socios: listaSocios, 
            mensaje: `✅ BIENVENIDO/A ${socio.nombres.toUpperCase()}`, 
            tipoAlerta: 'success' 
        });
    } else {
        // ACCESO DENEGADO (Vencido)
        return res.render('index', { 
            socios: listaSocios, 
            mensaje: `⚠️ MEMBRESÍA VENCIDA EL ${socio.membresia.fechaFin.toLocaleDateString()}`, 
            tipoAlerta: 'warning' 
        });
    }
});

// --- RUTAS DE ADMINISTRACIÓN ---

// 1. Mostrar Login
app.get('/login', (req, res) => {
    res.render('login', { error: null });
});

// 2. Procesar Login (Usuario y Clave HARDCODED para el MVP)
app.post('/login', async (req, res) => {
    const { user, pass } = req.body;

    // Buscamos en MongoDB
    const usuarioEncontrado = await Usuario.findOne({ usuario: user, password: pass });

    if (usuarioEncontrado) {
        req.session.esAdmin = true;
        req.session.nombreUsuario = usuarioEncontrado.nombre; // Guardamos el nombre para saludar
        res.redirect('/admin');
    } else {
        res.render('login', { error: '❌ Usuario o contraseña incorrectos' });
    }
});

// 3. Panel de Administración (PROTEGIDO)
app.get('/admin', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    // Hacemos dos consultas a la vez: Socios y Usuarios (Admins)
    const socios = await Socio.find();
    const admins = await Usuario.find(); 

    // Enviamos AMBAS listas a la vista
    res.render('admin', { socios: socios, admins: admins });
});

// 4. Mostrar formulario de Edición
app.get('/admin/editar/:id', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    const socio = await Socio.findById(req.params.id);
    res.render('editar', { socio: socio });
});

// 5. Guardar Edición (Actualizar en Mongo)
app.post('/admin/editar/:id', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    const { nombres, apellidos, plan, fechaFin } = req.body;

    await Socio.findByIdAndUpdate(req.params.id, {
        nombres: nombres,
        apellidos: apellidos,
        'membresia.tipo': plan,
        'membresia.fechaFin': new Date(fechaFin)
    });

    res.redirect('/admin');
});

// 6. Eliminar Socio
app.get('/admin/eliminar/:id', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    await Socio.findByIdAndDelete(req.params.id);
    res.redirect('/admin');
});

// Mostrar formulario de nuevo admin
app.get('/admin/crear-admin', (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');
    res.render('crearAdmin');
});

// Guardar nuevo admin en Mongo
app.post('/admin/crear-admin', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    try {
        const nuevoAdmin = new Usuario({
            usuario: req.body.usuario,
            password: req.body.password,
            nombre: req.body.nombre
        });
        await nuevoAdmin.save();
        res.redirect('/admin');
    } catch (error) {
        res.send("Error al crear admin (quizás el usuario ya existe).");
    }
});

// --- REPORTE DE ASISTENCIAS ---
app.get('/admin/reportes', async (req, res) => {
    if (!req.session.esAdmin) return res.redirect('/login');

    try {
        const socios = await Socio.find();
        let historialGlobal = [];

        // 1. Sacar las asistencias de cada socio y ponerlas en una sola lista
        socios.forEach(socio => {
            if (socio.asistencias && socio.asistencias.length > 0) {
                socio.asistencias.forEach(asistencia => {
                    historialGlobal.push({
                        fecha: asistencia.fecha,
                        estado: asistencia.estado,
                        cedula: socio.cedula,
                        socio: socio.nombres + ' ' + socio.apellidos
                    });
                });
            }
        });

        // 2. Ordenar por fecha (El más reciente primero)
        historialGlobal.sort((a, b) => b.fecha - a.fecha);

        res.render('reportes', { historial: historialGlobal });

    } catch (error) {
        console.log(error);
        res.send("Error generando reporte");
    }
});

// 7. Cerrar Sesión
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ENCENDER SERVIDOR ---
const port = 3000;
const host = '0.0.0.0'; // Importante: '0.0.0.0' permite que te vean desde afuera
const os = require('os'); // Importamos el módulo del sistema

// Función para buscar tu IP real en la WiFi/Ethernet
const getIpAddress = () => {
    const interfaces = os.networkInterfaces();
    for (const devName in interfaces) {
        const iface = interfaces[devName];
        for (const alias of iface) {
            // Buscamos una dirección IPv4 que NO sea interna (localhost)
            if (alias.family === 'IPv4' && !alias.internal) {
                return alias.address;
            }
        }
    }
    return 'localhost'; // Si no encuentra nada, devuelve localhost
};

app.listen(port, host, () => {
    const ip = getIpAddress(); // Obtenemos la IP automáticamente
    
    console.log('------------------------------------------------');
    console.log(`🚀 SERVIDOR LISTO PARA LA RED`);
    console.log(`📡 Acceso Local:   http://localhost:${port}`);
    console.log(`🌍 Acceso Red:     http://172.17.208.183:${port}`); 
    console.log('------------------------------------------------');
});