const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Cargar variables de entorno
dotenv.config({ path: './config.env' });

// Conectar a la base de datos
connectDB();

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rutas
app.use('/api/users', require('./routes/usuarios'));
app.use('/api/usuarios', require('./routes/usuarios'));
app.use('/api/productos', require('./routes/productos'));
app.use('/api/categorias', require('./routes/categorias'));
app.use('/api/carrito', require('./routes/carrito'));
app.use('/api/ordenes', require('./routes/pedidos'));
app.use('/api/resenas', require('./routes/resenas'));

// Ruta de bienvenida
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'API E-commerce - Base de Datos 2 UTN',
    version: '1.0.0',
    endpoints: {
      usuarios: '/api/users',
      productos: '/api/productos',
      categorias: '/api/categorias',
      carrito: '/api/carrito',
      pedidos: '/api/ordenes',
      resenas: '/api/resenas'
    }
  });
});

// Middleware de manejo de errores JWT
app.use((err, req, res, next) => {
  if (err?.name === 'TokenExpiredError') {
    return res.status(401).json({
      success: false,
      error: 'jwt expired'
    });
  }

  if (err?.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      error: 'jwt invalid'
    });
  }

  console.error(err);
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Error interno del servidor'
  });
});


const PORT = process.env.PORT || 3000;

const server = app.listen(PORT, () => {
  console.log(`
Servidor corriendo en modo ${process.env.NODE_ENV || 'development'}
Puerto: ${PORT}
URL: http://localhost:${PORT}
  `);
});

// Manejo de rechazos de promesas no manejadas
process.on('unhandledRejection', (err, promise) => {
  console.log(`Error: ${err.message}`);
  server.close(() => process.exit(1));
});

module.exports = app;

