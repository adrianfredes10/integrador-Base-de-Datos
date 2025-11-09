const mongoose = require('mongoose');

const productoSchema = new mongoose.Schema({
  nombre: {
    type: String,
    required: [true, 'El nombre del producto es obligatorio'],
    trim: true
  },
  descripcion: {
    type: String,
    required: [true, 'La descripción es obligatoria'],
    trim: true
  },
  precio: {
    type: Number,
    required: [true, 'El precio es obligatorio'],
    min: [0, 'El precio no puede ser negativo']
  },
  stock: {
    type: Number,
    required: [true, 'El stock es obligatorio'],
    min: [0, 'El stock no puede ser negativo'],
    default: 0
  },
  categoria: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Categoria',
    required: [true, 'La categoría es obligatoria']
  },
  marca: {
    type: String,
    trim: true
  },
  imagen: {
    type: String,
    default: 'https://via.placeholder.com/300'
  },
  activo: {
    type: Boolean,
    default: true
  },
  // Campo virtual calculado: promedio de calificaciones
  calificacionPromedio: {
    type: Number,
    default: 0
  },
  numeroResenas: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual para obtener reseñas del producto
productoSchema.virtual('resenas', {
  ref: 'Resena',
  localField: '_id',
  foreignField: 'producto'
});

module.exports = mongoose.model('Producto', productoSchema);

