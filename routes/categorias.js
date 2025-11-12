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

// Públicas
router.get('/', obtenerCategorias);

// Protegidas (admin)
router.get('/stats', protegerRuta, verificarRol('admin'), obtenerEstadisticasCategorias);

router.get('/:id', obtenerCategoria); // <-- SIEMPRE después de /stats

router.post('/', protegerRuta, verificarRol('admin'), crearCategoria);
router.put('/:id', protegerRuta, verificarRol('admin'), actualizarCategoria);
router.delete('/:id', protegerRuta, verificarRol('admin'), eliminarCategoria);

module.exports = router;