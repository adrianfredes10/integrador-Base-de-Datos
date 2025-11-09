// Middleware global para manejo de errores
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log del error en consola (para desarrollo)
  console.error('Error:', err);

  // Error de Mongoose: ID mal formateado
  if (err.name === 'CastError') {
    const message = 'Recurso no encontrado. ID inválido.';
    error = { message, statusCode: 404 };
  }

  // Error de Mongoose: duplicado (código 11000)
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    const message = `El ${field} ya existe en la base de datos`;
    error = { message, statusCode: 400 };
  }

  // Error de Mongoose: validación
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message).join(', ');
    error = { message, statusCode: 400 };
  }

  res.status(error.statusCode || 500).json({
    success: false,
    error: error.message || 'Error del servidor'
  });
};

module.exports = errorHandler;

