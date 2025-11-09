const Usuario = require('../models/Usuario');
const Carrito = require('../models/Carrito');
const { generarToken } = require('../middleware/auth');

// @desc    Registrar nuevo usuario
// @route   POST /api/users
// @access  Público
exports.registrarUsuario = async (req, res, next) => {
  try {
    const { nombre, email, password, telefono, direccion, rol } = req.body;

    // Validar campos requeridos
    if (!nombre || !email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporcione nombre, email y contraseña'
      });
    }

    // Crear usuario
    const usuario = await Usuario.create({
      nombre,
      email,
      password,
      telefono,
      direccion,
      rol: rol || 'cliente'
    });

    // Crear carrito para el usuario
    await Carrito.create({ usuario: usuario._id });

    // Generar token
    const token = generarToken(usuario._id);

    res.status(201).json({
      success: true,
      data: {
        _id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        token
      }
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Login de usuario
// @route   POST /api/users/login
// @access  Público
exports.loginUsuario = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validar email y password
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Por favor proporcione email y contraseña'
      });
    }

    // Buscar usuario con password
    const usuario = await Usuario.findOne({ email }).select('+password');

    if (!usuario) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Verificar password
    const passwordCorrecto = await usuario.compararPassword(password);

    if (!passwordCorrecto) {
      return res.status(401).json({
        success: false,
        error: 'Credenciales inválidas'
      });
    }

    // Generar token
    const token = generarToken(usuario._id);

    res.status(200).json({
      success: true,
      data: {
        _id: usuario._id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        token
      }
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
    // Usar operador $ne para excluir campos sensibles
    const usuarios = await Usuario.find({ activo: { $ne: false } })
      .select('-password')
      .sort('-createdAt');

    res.status(200).json({
      success: true,
      count: usuarios.length,
      data: usuarios
    });
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

    if (!termino || termino.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Proporcione un término de búsqueda'
      });
    }

    const regex = new RegExp(termino.trim(), 'i');

    const usuarios = await Usuario.find({
      activo: { $ne: false },
      $or: [
        { nombre: { $regex: regex } },
        { email: { $regex: regex } }
      ]
    })
      .select('nombre email rol telefono direccion')
      .sort('nombre');

    res.status(200).json({
      success: true,
      count: usuarios.length,
      data: usuarios
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Obtener usuario por ID
// @route   GET /api/users/:id
// @access  Privado
exports.obtenerUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id).select('-password');

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Verificar que el usuario pueda ver su propia info o sea admin
    if (usuario._id.toString() !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para ver este usuario'
      });
    }

    res.status(200).json({
      success: true,
      data: usuario
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Actualizar usuario
// @route   PUT /api/users/:id
// @access  Privado
exports.actualizarUsuario = async (req, res, next) => {
  try {
    const { password, email, rol, ...datosPermitidos } = req.body;

    // Solo admin puede cambiar rol
    if (rol && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para cambiar el rol'
      });
    }

    // Verificar que el usuario pueda actualizar su propia info o sea admin
    if (req.params.id !== req.usuario._id.toString() && req.usuario.rol !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'No autorizado para actualizar este usuario'
      });
    }

    const datosActualizar = { ...datosPermitidos };
    if (rol && req.usuario.rol === 'admin') {
      datosActualizar.rol = rol;
    }

    const usuario = await Usuario.findByIdAndUpdate(
      req.params.id,
      { $set: datosActualizar }, // Usar operador $set
      {
        new: true,
        runValidators: true
      }
    ).select('-password');

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    res.status(200).json({
      success: true,
      data: usuario
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Eliminar usuario y su carrito
// @route   DELETE /api/users/:id
// @access  Privado/Admin
exports.eliminarUsuario = async (req, res, next) => {
  try {
    const usuario = await Usuario.findById(req.params.id);

    if (!usuario) {
      return res.status(404).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    // Eliminar carrito del usuario
    await Carrito.deleteOne({ usuario: req.params.id });

    // Eliminar usuario
    await usuario.deleteOne();

    res.status(200).json({
      success: true,
      data: {},
      message: 'Usuario y carrito eliminados correctamente'
    });
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

    res.status(200).json({
      success: true,
      data: usuario
    });
  } catch (error) {
    next(error);
  }
};

