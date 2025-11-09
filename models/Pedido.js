const mongoose = require('mongoose');

const itemPedidoSchema = new mongoose.Schema({
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  nombre: String, // Guardamos el nombre por si el producto se elimina
  cantidad: {
    type: Number,
    required: true,
    min: 1
  },
  precio: {
    type: Number,
    required: true
  },
  subtotal: {
    type: Number,
    required: true
  }
});

const pedidoSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  items: [itemPedidoSchema],
  total: {
    type: Number,
    required: true,
    min: 0
  },
  estado: {
    type: String,
    enum: ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'],
    default: 'pendiente'
  },
  metodoPago: {
    type: String,
    enum: ['efectivo', 'tarjeta', 'transferencia', 'mercadopago'],
    required: [true, 'El método de pago es obligatorio']
  },
  direccionEnvio: {
    calle: String,
    ciudad: String,
    provincia: String,
    codigoPostal: String,
    pais: String
  },
  notas: String
}, {
  timestamps: true
});

// Índice para consultas frecuentes
pedidoSchema.index({ usuario: 1, createdAt: -1 });
pedidoSchema.index({ estado: 1 });

module.exports = mongoose.model('Pedido', pedidoSchema);

