const express = require('express');
const router = express.Router();
const {
  crearResena,
  obtenerResenas,
  obtenerResena,
  obtenerResenasPorProducto,
  obtenerTopCalificaciones,
  actualizarResena,
  eliminarResena,
  obtenerMisResenas
} = require('../controllers/resenaController');
const { protegerRuta } = require('../middleware/auth');

// Rutas públicas
router.get('/', obtenerResenas);
router.get('/top', obtenerTopCalificaciones);
router.get('/product/:productId', obtenerResenasPorProducto);
router.get('/:id', obtenerResena);

// Rutas protegidas
router.post('/', protegerRuta, crearResena);
router.get('/me/all', protegerRuta, obtenerMisResenas);
router.put('/:id', protegerRuta, actualizarResena);
router.delete('/:id', protegerRuta, eliminarResena);

module.exports = router;

