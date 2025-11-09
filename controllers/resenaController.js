const Resena = require('../models/Resena');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');

// @desc    Crear nueva reseña (solo si el usuario compró el producto)
// @route   POST /api/resenas
// @access  Privado
exports.crearResena = async (req, res, next) => {
  try {
    const { producto, calificacion, comentario } = req.body;

    if (!producto || !calificacion || !comentario) {
      return res.status(400).json({
        success: false,
        error: 'Proporcione producto, calificación y comentario'
      });
    }

    // Verificar que el producto existe
    const productoExiste = await Producto.findById(producto);

    if (!productoExiste) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Verificar si el usuario ya dejó una reseña para este producto
    const resenaExistente = await Resena.findOne({
      usuario: req.usuario._id,
      producto
    });

    if (resenaExistente) {
      return res.status(400).json({
        success: false,
        error: 'Ya has dejado una reseña para este producto'
      });
    }

    // Verificar que el usuario compró el producto usando agregación
    // Usar $match, $unwind, $lookup
    const pedidosConProducto = await Pedido.aggregate([
      {
        $match: {
          usuario: require('mongoose').Types.ObjectId(req.usuario._id.toString()),
          estado: { $in: ['enviado', 'entregado'] }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $match: {
          'items.producto': require('mongoose').Types.ObjectId(producto)
        }
      },
      {
        $limit: 1
      }
    ]);

    const verificado = pedidosConProducto.length > 0;

    // Crear reseña
    const resena = await Resena.create({
      usuario: req.usuario._id,
      producto,
      calificacion,
      comentario,
      verificado
    });

    // Obtener reseña con datos poblados
    const resenaCompleta = await Resena.findById(resena._id)
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen');

    res.status(201).json({
      success: true,
      data: resenaCompleta
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todas las reseñas con datos de usuario y producto
// @route   GET /api/resenas
// @access  Público
exports.obtenerResenas = async (req, res, next) => {
  try {
    // Usar $lookup mediante populate
    const resenas = await Resena.find()
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen precio categoria')
      .populate('producto.categoria', 'nombre')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: resenas.length,
      data: resenas
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener reseñas de un producto específico
// @route   GET /api/resenas/product/:productId
// @access  Público
exports.obtenerResenasPorProducto = async (req, res, next) => {
  try {
    const { productId } = req.params;

    // Usar operador $eq
    const resenas = await Resena.find({ producto: { $eq: productId } })
      .populate('usuario', 'nombre')
      .sort('-createdAt');

    // Calcular estadísticas usando agregación
    const stats = await Resena.aggregate([
      {
        $match: { producto: require('mongoose').Types.ObjectId(productId) }
      },
      {
        $group: {
          _id: null,
          calificacionPromedio: { $avg: '$calificacion' },
          totalResenas: { $sum: 1 },
          // Contar por calificación
          cinco: {
            $sum: { $cond: [{ $eq: ['$calificacion', 5] }, 1, 0] }
          },
          cuatro: {
            $sum: { $cond: [{ $eq: ['$calificacion', 4] }, 1, 0] }
          },
          tres: {
            $sum: { $cond: [{ $eq: ['$calificacion', 3] }, 1, 0] }
          },
          dos: {
            $sum: { $cond: [{ $eq: ['$calificacion', 2] }, 1, 0] }
          },
          uno: {
            $sum: { $cond: [{ $eq: ['$calificacion', 1] }, 1, 0] }
          }
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: resenas.length,
      stats: stats[0] || {},
      data: resenas
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener promedio de calificaciones por producto (TOP productos)
// @route   GET /api/resenas/top
// @access  Público
exports.obtenerTopCalificaciones = async (req, res, next) => {
  try {
    // Usar agregación: $group, $avg, $lookup, $sort
    const topProductos = await Resena.aggregate([
      {
        $group: {
          _id: '$producto',
          calificacionPromedio: { $avg: '$calificacion' },
          totalResenas: { $sum: 1 }
        }
      },
      {
        // Filtrar productos con al menos 1 reseña
        $match: {
          totalResenas: { $gte: 1 }
        }
      },
      {
        // $lookup para traer datos del producto
        $lookup: {
          from: 'productos',
          localField: '_id',
          foreignField: '_id',
          as: 'producto'
        }
      },
      {
        // $unwind para descomponer el array
        $unwind: '$producto'
      },
      {
        // $match para solo productos activos
        $match: {
          'producto.activo': { $eq: true }
        }
      },
      {
        // $lookup para traer la categoría
        $lookup: {
          from: 'categorias',
          localField: 'producto.categoria',
          foreignField: '_id',
          as: 'producto.categoria'
        }
      },
      {
        $unwind: {
          path: '$producto.categoria',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $sort: { calificacionPromedio: -1, totalResenas: -1 }
      },
      {
        $limit: 20
      },
      {
        $project: {
          'producto.nombre': 1,
          'producto.precio': 1,
          'producto.imagen': 1,
          'producto.categoria.nombre': 1,
          calificacionPromedio: { $round: ['$calificacionPromedio', 1] },
          totalResenas: 1
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: topProductos.length,
      data: topProductos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener reseña por ID
// @route   GET /api/resenas/:id
// @access  Público
exports.obtenerResena = async (req, res, next) => {
  try {
    const resena = await Resena.findById(req.params.id)
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen precio');

    if (!resena) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: resena
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar reseña (solo el autor)
// @route   PUT /api/resenas/:id
// @access  Privado
exports.actualizarResena = async (req, res, next) => {
  try {
    let resena = await Resena.findById(req.params.id);

    if (!resena) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada'
      });
    }

    // Verificar que el usuario es el autor de la reseña
    if (resena.usuario.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para actualizar esta reseña'
      });
    }

    const { calificacion, comentario } = req.body;

    // Usar operador $set
    resena = await Resena.findByIdAndUpdate(
      req.params.id,
      {
        $set: {
          calificacion: calificacion || resena.calificacion,
          comentario: comentario || resena.comentario
        }
      },
      {
        new: true,
        runValidators: true
      }
    ).populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen');

    res.status(200).json({
      success: true,
      data: resena
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar reseña (solo el autor o admin)
// @route   DELETE /api/resenas/:id
// @access  Privado
exports.eliminarResena = async (req, res, next) => {
  try {
    const resena = await Resena.findById(req.params.id);

    if (!resena) {
      return res.status(404).json({
        success: false,
        error: 'Reseña no encontrada'
      });
    }

    // Verificar que el usuario es el autor o admin
    if (resena.usuario.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para eliminar esta reseña'
      });
    }

    await resena.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Reseña eliminada correctamente'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener mis reseñas
// @route   GET /api/resenas/me
// @access  Privado
exports.obtenerMisResenas = async (req, res, next) => {
  try {
    const resenas = await Resena.find({ usuario: req.usuario._id })
      .populate('producto', 'nombre imagen precio')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: resenas.length,
      data: resenas
    });
  } catch (error) {
    next(error);
  }
};

