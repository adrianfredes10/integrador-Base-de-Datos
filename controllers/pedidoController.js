const Pedido = require('../models/Pedido');
const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');
const mongoose = require('mongoose');

// @desc    Crear nuevo pedido desde el carrito
// @route   POST /api/ordenes
// @access  Privado
exports.crearPedido = async (req, res, next) => {
  try {
    const { metodoPago, direccionEnvio, notas } = req.body;

    if (!metodoPago) {
      return res.status(400).json({
        success: false,
        error: 'El método de pago es obligatorio'
      });
    }

    // Obtener carrito del usuario
    const carrito = await Carrito.findOne({ usuario: req.usuario._id })
      .populate('items.producto');

    if (!carrito || carrito.items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'El carrito está vacío'
      });
    }

    // Verificar stock de todos los productos
    for (const item of carrito.items) {
      if (!item.producto || !item.producto.activo) {
        return res.status(400).json({
          success: false,
          error: `El producto ${item.producto?.nombre || 'desconocido'} no está disponible`
        });
      }

      if (item.producto.stock < item.cantidad) {
        return res.status(400).json({
          success: false,
          error: `Stock insuficiente para ${item.producto.nombre}. Disponible: ${item.producto.stock}`
        });
      }
    }

    // Preparar items del pedido
    const itemsPedido = carrito.items.map(item => ({
      producto: item.producto._id,
      nombre: item.producto.nombre,
      cantidad: item.cantidad,
      precio: item.precio,
      subtotal: item.precio * item.cantidad
    }));

    // Calcular total
    const total = itemsPedido.reduce((sum, item) => sum + item.subtotal, 0);

    // Crear pedido
    const pedido = await Pedido.create({
      usuario: req.usuario._id,
      items: itemsPedido,
      total,
      metodoPago,
      direccionEnvio: direccionEnvio || req.usuario.direccion,
      notas
    });

    // Actualizar stock de productos usando $inc
    for (const item of carrito.items) {
      await Producto.findByIdAndUpdate(
        item.producto._id,
        { $inc: { stock: -item.cantidad } }
      );
    }

    // Vaciar carrito usando $set
    await Carrito.findByIdAndUpdate(
      carrito._id,
      { $set: { items: [] } }
    );

    // Obtener pedido con datos de usuario
    const pedidoCompleto = await Pedido.findById(pedido._id)
      .populate('usuario', 'nombre email telefono')
      .populate('items.producto', 'nombre imagen');

    res.status(201).json({
      success: true,
      data: pedidoCompleto
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todos los pedidos con datos de usuario
// @route   GET /api/ordenes
// @access  Privado/Admin
exports.obtenerPedidos = async (req, res, next) => {
  try {
    // Usar $lookup mediante populate
    const pedidos = await Pedido.find()
      .populate('usuario', 'nombre email telefono')
      .populate('items.producto', 'nombre imagen')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pedidos.length,
      data: pedidos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener estadísticas: total de pedidos por estado
// @route   GET /api/ordenes/stats
// @access  Privado/Admin
exports.obtenerEstadisticasPedidos = async (req, res, next) => {
  try {
    // Usar agregación: $group, $count, $sum
    const stats = await Pedido.aggregate([
      {
        $group: {
          _id: '$estado',
          cantidad: { $sum: 1 },
          totalVentas: { $sum: '$total' }
        }
      },
      {
        $sort: { cantidad: -1 }
      }
    ]);

    // Calcular totales generales
    const totales = await Pedido.aggregate([
      {
        $group: {
          _id: null,
          totalPedidos: { $sum: 1 },
          totalVentas: { $sum: '$total' },
          promedioVenta: { $avg: '$total' }
        }
      }
    ]);

    // Contar pedidos totales usando $count
    const conteoTotal = await Pedido.aggregate([
      {
        $match: {} // Permite extender con filtros en el futuro
      },
      {
        $count: 'totalPedidos'
      }
    ]);

    res.status(200).json({
      success: true,
      data: {
        porEstado: stats,
        totales: {
          totalPedidos: conteoTotal[0]?.totalPedidos || 0,
          totalVentas: totales[0]?.totalVentas || 0,
          promedioVenta: totales[0]?.promedioVenta || 0
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener pedidos de un usuario específico
// @route   GET /api/ordenes/user/:userId
// @access  Privado (solo dueño o admin)
exports.obtenerPedidosUsuario = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Verificar que el usuario pueda ver sus propios pedidos o sea admin
    if (userId !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver estos pedidos'
      });
    }

    // Usar operadores $eq y $match
    const pedidos = await Pedido.find({ usuario: { $eq: userId } })
      .populate('items.producto', 'nombre imagen precio')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: pedidos.length,
      data: pedidos
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener pedido por ID
// @route   GET /api/ordenes/:id
// @access  Privado
exports.obtenerPedido = async (req, res, next) => {
  try {
    const pedido = await Pedido.findById(req.params.id)
      .populate('usuario', 'nombre email telefono direccion')
      .populate('items.producto', 'nombre imagen precio');

    if (!pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    // Verificar que el usuario pueda ver su propio pedido o sea admin
    if (pedido.usuario._id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver este pedido'
      });
    }

    res.status(200).json({
      success: true,
      data: pedido
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar estado del pedido
// @route   PATCH /api/ordenes/:id/status
// @access  Privado/Admin
exports.actualizarEstadoPedido = async (req, res, next) => {
  try {
    const { estado } = req.body;

    const estadosValidos = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];

    if (!estado || !estadosValidos.includes(estado)) {
      return res.status(400).json({
        success: false,
        error: `Estado inválido. Estados válidos: ${estadosValidos.join(', ')}`
      });
    }

    // Usar operador $set
    const pedido = await Pedido.findByIdAndUpdate(
      req.params.id,
      { $set: { estado } },
      {
        new: true,
        runValidators: true
      }
    ).populate('usuario', 'nombre email')
      .populate('items.producto', 'nombre');

    if (!pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: pedido,
      message: `Estado actualizado a: ${estado}`
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancelar pedido (solo si está pendiente)
// @route   DELETE /api/ordenes/:id
// @access  Privado
exports.cancelarPedido = async (req, res, next) => {
  try {
    const pedido = await Pedido.findById(req.params.id);

    if (!pedido) {
      return res.status(404).json({
        success: false,
        error: 'Pedido no encontrado'
      });
    }

    // Verificar que el usuario pueda cancelar su propio pedido o sea admin
    if (pedido.usuario.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para cancelar este pedido'
      });
    }

    // Solo se puede cancelar si está pendiente o procesando
    if (!['pendiente', 'procesando'].includes(pedido.estado)) {
      return res.status(400).json({
        success: false,
        error: `No se puede cancelar un pedido en estado: ${pedido.estado}`
      });
    }

    // Devolver stock a los productos
    for (const item of pedido.items) {
      await Producto.findByIdAndUpdate(
        item.producto,
        { $inc: { stock: item.cantidad } }
      );
    }

    // Actualizar estado a cancelado
    pedido.estado = 'cancelado';
    await pedido.save();

    res.status(200).json({
      success: true,
      data: pedido,
      message: 'Pedido cancelado correctamente'
    });
  } catch (error) {
    next(error);
  }
};

