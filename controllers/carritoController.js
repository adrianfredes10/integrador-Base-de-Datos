const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');

// @desc    Obtener carrito con productos del usuario
// @route   GET /api/carrito/:usuarioId
// @access  Privado
exports.obtenerCarrito = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    // Verificar que el usuario pueda ver su propio carrito o sea admin
    if (usuarioId !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver este carrito'
      });
    }

    // Usar populate ($lookup) para traer información de productos
    const carrito = await Carrito.findOne({ usuario: usuarioId })
      .populate({
        path: 'items.producto',
        select: 'nombre precio stock imagen categoria',
        populate: {
          path: 'categoria',
          select: 'nombre'
        }
      });

    if (!carrito) {
      return res.status(404).json({
        success: false,
        error: 'Carrito no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: carrito
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Calcular total y subtotales del carrito
// @route   GET /api/carrito/:usuarioId/total
// @access  Privado
exports.calcularTotalCarrito = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    // Verificar que el usuario pueda ver su propio carrito o sea admin
    if (usuarioId !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver este carrito'
      });
    }

    // Usar agregación para calcular totales: $match, $unwind, $group, $sum
    const resultado = await Carrito.aggregate([
      {
        $match: { usuario: require('mongoose').Types.ObjectId(usuarioId) }
      },
      {
        $unwind: '$items'
      },
      {
        $group: {
          _id: '$_id',
          total: {
            $sum: { $multiply: ['$items.precio', '$items.cantidad'] }
          },
          cantidadItems: { $sum: 1 },
          cantidadTotal: { $sum: '$items.cantidad' },
          items: {
            $push: {
              producto: '$items.producto',
              cantidad: '$items.cantidad',
              precio: '$items.precio',
              subtotal: { $multiply: ['$items.precio', '$items.cantidad'] }
            }
          }
        }
      }
    ]);

    if (resultado.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          total: 0,
          cantidadItems: 0,
          cantidadTotal: 0,
          items: []
        }
      });
    }

    res.status(200).json({
      success: true,
      data: resultado[0]
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Agregar producto al carrito
// @route   POST /api/carrito/:usuarioId
// @access  Privado
exports.agregarAlCarrito = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;
    const { productoId, cantidad } = req.body;

    // Verificar que el usuario pueda modificar su propio carrito
    if (usuarioId !== req.usuario._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para modificar este carrito'
      });
    }

    // Verificar que el producto existe y tiene stock
    const producto = await Producto.findById(productoId);

    if (!producto || !producto.activo) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado o no disponible'
      });
    }

    if (producto.stock < cantidad) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente. Stock disponible: ${producto.stock}`
      });
    }

    // Buscar carrito del usuario
    let carrito = await Carrito.findOne({ usuario: usuarioId });

    if (!carrito) {
      // Crear carrito si no existe
      carrito = await Carrito.create({
        usuario: usuarioId,
        items: []
      });
    }

    // Verificar si el producto ya está en el carrito
    const itemExistente = carrito.items.find(
      item => item.producto.toString() === productoId
    );

    if (itemExistente) {
      // Actualizar cantidad usando $set
      const nuevaCantidad = itemExistente.cantidad + cantidad;

      if (producto.stock < nuevaCantidad) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente. Stock disponible: ${producto.stock}`
        });
      }

      await Carrito.updateOne(
        {
          usuario: usuarioId,
          'items.producto': productoId
        },
        {
          $set: {
            'items.$.cantidad': nuevaCantidad,
            'items.$.precio': producto.precio
          }
        }
      );
    } else {
      // Agregar nuevo producto usando $push
      await Carrito.updateOne(
        { usuario: usuarioId },
        {
          $push: {
            items: {
              producto: productoId,
              cantidad: cantidad,
              precio: producto.precio
            }
          }
        }
      );
    }

    // Obtener carrito actualizado
    const carritoActualizado = await Carrito.findOne({ usuario: usuarioId })
      .populate('items.producto', 'nombre precio stock imagen');

    res.status(200).json({
      success: true,
      data: carritoActualizado
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar cantidad de producto en carrito
// @route   PUT /api/carrito/:usuarioId/item/:productoId
// @access  Privado
exports.actualizarItemCarrito = async (req, res, next) => {
  try {
    const { usuarioId, productoId } = req.params;
    const { cantidad } = req.body;

    // Verificar que el usuario pueda modificar su propio carrito
    if (usuarioId !== req.usuario._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para modificar este carrito'
      });
    }

    if (!cantidad || cantidad < 1) {
      return res.status(400).json({
        success: false,
        error: 'La cantidad debe ser mayor a 0'
      });
    }

    // Verificar stock
    const producto = await Producto.findById(productoId);

    if (!producto) {
      return res.status(404).json({
        success: false,
        error: 'Producto no encontrado'
      });
    }

    if (producto.stock < cantidad) {
      return res.status(400).json({
        success: false,
        error: `Stock insuficiente. Stock disponible: ${producto.stock}`
      });
    }

    // Actualizar cantidad usando $set
    const carrito = await Carrito.findOneAndUpdate(
      {
        usuario: usuarioId,
        'items.producto': productoId
      },
      {
        $set: {
          'items.$.cantidad': cantidad,
          'items.$.precio': producto.precio
        }
      },
      { new: true }
    ).populate('items.producto', 'nombre precio stock imagen');

    if (!carrito) {
      return res.status(404).json({
        success: false,
        error: 'Carrito o producto no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: carrito
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar producto del carrito
// @route   DELETE /api/carrito/:usuarioId/item/:productoId
// @access  Privado
exports.eliminarDelCarrito = async (req, res, next) => {
  try {
    const { usuarioId, productoId } = req.params;

    // Verificar que el usuario pueda modificar su propio carrito
    if (usuarioId !== req.usuario._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para modificar este carrito'
      });
    }

    // Eliminar producto usando $pull
    const carrito = await Carrito.findOneAndUpdate(
      { usuario: usuarioId },
      {
        $pull: {
          items: { producto: productoId }
        }
      },
      { new: true }
    ).populate('items.producto', 'nombre precio stock imagen');

    if (!carrito) {
      return res.status(404).json({
        success: false,
        error: 'Carrito no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: carrito,
      message: 'Producto eliminado del carrito'
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Vaciar carrito
// @route   DELETE /api/carrito/:usuarioId
// @access  Privado
exports.vaciarCarrito = async (req, res, next) => {
  try {
    const { usuarioId } = req.params;

    // Verificar que el usuario pueda modificar su propio carrito
    if (usuarioId !== req.usuario._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para modificar este carrito'
      });
    }

    const carrito = await Carrito.findOneAndUpdate(
      { usuario: usuarioId },
      { $set: { items: [] } },
      { new: true }
    );

    if (!carrito) {
      return res.status(404).json({
        success: false,
        error: 'Carrito no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: carrito,
      message: 'Carrito vaciado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

