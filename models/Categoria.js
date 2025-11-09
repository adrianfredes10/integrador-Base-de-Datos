const mongoose = require('mongoose');

const categoriaSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre de la categoría es obligatorio'],
    unique: true,
    trim: true
  },
  descripcion: {
    type: String,
    trim: true
  },
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Categoria', categoriaSchema);

