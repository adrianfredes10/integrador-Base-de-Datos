const Categoria = require('../models/Categoria');
const Producto = require('../models/Producto');

// @desc    Crear nueva categoría
// @route   POST /api/categorias
// @access  Privado/Admin
exports.crearCategoria = async (req, res, next) => {
  try {
    const categoria = await Categoria.create(req.body);

    res.status(201).json({
      success: true,
      data: categoria
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todas las categorías
// @route   GET /api/categorias
// @access  Público
exports.obtenerCategorias = async (req, res, next) => {
  try {
    const categorias = await Categoria.find({ activo: { $ne: false } })
      .sort('nombre');

    res.status(200).json({
      success: true,
      count: categorias.length,
      data: categorias
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener estadísticas: cantidad de productos por categoría
// @route   GET /api/categorias/stats
// @access  Público
exports.obtenerEstadisticasCategorias = async (req, res, next) => {
  try {
    // Usar agregación: $lookup, $group, $count
    const stats = await Categoria.aggregate([
      {
        // $match para categorías activas
        $match: { activo: { $ne: false } }
      },
      {
        // $lookup para traer productos de cada categoría
        $lookup: {
          from: 'productos',
          localField: '_id',
          foreignField: 'categoria',
          as: 'productos'
        }
      },
      {
        // $project para calcular cantidad de productos
        $project: {
          nombre: 1,
          descripcion: 1,
          cantidadProductos: {
            $size: {
              $filter: {
                input: '$productos',
                as: 'producto',
                cond: { $eq: ['$$producto.activo', true] }
              }
            }
          }
        }
      },
      {
        // $sort por cantidad de productos descendente
        $sort: { cantidadProductos: -1 }
      }
    ]);

    // También calcular total de productos
    const totalProductos = stats.reduce((sum, cat) => sum + cat.cantidadProductos, 0);

    res.status(200).json({
      success: true,
      count: stats.length,
      totalProductos,
      data: stats
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener categoría por ID
// @route   GET /api/categorias/:id
// @access  Público
exports.obtenerCategoria = async (req, res, next) => {
  try {
    const categoria = await Categoria.findById(req.params.id);

    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }

    // Obtener productos de esta categoría
    const productos = await Producto.find({
      categoria: req.params.id,
      activo: { $eq: true }
    }).select('nombre precio stock');

    res.status(200).json({
      success: true,
      data: {
        ...categoria.toObject(),
        productos
      }
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
    const categoria = await Categoria.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      {
        new: true,
        runValidators: true
      }
    );

    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }

    res.status(200).json({
      success: true,
      data: categoria
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar categoría
// @route   DELETE /api/categorias/:id
// @access  Privado/Admin
exports.eliminarCategoria = async (req, res, next) => {
  try {
    const categoria = await Categoria.findById(req.params.id);

    if (!categoria) {
      return res.status(404).json({
        success: false,
        error: 'Categoría no encontrada'
      });
    }

    // Verificar si hay productos usando esta categoría
    const productosCount = await Producto.countDocuments({
      categoria: req.params.id,
      activo: { $eq: true }
    });

    if (productosCount > 0) {
      return res.status(400).json({
        success: false,
        error: `No se puede eliminar. Hay ${productosCount} productos usando esta categoría`
      });
    }

    await categoria.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Categoría eliminada correctamente'
    });
  } catch (error) {
    next(error);
  }
};

