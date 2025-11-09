const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const usuarioSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre es obligatorio'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'El email es obligatorio'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Email inválido']
  },
  password: {
    type: String,
    required: [true, 'La contraseña es obligatoria'],
    minlength: 6,
    select: false // No devolver password por defecto en consultas
  },
  telefono: {
    type: String,
    trim: true
  },
  direccion: {
    calle: String,
    ciudad: String,
    provincia: String,
    codigoPostal: String,
    pais: { type: String, default: 'Argentina' }
  },
  rol: {
    type: String,
    enum: ['cliente', 'admin'],
    default: 'cliente'
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true // Agrega createdAt y updatedAt
});

// Middleware para hashear password antes de guardar
usuarioSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Método para comparar passwords
usuarioSchema.methods.compararPassword = async function(passwordIngresado) {
  return await bcrypt.compare(passwordIngresado, this.password);
};

module.exports = mongoose.model('Usuario', usuarioSchema);

