# 📮 COLECCIÓN DE EJEMPLOS PARA POSTMAN

## ⚙️ Configuración inicial en Postman

### Variables de entorno

Crear un *Environment* con las siguientes variables. Las que contienen `{{...}}` se completan automáticamente desde los scripts de respuesta.

| Variable | Valor inicial | Descripción |
|----------|---------------|-------------|
| `BASE_URL` | `http://localhost:3000` | URL local de la API |
| `TOKEN_ADMIN` | *(vacío)* | Token JWT de administrador |
| `TOKEN_CLIENTE` | *(vacío)* | Token JWT de cliente |
| `ID_ADMIN` | *(vacío)* | ID del usuario administrador |
| `ID_CLIENTE` | *(vacío)* | ID del usuario cliente |
| `ID_CATEGORIA` | *(vacío)* | ID de una categoría creada |
| `ID_PRODUCTO` | *(vacío)* | ID de un producto creado |
| `ID_PEDIDO` | *(vacío)* | ID de un pedido creado |

---

## 🧑‍🤝‍🧑 Carpeta 1: Usuarios (`/api/users` o `/api/usuarios`)

### 1.1 Registrar administrador
- **POST** `{{BASE_URL}}/api/users`

Body (JSON):
```json
{
  "nombre": "Admin Principal",
  "email": "admin@ecommerce.com",
  "password": "admin123",
  "telefono": "1134567890",
  "direccion": {
    "calle": "Av. Corrientes 1234",
    "ciudad": "CABA",
    "provincia": "Buenos Aires",
    "codigoPostal": "1043",
    "pais": "Argentina"
  },
  "rol": "admin"
}
```

Script post-respuesta:
```javascript
if (pm.response.code === 201) {
  const json = pm.response.json();
  pm.environment.set('TOKEN_ADMIN', json.data.token);
  pm.environment.set('ID_ADMIN', json.data._id);
}
```

### 1.2 Registrar cliente
- **POST** `{{BASE_URL}}/api/users`

Body (JSON):
```json
{
  "nombre": "Juan Pérez",
  "email": "cliente@ecommerce.com",
  "password": "123456",
  "telefono": "1145678901",
  "direccion": {
    "calle": "Av. Belgrano 567",
    "ciudad": "Buenos Aires",
    "provincia": "Buenos Aires",
    "codigoPostal": "1092",
    "pais": "Argentina"
  }
}
```

Script post-respuesta (similar):
```javascript
if (pm.response.code === 201) {
  const json = pm.response.json();
  pm.environment.set('TOKEN_CLIENTE', json.data.token);
  pm.environment.set('ID_CLIENTE', json.data._id);
}
```

### 1.3 Login
- **POST** `{{BASE_URL}}/api/users/login`

Body:
```json
{
  "email": "admin@ecommerce.com",
  "password": "admin123"
}
```

Script:
```javascript
if (pm.response.code === 200) {
  const json = pm.response.json();
  pm.environment.set('TOKEN_ADMIN', json.data.token);
}
```

### 1.4 Listar usuarios (sólo admin)
- **GET** `{{BASE_URL}}/api/users`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

### 1.5 Buscar usuarios por nombre/email (usa `$or`)
- **GET** `{{BASE_URL}}/api/users/buscar?termino=admin`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

### 1.6 Eliminar usuario y su carrito
- **DELETE** `{{BASE_URL}}/api/users/{{ID_CLIENTE}}`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

---

## 🗂️ Carpeta 2: Categorías (`/api/categorias`)

### 2.1 Crear categoría (admin)
- **POST** `{{BASE_URL}}/api/categorias`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

Body:
```json
{
  "nombre": "Tecnología",
  "descripcion": "Electrónica y gadgets"
}
```

Script post-respuesta:
```javascript
if (pm.response.code === 201) {
  const json = pm.response.json();
  pm.environment.set('ID_CATEGORIA', json.data._id);
}
```

### 2.2 Listar categorías
- **GET** `{{BASE_URL}}/api/categorias`

### 2.3 Estadísticas de categorías (agregación)
- **GET** `{{BASE_URL}}/api/categorias/stats`
- Destacar en la demo: `$lookup`, `$filter`, `$size`, `$sort`.

---

## 🛒 Carpeta 3: Productos (`/api/productos`)

### 3.1 Crear producto (admin)
- **POST** `{{BASE_URL}}/api/productos`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

Body:
```json
{
  "nombre": "Laptop Gamer",
  "descripcion": "Equipo con RTX 4060",
  "precio": 1500,
  "stock": 10,
  "categoria": "{{ID_CATEGORIA}}",
  "marca": "Lenovo"
}
```

Script post-respuesta:
```javascript
if (pm.response.code === 201) {
  const json = pm.response.json();
  pm.environment.set('ID_PRODUCTO', json.data._id);
}
```

### 3.2 Listar productos con categoría
- **GET** `{{BASE_URL}}/api/productos`

