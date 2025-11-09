const express = require('express');
const router = express.Router();
const {
  crearCategoria,
  obtenerCategorias,
  obtenerCategoria,
  obtenerEstadisticasCategorias,
  actualizarCategoria,
  eliminarCategoria
} = require('../controllers/categoriaController');
const { protegerRuta, verificarRol } = require('../middleware/auth');

// Rutas públicas
router.get('/', obtenerCategorias);
router.get('/stats', obtenerEstadisticasCategorias);
router.get('/:id', obtenerCategoria);

// Rutas protegidas (Admin)
router.post('/', protegerRuta, verificarRol('admin'), crearCategoria);
router.put('/:id', protegerRuta, verificarRol('admin'), actualizarCategoria);
router.delete('/:id', protegerRuta, verificarRol('admin'), eliminarCategoria);

module.exports = router;

