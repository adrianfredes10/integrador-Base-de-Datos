const express = require('express');
const router = express.Router();
const {
  crearPedido,
  obtenerPedidos,
  obtenerPedido,
  obtenerEstadisticasPedidos,
  obtenerPedidosUsuario,
  actualizarEstadoPedido,
  cancelarPedido
} = require('../controllers/pedidoController');
const { protegerRuta, verificarRol } = require('../middleware/auth');

// Rutas protegidas (requieren autenticación)
router.post('/', protegerRuta, crearPedido);
router.get('/', protegerRuta, verificarRol('admin'), obtenerPedidos);
router.get('/stats', protegerRuta, verificarRol('admin'), obtenerEstadisticasPedidos);
router.get('/user/:userId', protegerRuta, obtenerPedidosUsuario);
router.get('/:id', protegerRuta, obtenerPedido);
router.patch('/:id/status', protegerRuta, verificarRol('admin'), actualizarEstadoPedido);
router.delete('/:id', protegerRuta, cancelarPedido);

module.exports = router;

