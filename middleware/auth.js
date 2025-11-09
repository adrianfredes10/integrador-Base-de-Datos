const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');

// Middleware para verificar token JWT
exports.protegerRuta = async (req, res, next) => {
  let token;

  // Verificar si el token viene en el header Authorization
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Verificar si el token existe
  if (!token) {
    return res.status(401).json({
      success: false,
      error: 'No autorizado. Token no proporcionado.'
    });
  }

  try {
    // Verificar token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Obtener usuario del token
    req.usuario = await Usuario.findById(decoded.id);

    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no encontrado'
      });
    }

    if (!req.usuario.activo) {
      return res.status(401).json({
        success: false,
        error: 'Usuario inactivo'
      });
    }

    next();
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expirado. Por favor, inicie sesión nuevamente.'
      });
    }
    
    return res.status(401).json({
      success: false,
      error: 'Token inválido'
    });
  }
};

// Middleware para verificar roles
exports.verificarRol = (...roles) => {
  return (req, res, next) => {
    if (!req.usuario) {
      return res.status(401).json({
        success: false,
        error: 'Usuario no autenticado'
      });
    }

    if (!roles.includes(req.usuario.rol)) {
      return res.status(403).json({
        success: false,
        error: `El rol '${req.usuario.rol}' no tiene permiso para acceder a este recurso`
      });
    }

    next();
  };
};

// Función para generar token JWT
exports.generarToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN
  });
};

