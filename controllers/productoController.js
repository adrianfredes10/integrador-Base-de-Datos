const { Types } = require('mongoose');
const Producto = require('../models/Producto');

// helper id seguro
const asObjectId = (v) => {
  if (!v) return null;
  if (v instanceof Types.ObjectId) return v;
  return Types.ObjectId.isValid(v) ? new Types.ObjectId(v) : null;
};

// @desc    Crear nuevo producto
// @route   POST /api/productos
// @access  Privado/Admin
exports.crearProducto = async (req, res, next) => {
  try {
    const {
      nombre, descripcion, precio, stock,
      categoria, marca, imagen, activo
    } = req.body;

    if (!nombre || precio == null || stock == null) {
      return res.status(400).json({ success: false, error: 'nombre, precio y stock son obligatorios' });
    }
    const precioNum = Number(precio);
    const stockNum = Number(stock);
    if (!Number.isFinite(precioNum) || precioNum < 0) {
      return res.status(400).json({ success: false, error: 'precio inválido' });
    }
    if (!Number.isInteger(stockNum) || stockNum < 0) {
      return res.status(400).json({ success: false, error: 'stock inválido' });
    }

    const catId = categoria ? asObjectId(categoria) : null;
    if (categoria && !catId) {
      return res.status(400).json({ success: false, error: 'categoria inválida' });
    }

    const producto = await Producto.create({
      nombre,
      descripcion,
      precio: precioNum,
      stock: stockNum,
      categoria: catId || undefined,
      marca,
      imagen,
      activo: activo !== undefined ? !!activo : true
    });

    res.status(201).json({ success: true, data: producto });
  } catch (error) { next(error); }
};

// @desc    Obtener todos los productos con su categoría
// @route   GET /api/productos
// @access  Público
exports.obtenerProductos = async (req, res, next) => {
  try {
    const productos = await Producto.find({ activo: { $eq: true } })
      .populate('categoria', 'nombre descripcion')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: productos.length, data: productos });
  } catch (error) { next(error); }
};

// @desc    Filtrar productos por rango de precio y marca
// @route   GET /api/productos/filtro
// @access  Público
exports.filtrarProductos = async (req, res, next) => {
  try {
    const { precioMin, precioMax, marca, categoria } = req.query;

    const filtro = { activo: { $eq: true } };
    const and = [];

    if (precioMin !== undefined) {
      const v = Number(precioMin);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ success: false, error: 'precioMin inválido' });
      }
      and.push({ precio: { $gte: v } });
    }

    if (precioMax !== undefined) {
      const v = Number(precioMax);
      if (!Number.isFinite(v) || v < 0) {
        return res.status(400).json({ success: false, error: 'precioMax inválido' });
      }
      and.push({ precio: { $lte: v } });
    }

    if (marca) {
      and.push({ marca: { $regex: new RegExp(marca.trim(), 'i') } });
    }

    if (categoria) {
      const cat = asObjectId(categoria);
      if (!cat) return res.status(400).json({ success: false, error: 'categoria inválida' });
      and.push({ categoria: cat });
    }

    const finalQuery = and.length ? { $and: [filtro, ...and] } : filtro;

    const productos = await Producto.find(finalQuery)
      .populate('categoria', 'nombre descripcion')
      .sort('precio');

    res.status(200).json({ success: true, count: productos.length, data: productos });
  } catch (error) { next(error); }
};

// @desc    Productos más reseñados
// @route   GET /api/productos/top
// @access  Público
exports.productosTopResenas = async (req, res, next) => {
  try {
    const top = await Producto.aggregate([
      { $match: { activo: true, numeroResenas: { $gt: 0 } } },
      { $sort: { numeroResenas: -1, calificacionPromedio: -1, createdAt: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: 'categorias',
          localField: 'categoria',
          foreignField: '_id',
          as: 'categoria'
        }
      },
      { $unwind: { path: '$categoria', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          nombre: 1,
          marca: 1,
          imagen: 1,
          precio: 1,
          numeroResenas: 1,
          calificacionPromedio: 1,
          'categoria._id': 1,
          'categoria.nombre': 1
        }
      }
    ]);

    res.status(200).json({ success: true, count: top.length, data: top });
  } catch (error) { next(error); }
};

// @desc    Obtener producto por ID
// @route   GET /api/productos/:id
// @access  Público
exports.obtenerProducto = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const producto = await Producto.findById(id).populate('categoria', 'nombre descripcion');
    if (!producto) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    res.status(200).json({ success: true, data: producto });
  } catch (error) { next(error); }
};

// @desc    Actualizar stock
// @route   PATCH /api/productos/:id/stock
// @access  Privado/Admin
exports.actualizarStock = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const { stock, operacion } = req.body;
    if (stock == null || !operacion) {
      return res.status(400).json({ success: false, error: 'Proporcione stock y operación (incrementar/decrementar/establecer)' });
    }
    const s = Number(stock);
    if (!Number.isInteger(s)) return res.status(400).json({ success: false, error: 'stock debe ser entero' });

    let updateQuery;
    switch (operacion) {
      case 'incrementar': updateQuery = { $inc: { stock: s } }; break;
      case 'decrementar': updateQuery = { $inc: { stock: -s } }; break;
      case 'establecer':  updateQuery = { $set: { stock: s } }; break;
      default:
        return res.status(400).json({ success: false, error: 'Operación inválida. Use: incrementar, decrementar o establecer' });
    }

    const producto = await Producto.findByIdAndUpdate(id, updateQuery, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    res.status(200).json({ success: true, data: producto });
  } catch (error) { next(error); }
};

// @desc    Actualizar producto
// @route   PUT /api/productos/:id
// @access  Privado/Admin
exports.actualizarProducto = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    // sanitizar: si viene categoria, validar/castear
    const update = { ...req.body };
    if (update.categoria !== undefined) {
      const cat = asObjectId(update.categoria);
      if (!cat) return res.status(400).json({ success: false, error: 'categoria inválida' });
      update.categoria = cat;
    }

    const producto = await Producto.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true });
    if (!producto) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    res.status(200).json({ success: true, data: producto });
  } catch (error) { next(error); }
};

// @desc    Eliminar producto (soft delete)
// @route   DELETE /api/productos/:id
// @access  Privado/Admin
exports.eliminarProducto = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const producto = await Producto.findById(id);
    if (!producto) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    if (producto.activo === false) {
      return res.status(200).json({ success: true, data: {}, message: 'Producto ya estaba desactivado' });
    }

    producto.activo = false;
    await producto.save();

    res.status(200).json({ success: true, data: {}, message: 'Producto desactivado correctamente' });
  } catch (error) { next(error); }
};