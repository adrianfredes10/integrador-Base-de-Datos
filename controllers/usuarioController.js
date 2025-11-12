const { Types } = require('mongoose');
const Usuario = require('../models/Usuario');
const Carrito = require('../models/Carrito');
const { generarToken } = require('../middleware/auth');

// Helper
const asObjectId = (val) => {
  if (!val) return null;
  if (val instanceof Types.ObjectId) return val;
  return Types.ObjectId.isValid(val) ? new Types.ObjectId(val) : null;
};

// @desc    Registrar nuevo usuario
// @route   POST /api/users
// @access  Público
exports.registrarUsuario = async (req, res, next) => {
  try {
    const { nombre, email, password, telefono, direccion, rol } = req.body;

    if (!nombre || !email || !password) {
      return res.status(400).json({ success: false, error: 'Por favor proporcione nombre, email y contraseña' });
    }

    const emailNorm = String(email).trim().toLowerCase();
    const existe = await Usuario.findOne({ email: emailNorm });
    if (existe) {
      return res.status(400).json({ success: false, error: 'El email ya existe en la base de datos' });
    }

    const usuario = await Usuario.create({
      nombre,
      email: emailNorm,
      password,
      telefono,
      direccion,
      rol: rol || 'cliente'
    });

    await Carrito.create({ usuario: usuario._id });
    const token = generarToken(usuario._id);

    res.status(201).json({
      success: true,
      data: { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, token }
    });
  } catch (error) {
    if (error?.code === 11000) {
      return res.status(400).json({ success: false, error: 'El email ya existe en la base de datos' });
    }
    next(error);
  }
};

// @desc    Login de usuario
// @route   POST /api/users/login
// @access  Público
exports.loginUsuario = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Por favor proporcione email y contraseña' });
    }

    const usuario = await Usuario.findOne({ email: email.toLowerCase() }).select('+password');
    if (!usuario) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const valido = await usuario.compararPassword(password);
    if (!valido) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = generarToken(usuario._id);
    res.status(200).json({
      success: true,
      data: { _id: usuario._id, nombre: usuario.nombre, email: usuario.email, rol: usuario.rol, token }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener todos los usuarios
// @route   GET /api/users
// @access  Privado/Admin
exports.obtenerUsuarios = async (req, res, next) => {
  try {
    const usuarios = await Usuario.find({ activo: { $ne: false } })
      .select('-password')
      .sort('-createdAt');

    res.status(200).json({ success: true, count: usuarios.length, data: usuarios });
  } catch (error) {
    next(error);
  }
};

// @desc    Buscar usuarios por nombre o email
// @route   GET /api/users/buscar?termino=valor
// @access  Privado/Admin
exports.buscarUsuarios = async (req, res, next) => {
  try {
    const { termino } = req.query;
    if (!termino || !termino.trim()) {
      return res.status(400).json({ success: false, error: 'Proporcione un término de búsqueda' });
    }

    const regex = new RegExp(termino.trim(), 'i');
    const usuarios = await Usuario.find({
      activo: { $ne: false },
      $or: [{ nombre: { $regex: regex } }, { email: { $regex: regex } }]
    })
      .select('nombre email rol telefono direccion')
      .sort('nombre');

    res.status(200).json({ success: true, count: usuarios.length, data: usuarios });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener usuario por ID
// @route   GET /api/users/:id
// @access  Privado
exports.obtenerUsuario = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const usuario = await Usuario.findById(id).select('-password');
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    if (usuario._id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para ver este usuario' });
    }

    res.status(200).json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar usuario
// @route   PUT /api/users/:id
// @access  Privado
exports.actualizarUsuario = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const { password, email, rol, ...otros } = req.body;
    if (rol && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para cambiar el rol' });
    }
    if (id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({ success: false, error: 'No autorizado para actualizar este usuario' });
    }

    const datos = { ...otros };
    if (rol && req.usuario.rol === 'admin') datos.rol = rol;

    const usuario = await Usuario.findByIdAndUpdate(id, { $set: datos }, { new: true, runValidators: true })
      .select('-password');

    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    res.status(200).json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar usuario y su carrito
// @route   DELETE /api/users/:id
// @access  Privado/Admin
exports.eliminarUsuario = async (req, res, next) => {
  try {
    const id = asObjectId(req.params.id);
    if (!id) return res.status(400).json({ success: false, error: 'ID inválido' });

    const usuario = await Usuario.findById(id);
    if (!usuario) return res.status(404).json({ success: false, error: 'Usuario no encontrado' });

    await Carrito.deleteOne({ usuario: id });
    await usuario.deleteOne();

    res.status(200).json({ success: true, data: {}, message: 'Usuario y carrito eliminados correctamente' });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener perfil del usuario actual
// @route   GET /api/users/me
// @access  Privado
exports.obtenerPerfil = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.usuario._id).select('-password');
    res.status(200).json({ success: true, data: usuario });
  } catch (error) {
    next(error);
  }
};