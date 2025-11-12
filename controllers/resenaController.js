// controllers/resenaController.js

const { Types } = require('mongoose');
const Resena = require('../models/Resena');
const Pedido = require('../models/Pedido');
const Producto = require('../models/Producto');

// Helpers -------------------------------------------------------------

const asObjectId = (val) => {
  // Acepta ObjectId, string o undefined y devuelve un Types.ObjectId (o null si inválido)
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  return Types.ObjectId.isValid(val) ? new Types.ObjectId(val) : null;
};

// @desc    Crear nueva reseña (solo si el usuario compró el producto)
// @route   POST /api/resenas
// @access  Privado
exports.crearResena = async (req, res, next) => {
  try {
    // Aceptamos "producto" o "productoId" para no pelear con Postman
    const productoId = req.body.productoId || req.body.producto;
    const { calificacion, comentario } = req.body;

    if (!productoId || !calificacion || !comentario) {
      return res.status(400).json({
        success: false,
        error: 'Proporcione productoId/producto, calificación y comentario'
      });
    }

    const pid = asObjectId(productoId);
    if (!pid) {
      return res.status(400).json({ success: false, error: 'ID de producto inválido' });
    }

    // Verificar que el producto existe
    const productoExiste = await Producto.findById(pid);
    if (!productoExiste) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    // Verificar si el usuario ya dejó una reseña para este producto
    const resenaExistente = await Resena.findOne({
      usuario: req.usuario._id,
      producto: pid
    });

    if (resenaExistente) {
      return res.status(400).json({
        success: false,
        error: 'Ya has dejado una reseña para este producto'
      });
    }

    // Verificar compra del producto (enviado o entregado)
    const uid = asObjectId(req.usuario._id);
    const pedidosConProducto = await Pedido.aggregate([
      { $match: { usuario: uid, estado: { $in: ['enviado', 'entregado'] } } },
      { $unwind: '$items' },
      { $match: { 'items.producto': pid } },
      { $limit: 1 }
    ]);

    const verificado = pedidosConProducto.length > 0;

    // Crear reseña
    const resena = await Resena.create({
      usuario: uid,
      producto: pid,
      calificacion,
      comentario,
      verificado
    });

    // Recalcular promedio y cantidad en el producto (bono que suelen pedir)
    const agg = await Resena.aggregate([
      { $match: { producto: pid } },
      {
        $group: {
          _id: '$producto',
          promedio: { $avg: '$calificacion' },
          cantidad: { $sum: 1 }
        }
      }
    ]);
    const promedio = agg[0]?.promedio ?? 0;
    const cantidad = agg[0]?.cantidad ?? 0;

    await Producto.findByIdAndUpdate(pid, {
      $set: { calificacionPromedio: promedio, numeroResenas: cantidad }
    });

    const resenaCompleta = await Resena.findById(resena._id)
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen');

    return res.status(201).json({ success: true, data: resenaCompleta });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todas las reseñas con datos de usuario y producto
// @route   GET /api/resenas
// @access  Público
exports.obtenerResenas = async (req, res, next) => {
  try {
    const resenas = await Resena.find()
      .populate({
        path: 'producto',
        select: 'nombre imagen precio categoria',
        populate: { path: 'categoria', select: 'nombre' }
      })
      .populate('usuario', 'nombre')
      .sort('-createdAt');

    return res.status(200).json({
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
    const pid = asObjectId(req.params.productId);
    if (!pid) {
      return res.status(400).json({ success: false, error: 'ID de producto inválido' });
    }

    // Listado
    const resenas = await Resena.find({ producto: pid })
      .populate('usuario', 'nombre')
      .sort('-createdAt');

    // Stats (avg, conteos por estrella)
    const stats = await Resena.aggregate([
      { $match: { producto: pid } },
      {
        $group: {
          _id: null,
          calificacionPromedio: { $avg: '$calificacion' },
          totalResenas: { $sum: 1 },
          cinco: { $sum: { $cond: [{ $eq: ['$calificacion', 5] }, 1, 0] } },
          cuatro: { $sum: { $cond: [{ $eq: ['$calificacion', 4] }, 1, 0] } },
          tres: { $sum: { $cond: [{ $eq: ['$calificacion', 3] }, 1, 0] } },
          dos: { $sum: { $cond: [{ $eq: ['$calificacion', 2] }, 1, 0] } },
          uno: { $sum: { $cond: [{ $eq: ['$calificacion', 1] }, 1, 0] } }
        }
      }
    ]);

    return res.status(200).json({
      success: true,
      count: resenas.length,
      stats: stats[0] || {
        calificacionPromedio: 0,
        totalResenas: 0,
        cinco: 0, cuatro: 0, tres: 0, dos: 0, uno: 0
      },
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
    const topProductos = await Resena.aggregate([
      {
        $group: {
          _id: '$producto',
          calificacionPromedio: { $avg: '$calificacion' },
          totalResenas: { $sum: 1 }
        }
      },
      { $match: { totalResenas: { $gte: 1 } } },
      {
        $lookup: {
          from: 'productos',
          localField: '_id',
          foreignField: '_id',
          as: 'producto'
        }
      },
      { $unwind: '$producto' },
      { $match: { 'producto.activo': true } },
      {
        $lookup: {
          from: 'categorias',
          localField: 'producto.categoria',
          foreignField: '_id',
          as: 'producto.categoria'
        }
      },
      { $unwind: { path: '$producto.categoria', preserveNullAndEmptyArrays: true } },
      { $sort: { calificacionPromedio: -1, totalResenas: -1 } },
      { $limit: 20 },
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

    return res.status(200).json({ success: true, count: topProductos.length, data: topProductos });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener reseña por ID
// @route   GET /api/resenas/:id
// @access  Público
exports.obtenerResena = async (req, res, next) => {
  try {
    const rid = asObjectId(req.params.id);
    if (!rid) return res.status(400).json({ success: false, error: 'ID inválido' });

    const resena = await Resena.findById(rid)
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen precio');

    if (!resena) {
      return res.status(404).json({ success: false, error: 'Reseña no encontrada' });
    }

    return res.status(200).json({ success: true, data: resena });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar reseña (solo el autor)
// @route   PUT /api/resenas/:id
// @access  Privado
exports.actualizarResena = async (req, res, next) => {
  try {
    const rid = asObjectId(req.params.id);
    if (!rid) return res.status(400).json({ success: false, error: 'ID inválido' });

    let resena = await Resena.findById(rid);
    if (!resena) return res.status(404).json({ success: false, error: 'Reseña no encontrada' });

    if (resena.usuario.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ success: false, error: 'No autorizado para actualizar esta reseña' });
    }

    const { calificacion, comentario } = req.body;

    resena = await Resena.findByIdAndUpdate(
      rid,
      { $set: { calificacion: calificacion ?? resena.calificacion, comentario: comentario ?? resena.comentario } },
      { new: true, runValidators: true }
    )
      .populate('usuario', 'nombre')
      .populate('producto', 'nombre imagen');

    return res.status(200).json({ success: true, data: resena });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar reseña (solo el autor o admin)
// @route   DELETE /api/resenas/:id
// @access  Privado
exports.eliminarResena = async (req, res, next) => {
  try {
    const rid = asObjectId(req.params.id);
    if (!rid) return res.status(400).json({ success: false, error: 'ID inválido' });

    const resena = await Resena.findById(rid);
    if (!resena) return res.status(404).json({ success: false, error: 'Reseña no encontrada' });

    if (resena.usuario.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para eliminar esta reseña' });
    }

    await resena.deleteOne();

    return res.status(200).json({ success: true, data: {}, message: 'Reseña eliminada correctamente' });
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

    return res.status(200).json({ success: true, count: resenas.length, data: resenas });
  } catch (error) {
    next(error);
  }
};
