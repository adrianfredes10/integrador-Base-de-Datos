const express = require('express');
const router = express.Router();
const {
  crearProducto,
  obtenerProductos,
  obtenerProducto,
  filtrarProductos,
  productosTopResenas,
  actualizarStock,
  actualizarProducto,
  eliminarProducto
} = require('../controllers/productoController');
const { protegerRuta, verificarRol } = require('../middleware/auth');

// Rutas públicas
router.get('/', obtenerProductos);
router.get('/filtro', filtrarProductos);
router.get('/top', productosTopResenas);
router.get('/:id', obtenerProducto);

// Rutas protegidas (Admin)
router.post('/', protegerRuta, verificarRol('admin'), crearProducto);
router.put('/:id', protegerRuta, verificarRol('admin'), actualizarProducto);
router.patch('/:id/stock', protegerRuta, verificarRol('admin'), actualizarStock);
router.delete('/:id', protegerRuta, verificarRol('admin'), eliminarProducto);

module.exports = router;

