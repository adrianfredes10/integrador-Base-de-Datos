const express = require('express');
const router = express.Router();
const {
  registrarUsuario,
  loginUsuario,
  obtenerUsuarios,
  buscarUsuarios,
  obtenerUsuario,
  actualizarUsuario,
  eliminarUsuario,
  obtenerPerfil
} = require('../controllers/usuarioController');
const { protegerRuta, verificarRol } = require('../middleware/auth');

// Rutas públicas
router.post('/', registrarUsuario);
router.post('/login', loginUsuario);

// Rutas protegidas
router.get('/me', protegerRuta, obtenerPerfil);
router.get('/', protegerRuta, verificarRol('admin'), obtenerUsuarios);
router.get('/buscar', protegerRuta, verificarRol('admin'), buscarUsuarios);
router.get('/:id', protegerRuta, obtenerUsuario);
router.put('/:id', protegerRuta, actualizarUsuario);
router.delete('/:id', protegerRuta, verificarRol('admin'), eliminarUsuario);

module.exports = router;

