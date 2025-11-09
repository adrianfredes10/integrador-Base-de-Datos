const mongoose = require('mongoose');

const resenaSchema = new mongoose.Schema({
  usuario: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Usuario',
    required: true
  },
  producto: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Producto',
    required: true
  },
  calificacion: {
    type: Number,
    required: [true, 'La calificación es obligatoria'],
    min: [1, 'La calificación mínima es 1'],
    max: [5, 'La calificación máxima es 5']
  },
  comentario: {
    type: String,
    required: [true, 'El comentario es obligatorio'],
    trim: true,
    maxlength: [500, 'El comentario no puede exceder 500 caracteres']
  },
  verificado: {
    type: Boolean,
    default: false // Se marca como true si el usuario compró el producto
  }
}, {
  timestamps: true
});

// Un usuario solo puede dejar una reseña por producto
resenaSchema.index({ usuario: 1, producto: 1 }, { unique: true });

// Middleware para actualizar calificación promedio del producto
resenaSchema.statics.calcularPromedioCalificacion = async function(productoId) {
  const stats = await this.aggregate([
    { $match: { producto: productoId } },
    {
      $group: {
        _id: '$producto',
        numeroResenas: { $sum: 1 },
        calificacionPromedio: { $avg: '$calificacion' }
      }
    }
  ]);

  if (stats.length > 0) {
    await mongoose.model('Producto').findByIdAndUpdate(productoId, {
      numeroResenas: stats[0].numeroResenas,
      calificacionPromedio: Math.round(stats[0].calificacionPromedio * 10) / 10
    });
  } else {
    await mongoose.model('Producto').findByIdAndUpdate(productoId, {
      numeroResenas: 0,
      calificacionPromedio: 0
    });
  }
};

// Actualizar promedio después de guardar
resenaSchema.post('save', function() {
  this.constructor.calcularPromedioCalificacion(this.producto);
});

// Actualizar promedio después de eliminar
resenaSchema.post('remove', function() {
  this.constructor.calcularPromedioCalificacion(this.producto);
});

module.exports = mongoose.model('Resena', resenaSchema);

