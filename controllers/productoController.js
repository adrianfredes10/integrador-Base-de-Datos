const Producto = require('../models/Producto');

// @desc    Crear nuevo producto
// @route   POST /api/productos
// @access  Privado/Admin
exports.crearProducto = async (req, res, next) => {
  try {
    const producto = await Producto.create(req.body);

    res.status(201).json({
      success: true,
      data: producto
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todos los productos con su categoría
// @route   GET /api/productos
// @access  Público
exports.obtenerProductos = async (req, res, next) => {
  try {
    // Usar $lookup mediante populate para traer la categoría
    const productos = await Producto.find({ activo: { $eq: true } })
      .populate('categoria', 'nombre descripcion')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: productos.length,
      data: productos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Filtrar productos por rango de precio y marca
// @route   GET /api/productos/filtro
// @access  Público
exports.filtrarProductos = async (req, res, next) => {
  try {
    const { precioMin, precioMax, marca } = req.query;

    // Construir filtro usando operadores de comparación
    let filtro = { activo: { $eq: true } };

    // Usar $and con operadores $gte y $lte
    const condiciones = [];

    if (precioMin) {
      condiciones.push({ precio: { $gte: parseFloat(precioMin) } });
    }

    if (precioMax) {
      condiciones.push({ precio: { $lte: parseFloat(precioMax) } });
    }

    if (marca) {
      condiciones.push({ marca: { $eq: marca } });
    }

    if (condiciones.length > 0) {
      filtro = { $and: [filtro, ...condiciones] };
    }

    const productos = await Producto.find(filtro)
      .populate('categoria', 'nombre descripcion')
      .sort('precio');

    res.status(200).json({
      success: true,
      count: productos.length,
      data: productos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener productos más reseñados
// @route   GET /api/productos/top
// @access  Público
exports.productosTopResenas = async (req, res, next) => {
  try {
    // Usar agregación: $match, $sort, limit
    const productos = await Producto.aggregate([
      {
        $match: {
          activo: { $eq: true },
          numeroResenas: { $gt: 0 }
        }
      },
      {
        $sort: { numeroResenas: -1, calificacionPromedio: -1 }
      },
      {
        $limit: 10
      },
      {
        // $lookup para traer la categoría
        $lookup: {
          from: 'categorias',
          localField: 'categoria',
          foreignField: '_id',
          as: 'categoria'
        }
      },
      {
        // $unwind para descomponer el array de categoría
        $unwind: {
          path: '$categoria',
          preserveNullAndEmptyArrays: true
        }
      }
    ]);

    res.status(200).json({
      success: true,
      count: productos.length,
      data: productos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener producto por ID
// @route   GET /api/productos/:id
// @access  Público
exports.obtenerProducto = async (req, res, next) => {
  try {
    const producto = await Producto.findById(req.params.id)
      .populate('categoria', 'nombre descripcion');

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: producto
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar stock de producto
// @route   PATCH /api/productos/:id/stock
// @access  Privado/Admin
exports.actualizarStock = async (req, res, next) => {
  try {
    const { stock, operacion } = req.body;

    if (!stock || !operacion) {
      return res.status(400).json({
        success: false,
        error: 'Proporcione stock y operación (incrementar/decrementar/establecer)'
      });
    }

    let updateQuery;

    // Usar diferentes operadores según la operación
    switch (operacion) {
      case 'incrementar':
        updateQuery = { $inc: { stock: parseInt(stock) } };
        break;
      case 'decrementar':
        updateQuery = { $inc: { stock: -parseInt(stock) } };
        break;
      case 'establecer':
        updateQuery = { $set: { stock: parseInt(stock) } };
        break;
      default:
        return res.status(400).json({
          success: false,
          error: 'Operación inválida. Use: incrementar, decrementar o establecer'
        });
    }

    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      updateQuery,
      {
        new: true,
        runValidators: true
      }
    );

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: producto
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar producto
// @route   PUT /api/productos/:id
// @access  Privado/Admin
exports.actualizarProducto = async (req, res, next) => {
  try {
    const producto = await Producto.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      {
        new: true,
        runValidators: true
      }
    );

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: producto
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar producto
// @route   DELETE /api/productos/:id
// @access  Privado/Admin
exports.eliminarProducto = async (req, res, next) => {
  try {
    const producto = await Producto.findById(req.params.id);

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    // Soft delete: marcar como inactivo
    producto.activo = false;
    await producto.save();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Producto desactivado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

