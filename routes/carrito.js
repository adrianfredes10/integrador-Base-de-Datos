const express = require('express');
const router = express.Router();
const {
  obtenerCarrito,
  calcularTotalCarrito,
  agregarAlCarrito,
  actualizarItemCarrito,
  eliminarDelCarrito,
  vaciarCarrito
} = require('../controllers/carritoController');
const { protegerRuta } = require('../middleware/auth');

// Todas las rutas de carrito requieren autenticación
router.get('/:usuarioId', protegerRuta, obtenerCarrito);
router.get('/:usuarioId/total', protegerRuta, calcularTotalCarrito);
router.post('/:usuarioId', protegerRuta, agregarAlCarrito);
router.put('/:usuarioId/item/:productoId', protegerRuta, actualizarItemCarrito);
router.delete('/:usuarioId/item/:productoId', protegerRuta, eliminarDelCarrito);
router.delete('/:usuarioId', protegerRuta, vaciarCarrito);

module.exports = router;

