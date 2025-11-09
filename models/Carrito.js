const mongoose = require('mongoose');

const itemCarritoSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  cantidad: {
    type: Number,
    required: true,
    min: [1, 'La cantidad mínima es 1'],
    default: 1
  },
  precio: {
    type: Number,
    required: true
  }
});

const carritoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true,
    unique: true // Cada usuario tiene un solo carrito
  },
  items: [itemCarritoSchema],
  activo: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Método para calcular el total del carrito
carritoSchema.methods.calcularTotal = function() {
  return this.items.reduce((total, item) => {
    return total + (item.precio * item.cantidad);
  }, 0);
};

module.exports = mongoose.model('Carrito', carritoSchema);