### 3.3 Filtro por precio/marca (usa `$and`, `$gte`, `$lte`, `$eq`)
- **GET** `{{BASE_URL}}/api/productos/filtro?precioMin=500&precioMax=2000&marca=Lenovo`

### 3.4 Top productos reseñados (agregación)
- **GET** `{{BASE_URL}}/api/productos/top`

### 3.5 Actualizar stock (admin)
- **PATCH** `{{BASE_URL}}/api/productos/{{ID_PRODUCTO}}/stock`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

Body:
```json
{
  "operacion": "decrementar",
  "stock": 2
}
```

---

## 🛍️ Carpeta 4: Carrito (`/api/carrito`)

Las rutas requieren token del propio usuario (o admin para lectura).

### 4.1 Agregar producto al carrito
- **POST** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

Body:
```json
{
  "productoId": "{{ID_PRODUCTO}}",
  "cantidad": 1
}
```

### 4.2 Ver carrito con productos poblados
- **GET** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

### 4.3 Calcular total (agregación con `$match`, `$unwind`, `$group`, `$multiply`)
- **GET** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}/total`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

### 4.4 Actualizar cantidad
- **PUT** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}/item/{{ID_PRODUCTO}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

Body:
```json
{
  "cantidad": 2
}
```

### 4.5 Eliminar producto del carrito
- **DELETE** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}/item/{{ID_PRODUCTO}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

### 4.6 Vaciar carrito
- **DELETE** `{{BASE_URL}}/api/carrito/{{ID_CLIENTE}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

---

## 📦 Carpeta 5: Pedidos (`/api/ordenes`)

### 5.1 Crear pedido desde carrito
- **POST** `{{BASE_URL}}/api/ordenes`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

Body mínimo:
```json
{
  "metodoPago": "tarjeta"
}
```

Script post-respuesta:
```javascript
if (pm.response.code === 201) {
  const json = pm.response.json();
  pm.environment.set('ID_PEDIDO', json.data._id);
}
```

### 5.2 Ver todos los pedidos (admin)
- **GET** `{{BASE_URL}}/api/ordenes`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

### 5.3 Estadísticas (agregación con `$group`, `$sum`, `$avg`, `$count`)
- **GET** `{{BASE_URL}}/api/ordenes/stats`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

### 5.4 Pedidos de un usuario (control propietario)
- **GET** `{{BASE_URL}}/api/ordenes/user/{{ID_CLIENTE}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

### 5.5 Cambiar estado del pedido (admin)
- **PATCH** `{{BASE_URL}}/api/ordenes/{{ID_PEDIDO}}/status`
- Headers: `Authorization: Bearer {{TOKEN_ADMIN}}`

Body:
```json
{
  "estado": "enviado"
}
```

### 5.6 Cancelar pedido (cliente o admin)
- **DELETE** `{{BASE_URL}}/api/ordenes/{{ID_PEDIDO}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

---

## ⭐ Carpeta 6: Reseñas (`/api/resenas`)

### 6.1 Crear reseña (sólo si compró el producto)
- **POST** `{{BASE_URL}}/api/resenas`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

Body:
```json
{
  "producto": "{{ID_PRODUCTO}}",
  "calificacion": 5,
  "comentario": "Excelente producto"
}
```

### 6.2 Listar todas las reseñas (con datos de usuario y producto)
- **GET** `{{BASE_URL}}/api/resenas`

### 6.3 Reseñas de un producto + estadísticas (usa `$group`, `$cond`)
- **GET** `{{BASE_URL}}/api/resenas/product/{{ID_PRODUCTO}}`

### 6.4 Top productos por calificación (agregación completa)
- **GET** `{{BASE_URL}}/api/resenas/top`

### 6.5 Mis reseñas
- **GET** `{{BASE_URL}}/api/resenas/me/all`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

### 6.6 Actualizar reseña
- **PUT** `{{BASE_URL}}/api/resenas/{{ID_RESEÑA}}`
- Headers: `Authorization: Bearer {{TOKEN_CLIENTE}}`

---

## 🧪 Scripts y tests sugeridos

### Verificar expiración del token
1. Cambiar `JWT_EXPIRES_IN=1s` en `config.env` y reiniciar servidor.
2. Hacer login, copiar token.
3. Esperar unos segundos y llamar a ruta protegida. Respuesta esperada:
```json
{
  "success": false,
  "error": "Token expirado. Por favor, inicie sesión nuevamente."
}
```

### Intentar acceso con rol incorrecto
- Usar `TOKEN_CLIENTE` en `GET /api/ordenes/stats`. Respuesta:
```json
{
  "success": false,
  "error": "El rol 'cliente' no tiene permiso para acceder a este recurso"
}
```

### Intentar reseña sin compra previa
- Crear reseña de producto no comprado.
- Se crea con `verificado: false` y se explica en la demostración.

---

## ✅ Checklist Postman
- [ ] Environment creado y seleccionado.
- [ ] Tokens se guardan automáticamente en variables.
- [ ] Colección separada por carpetas según cada modelo.
- [ ] Scripts post-respuesta completan IDs y tokens.
- [ ] Tests de expiración y permisos realizados.

