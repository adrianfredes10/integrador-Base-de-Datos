// controllers/categoriaController.js
const { Types } = require('mongoose');
const Categoria = require('../models/Categoria');
const Producto = require('../models/Producto');

// Helper para IDs
const asObjectId = (val) => {
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  return Types.ObjectId.isValid(val) ? new Types.ObjectId(val) : null;
};

// @desc    Crear nueva categoría
// @route   POST /api/categorias
// @access  Privado/Admin
exports.crearCategoria = async (req, res, next) => {
  try {
    const { nombre, descripcion } = req.body || {};
    if (!nombre || !String(nombre).trim()) {
      return res.status(400).json({ success: false, error: 'El nombre es obligatorio' });
    }

    // Normalizá si querés evitar “Electrónica” vs “electrónica”
    const nombreNorm = String(nombre).trim();

    // Si ya existe, devolvémoslo con 400 coherente (el Runner ya lo tolera)
    const ya = await Categoria.findOne({ nombre: nombreNorm });
    if (ya) {
      return res.status(400).json({ success: false, error: 'El nombre ya existe en la base de datos' });
    }

    const categoria = await Categoria.create({ nombre: nombreNorm, descripcion });
    return res.status(201).json({ success: true, data: categoria });
  } catch (error) {
    // Duplicado por índice único
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, error: 'El nombre ya existe en la base de datos' });
    }
    next(error);
  }
};

// @desc    Obtener todas las categorías
// @route   GET /api/categorias
// @access  Público
exports.obtenerCategorias = async (req, res, next) => {
  try {
    const categorias = await Categoria.find({ activo: { $ne: false } }).sort('nombre');
    return res.status(200).json({ success: true, count: categorias.length, data: categorias });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener estadísticas: cantidad de productos por categoría
// @route   GET /api/categorias/stats
// @access  Público
exports.obtenerEstadisticasCategorias = async (req, res, next) => {
  try {
    const stats = await Categoria.aggregate([
      { $match: { activo: { $ne: false } } },
      {
        $lookup: {
          from: 'productos',
          localField: '_id',
          foreignField: 'categoria',
          as: 'productos'
        }
      },
      {
        $project: {
          nombre: 1,
          descripcion: 1,
          cantidadProductos: {
            $size: {
              $filter: {
                input: '$productos',
                as: 'p',
                cond: { $eq: ['$$p.activo', true] }
              }
            }
          }
        }
      },
      { $sort: { cantidadProductos: -1 } }
    ]);

    const totalProductos = stats.reduce((acc, c) => acc + (c.cantidadProductos || 0), 0);
    return res.status(200).json({ success: true, count: stats.length, totalProductos, data: stats });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener categoría por ID
// @route   GET /api/categorias/:id
// @access  Público
exports.obtenerCategoria = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    }

    const productos = await Producto.find({ categoria: id, activo: true })
      .select('nombre precio stock');

    return res.status(200).json({
      success: true,
      data: { ...categoria.toObject(), productos }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar categoría
// @route   PUT /api/categorias/:id
// @access  Privado/Admin
exports.actualizarCategoria = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const update = { ...req.body };
    if (update.nombre) update.nombre = String(update.nombre).trim();

    const categoria = await Categoria.findByIdAndUpdate(
      id,
      { $set: update },
      { new: true, runValidators: true }
    );

    if (!categoria) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    }

    return res.status(200).json({ success: true, data: categoria });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, error: 'El nombre ya existe en la base de datos' });
    }
    next(error);
  }
};

// @desc    Eliminar categoría
// @route   DELETE /api/categorias/:id
// @access  Privado/Admin
exports.eliminarCategoria = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const categoria = await Categoria.findById(id);
    if (!categoria) {
      return res.status(404).json({ success: false, error: 'Categoría no encontrada' });
    }

    const productosCount = await Producto.countDocuments({ categoria: id, activo: true });
    if (productosCount > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar. Hay ${productosCount} productos usando esta categoría`
      });
    }

    await categoria.deleteOne();
    return res.status(200).json({ success: true, data: {}, message: 'Categoría eliminada correctamente' });
  } catch (error) {
    next(error);
  }
};