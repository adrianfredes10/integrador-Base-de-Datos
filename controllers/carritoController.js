const { Types } = require('mongoose');
const Carrito = require('../models/Carrito');
const Producto = require('../models/Producto');

// Helper: castear y validar IDs
const asObjectId = (val) => {
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  return Types.ObjectId.isValid(val) ? new Types.ObjectId(val) : null;
};

// @desc    Obtener carrito con productos del usuario
// @route   GET /api/carrito/:usuarioId
// @access  Privado
exports.obtenerCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    if (!uid) return res.status(400).json({ success: false, error: 'usuarioId inválido' });

    if (uid.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este carrito' });
    }

    const carrito = await Carrito.findOne({ usuario: uid })
      .populate({
        path: 'items.producto',
        select: 'nombre precio stock imagen categoria',
        populate: { path: 'categoria', select: 'nombre' }
      });

    if (!carrito) {
      return res.status(404).json({ success: false, error: 'Carrito no encontrado' });
    }

    res.status(200).json({ success: true, data: carrito });
  } catch (error) { next(error); }
};

// @desc    Calcular total y subtotales del carrito
// @route   GET /api/carrito/:usuarioId/total
// @access  Privado
exports.calcularTotalCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    if (!uid) return res.status(400).json({ success: false, error: 'usuarioId inválido' });

    if (uid.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este carrito' });
    }

    const resultado = await Carrito.aggregate([
      { $match: { usuario: uid } },
      { $unwind: { path: '$items', preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: '$_id',
          total: { $sum: { $multiply: ['$items.precio', '$items.cantidad'] } },
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

    if (!resultado.length) {
      return res.status(200).json({
        success: true,
        data: { total: 0, cantidadItems: 0, cantidadTotal: 0, items: [] }
      });
    }

    res.status(200).json({ success: true, data: resultado[0] });
  } catch (error) { next(error); }
};

// @desc    Agregar producto al carrito
// @route   POST /api/carrito/:usuarioId
// @access  Privado
exports.agregarAlCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    const pid = asObjectId(req.body.productoId || req.body.producto);
    const cant = Number(req.body.cantidad ?? 1);

    if (!uid) return res.status(400).json({ success: false, error: 'usuarioId inválido' });
    if (!pid) return res.status(400).json({ success: false, error: 'productoId inválido' });
    if (!Number.isFinite(cant) || cant < 1) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser un número >= 1' });
    }

    if (uid.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ success: false, error: 'No autorizado para modificar este carrito' });
    }

    const producto = await Producto.findById(pid);
    if (!producto || !producto.activo) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado o no disponible' });
    }
    if (producto.stock < cant) {
      return res.status(400).json({ success: false, error: `Stock insuficiente. Stock disponible: ${producto.stock}` });
    }

    let carrito = await Carrito.findOne({ usuario: uid });
    if (!carrito) carrito = await Carrito.create({ usuario: uid, items: [] });

    const existe = carrito.items.find(it =>
      (it.producto instanceof Types.ObjectId ? it.producto.equals(pid) : it.producto.toString() === pid.toString())
    );

    if (existe) {
      const nuevaCantidad = existe.cantidad + cant;
      if (producto.stock < nuevaCantidad) {
        return res.status(400).json({ success: false, error: `Stock insuficiente. Stock disponible: ${producto.stock}` });
      }
      await Carrito.updateOne(
        { usuario: uid, 'items.producto': pid },
        { $set: { 'items.$.cantidad': nuevaCantidad, 'items.$.precio': producto.precio } }
      );
    } else {
      await Carrito.updateOne(
        { usuario: uid },
        { $push: { items: { producto: pid, cantidad: cant, precio: producto.precio } } }
      );
    }

    const carritoActualizado = await Carrito.findOne({ usuario: uid })
      .populate('items.producto', 'nombre precio stock imagen');

    res.status(200).json({ success: true, data: carritoActualizado });
  } catch (error) { next(error); }
};

// @desc    Actualizar cantidad de producto en carrito
// @route   PUT /api/carrito/:usuarioId/item/:productoId
// @access  Privado
exports.actualizarItemCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    const pid = asObjectId(req.params.productoId);
    const cantidad = Number(req.body.cantidad);

    if (!uid || !pid) return res.status(400).json({ success: false, error: 'IDs inválidos' });
    if (!Number.isFinite(cantidad) || cantidad < 1) {
      return res.status(400).json({ success: false, error: 'La cantidad debe ser mayor a 0' });
    }
    if (uid.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ success: false, error: 'No autorizado para modificar este carrito' });
    }

    const producto = await Producto.findById(pid);
    if (!producto) return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    if (producto.stock < cantidad) {
      return res.status(400).json({ success: false, error: `Stock insuficiente. Stock disponible: ${producto.stock}` });
    }

    const carrito = await Carrito.findOneAndUpdate(
      { usuario: uid, 'items.producto': pid },
      { $set: { 'items.$.cantidad': cantidad, 'items.$.precio': producto.precio } },
      { new: true }
    ).populate('items.producto', 'nombre precio stock imagen');

    if (!carrito) {
      return res.status(404).json({ success: false, error: 'Carrito o producto no encontrado' });
    }

    res.status(200).json({ success: true, data: carrito });
  } catch (error) { next(error); }
};

// @desc    Eliminar producto del carrito
// @route   DELETE /api/carrito/:usuarioId/item/:productoId
// @access  Privado
exports.eliminarDelCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    const pid = asObjectId(req.params.productoId);
    if (!uid || !pid) return res.status(400).json({ success: false, error: 'IDs inválidos' });

    if (uid.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ success: false, error: 'No autorizado para modificar este carrito' });
    }

    const carrito = await Carrito.findOneAndUpdate(
      { usuario: uid },
      { $pull: { items: { producto: pid } } },
      { new: true }
    ).populate('items.producto', 'nombre precio stock imagen');

    if (!carrito) return res.status(404).json({ success: false, error: 'Carrito no encontrado' });

    res.status(200).json({ success: true, data: carrito, message: 'Producto eliminado del carrito' });
  } catch (error) { next(error); }
};

// @desc    Vaciar carrito
// @route   DELETE /api/carrito/:usuarioId
// @access  Privado
exports.vaciarCarrito = async (req, res, next) => {
  try {
    const uid = asObjectId(req.params.usuarioId);
    if (!uid) return res.status(400).json({ success: false, error: 'usuarioId inválido' });

    if (uid.toString() !== req.usuario._id.toString()) {
      return res.status(403).json({ success: false, error: 'No autorizado para modificar este carrito' });
    }

    const carrito = await Carrito.findOneAndUpdate(
      { usuario: uid },
      { $set: { items: [] } },
      { new: true }
    );

    if (!carrito) return res.status(404).json({ success: false, error: 'Carrito no encontrado' });

    res.status(200).json({ success: true, data: carrito, message: 'Carrito vaciado correctamente' });
  } catch (error) { next(error); }
};