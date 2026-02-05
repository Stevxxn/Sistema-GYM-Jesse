const mongoose = require('mongoose');

const usuarioSchema = new mongoose.Schema({
    usuario: { type: String, required: true, unique: true },
    password: { type: String, required: true }, // En la vida real se encripta, para el MVP texto plano está bien
    nombre: String
});

module.exports = mongoose.model('Usuario', usuarioSchema);