// Archivo: models/Socio.js
const mongoose = require('mongoose');

// Aquí definimos la ESTRUCTURA (Schema) tal cual tu Diagrama de Clases
const socioSchema = new mongoose.Schema({
    cedula: { 
        type: String, 
        required: true, 
        unique: true // No pueden haber dos socios con la misma cédula
    },
    nombres: String,
    apellidos: String,
    
    // Simulamos la huella guardando un código de texto
    huellaDigital: String, 
    
    // Objeto Membresía (Composición)
    membresia: {
        tipo: String,      // "Mensual" o "Anual"
        costo: Number,
        fechaInicio: Date,
        fechaFin: Date,
        activa: Boolean
    },
    
    // Historial de Asistencias (Agregación)
    // Guardamos un array con las fechas y horas de entrada
    asistencias: [
        {
            fecha: { type: Date, default: Date.now },
            estado: String // "Permitido" o "Denegado"
        }
    ]
});

// Exportamos el modelo para usarlo en el servidor
module.exports = mongoose.model('Socio', socioSchema);