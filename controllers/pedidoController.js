const { Types } = require('mongoose');
const Pedido = require('../models/Pedido');
const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');

// helper para IDs
const asObjectId = (val) => {
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  return Types.ObjectId.isValid(val) ? new Types.ObjectId(val) : null;
};

// @desc Crear pedido desde carrito
// @route POST /api/ordenes
// @access Privado
exports.crearPedido = async (req, res, next) => {
  try {
    const { metodoPago, direccionEnvio, notas } = req.body;
    if (!metodoPago) return res.status(400).json({ success: false, error: 'El método de pago es obligatorio' });

    const carrito = await Carrito.findOne({ usuario: req.usuario._id }).populate('items.producto');
    if (!carrito || carrito.items.length === 0) {
      return res.status(400).json({ success: false, error: 'El carrito está vacío' });
    }

    for (const item of carrito.items) {
      if (!item.producto || !item.producto.activo) {
        return res.status(400).json({ success: false, error: `El producto ${item.producto?.nombre || 'desconocido'} no está disponible` });
      }
      if (item.producto.stock < item.cantidad) {
        return res.status(400).json({ success: false, error: `Stock insuficiente para ${item.producto.nombre}. Disponible: ${item.producto.stock}` });
      }
    }

    const itemsPedido = carrito.items.map(i => ({
      producto: i.producto._id,
      nombre: i.producto.nombre,
      cantidad: i.cantidad,
      precio: i.precio,
      subtotal: i.precio * i.cantidad
    }));

    const total = itemsPedido.reduce((sum, i) => sum + i.subtotal, 0);

    const pedido = await Pedido.create({
      usuario: req.usuario._id,
      items: itemsPedido,
      total,
      metodoPago,
      direccionEnvio: direccionEnvio || req.usuario.direccion,
      notas
    });

    for (const i of carrito.items) {
      await Producto.findByIdAndUpdate(i.producto._id, { $inc: { stock: -i.cantidad } });
    }
    await Carrito.findByIdAndUpdate(carrito._id, { $set: { items: [] } });

    const pedidoCompleto = await Pedido.findById(pedido._id)
      .populate('usuario', 'nombre email telefono')
      .populate('items.producto', 'nombre imagen');

    res.status(201).json({ success: true, data: pedidoCompleto });
  } catch (err) { next(err); }
};

// @desc Obtener todos los pedidos (admin)
// @route GET /api/ordenes
exports.obtenerPedidos = async (req, res, next) => {
  try {
    const pedidos = await Pedido.find()
      .populate('usuario', 'nombre email telefono')
      .populate('items.producto', 'nombre imagen')
      .sort('-createdAt');
    res.status(200).json({ success: true, count: pedidos.length, data: pedidos });
  } catch (err) { next(err); }
};

// @desc Stats de pedidos
// @route GET /api/ordenes/stats
exports.obtenerEstadisticasPedidos = async (req, res, next) => {
  try {
    const stats = await Pedido.aggregate([
      { $group: { _id: '$estado', cantidad: { $sum: 1 }, totalVentas: { $sum: '$total' } } },
      { $sort: { cantidad: -1 } }
    ]);

    const totales = await Pedido.aggregate([
      { $group: { _id: null, totalPedidos: { $sum: 1 }, totalVentas: { $sum: '$total' }, promedioVenta: { $avg: '$total' } } }
    ]);

    res.status(200).json({
      success: true,
      data: {
        porEstado: stats,
        totales: {
          totalPedidos: totales[0]?.totalPedidos || 0,
          totalVentas: totales[0]?.totalVentas || 0,
          promedioVenta: totales[0]?.promedioVenta || 0
        }
      }
    });
  } catch (err) { next(err); }
};

// @desc Pedidos de un usuario
// @route GET /api/ordenes/user/:userId
exports.obtenerPedidosUsuario = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.userId);
    if (!uid) return res.status(400).json({ success: false, error: 'ID inválido' });

    if (uid.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para ver estos pedidos' });
    }

    const pedidos = await Pedido.find({ usuario: uid })
      .populate('items.producto', 'nombre imagen precio')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: pedidos.length, data: pedidos });
  } catch (err) { next(err); }
};

// @desc Obtener pedido por ID
// @route GET /api/ordenes/:id
exports.obtenerPedido = async (req, res, next) => {
  try {
    const pid = asObjectId(req.params.id);
    if (!pid) return res.status(400).json({ success: false, error: 'ID inválido' });

    const pedido = await Pedido.findById(pid)
      .populate('usuario', 'nombre email telefono direccion')
      .populate('items.producto', 'nombre imagen precio');
    if (!pedido) return res.status(404).json({ success: false, error: 'Pedido no encontrado' });

    if (pedido.usuario._id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este pedido' });
    }

    res.status(200).json({ success: true, data: pedido });
  } catch (err) { next(err); }
};

// @desc Actualizar estado
// @route PATCH /api/ordenes/:id/status
// @access Privado/Admin
exports.actualizarEstadoPedido = async (req, res, next) => {
  try {
    const pid = asObjectId(req.params.id);
    const { estado } = req.body;
    if (!pid) return res.status(400).json({ success: false, error: 'ID inválido' });

    const validos = ['pendiente', 'procesando', 'enviado', 'entregado', 'cancelado'];
    if (!estado || !validos.includes(estado)) {
      return res.status(400).json({ success: false, error: `Estado inválido. Válidos: ${validos.join(', ')}` });
    }

    const pedido = await Pedido.findByIdAndUpdate(pid, { $set: { estado } }, { new: true, runValidators: true })
      .populate('usuario', 'nombre email')
      .populate('items.producto', 'nombre');
    if (!pedido) return res.status(404).json({ success: false, error: 'Pedido no encontrado' });

    res.status(200).json({ success: true, data: pedido, message: `Estado actualizado a: ${estado}` });
  } catch (err) { next(err); }
};

// @desc Cancelar pedido
// @route DELETE /api/ordenes/:id
// @access Privado
exports.cancelarPedido = async (req, res, next) => {
  try {
    const pid = asObjectId(req.params.id);
    if (!pid) return res.status(400).json({ success: false, error: 'ID inválido' });

    const pedido = await Pedido.findById(pid);
    if (!pedido) return res.status(404).json({ success: false, error: 'Pedido no encontrado' });

    if (pedido.usuario.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para cancelar este pedido' });
    }
    if (!['pendiente', 'procesando'].includes(pedido.estado)) {
      return res.status(400).json({ success: false, error: `No se puede cancelar un pedido en estado: ${pedido.estado}` });
    }

    for (const item of pedido.items) {
      await Producto.findByIdAndUpdate(item.producto, { $inc: { stock: item.cantidad } });
    }

    pedido.estado = 'cancelado';
    await pedido.save();

    res.status(200).json({ success: true, data: pedido, message: 'Pedido cancelado correctamente' });
  } catch (err) { next(err); }
};