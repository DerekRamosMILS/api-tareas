# API de Tareas · Node.js + Express

API RESTful para una lista de tareas (*to-do list*). Guarda los datos en archivos JSON con `fs.promises`, protege las rutas con **JWT**, encripta las contraseñas con **bcryptjs** y responde todos los errores con el mismo formato JSON y su código HTTP.

Actividad 3 · Desarrollo Full Stack · Universidad Tecmilenio
Derek Joan Ramos del Ángel · AL07195561

## Tecnologías

| Paquete | Para qué se usa |
|---|---|
| `express` 5 | Servidor, rutas y middlewares |
| `body-parser` | Convierte el cuerpo JSON de la petición en `req.body` |
| `jsonwebtoken` | Firma y verifica los tokens de sesión (HS256, vigencia de 1 h) |
| `bcryptjs` | Hash de contraseñas con sal (10 rondas) |
| `node:fs/promises` | Lectura y escritura asíncrona de `tareas.json` y `usuarios.json` |
| `node:http` | Crea el servidor HTTP que atiende a la aplicación de Express |

## Estructura

```
api-tareas/
├── server.js                       Configuración, todas las rutas y la cadena de autenticación
├── src/
│   ├── config.js                   Puerto, secreto JWT y rutas de los archivos (lee .env)
│   ├── controladores/
│   │   ├── auth.controlador.js     /register, /login, /perfil, /logout
│   │   └── tareas.controlador.js   CRUD de /tareas
│   ├── datos/
│   │   ├── ArchivoJson.js          fs.promises: leer, escribir (atómico) y modificar en fila
│   │   ├── tareas.modelo.js        Operaciones sobre data/tareas.json
│   │   └── usuarios.modelo.js      Operaciones sobre data/usuarios.json
│   ├── middleware/
│   │   ├── autenticacion.js        verificarToken, sesiones cerradas, límite de intentos
│   │   ├── validacion.js           validarTarea, validarId, validarFiltros, validarRegistro, validarLogin
│   │   ├── errores.js              404, 405 y manejador central de errores
│   │   └── bitacora.js             console.log de cada petición
│   └── utils/ErrorHttp.js          Error con código HTTP
├── data/
│   ├── tareas.json                 Tareas guardadas por la API
│   └── usuarios.json               Usuarios con contraseña encriptada (se crea solo; no se sube a GitHub)
├── public/index.html               Consola de pruebas en el navegador
├── pruebas/probar-api.js           Prueba automática (npm test)
├── docs/consultas-ia.md            Las tres consultas a IA y qué se adaptó
├── .vscode/launch.json             Depuración con --inspect desde VS Code
└── .env.example                    Plantilla de variables de entorno
```

## Cómo ejecutarla

Requisitos: Node.js 22.9 o superior.

```bash
git clone https://github.com/DerekRamosMILS/api-tareas.git
cd api-tareas
npm install
cp .env.example .env      # cambia JWT_SECRET por uno largo y aleatorio
npm start                 # http://localhost:3000
```

| Script | Qué hace |
|---|---|
| `npm start` | Inicia la API en el puerto 3000 |
| `npm run dev` | Igual, pero se reinicia sola al guardar cambios (`node --watch`) |
| `npm run debug` | Inicia con `node --inspect` para depurar con VS Code o Chrome DevTools |
| `npm test` | Prueba automática de 34 casos en una carpeta temporal (no toca tus datos) |

Al abrir http://localhost:3000 aparece una **consola de pruebas**: permite registrarse, iniciar sesión y enviar cualquier petición a la API viendo el código HTTP y el JSON de respuesta.

## Rutas

Las rutas de tareas exigen el encabezado `Authorization: Bearer <token>` que devuelve `/login`.

| Método | Ruta | Acceso | Descripción | Códigos |
|---|---|---|---|---|
| POST | `/register` | Público | Registra un usuario `{ usuario, password }` | 201, 400, 409 |
| POST | `/login` | Público | Devuelve el token JWT (máx. 5 fallos en 15 min) | 200, 400, 401, 429 |
| GET | `/perfil` | Token | Usuario y vigencia de la sesión | 200, 401 |
| POST | `/logout` | Token | Cierra la sesión: el token deja de servir | 200, 401 |
| GET | `/tareas` | Token | Todas las tareas; filtros `?completada=true`, `?q=texto`, `?mias=true` | 200, 400, 401 |
| GET | `/tareas/:id` | Token | Una tarea | 200, 400, 401, 404 |
| POST | `/tareas` | Token | Crea `{ titulo, descripcion, completada? }` | 201, 400, 401 |
| PUT | `/tareas/:id` | Token (autor) | Actualiza uno o más campos | 200, 400, 401, 403, 404 |
| DELETE | `/tareas/:id` | Token (autor) | Elimina la tarea | 200, 400, 401, 403, 404 |
| GET | `/salud` | Público | Estado del servidor | 200 |

Cualquier otra ruta responde **404** y un método que no corresponde (por ejemplo `PATCH /tareas/1`) responde **405**.

### Ejemplos con curl

```bash
curl -X POST http://localhost:3000/register -H "Content-Type: application/json" \
     -d '{"usuario":"ana","password":"Tareas2026"}'

curl -X POST http://localhost:3000/login -H "Content-Type: application/json" \
     -d '{"usuario":"ana","password":"Tareas2026"}'          # copia el "token" de la respuesta

curl -X POST http://localhost:3000/tareas -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" \
     -d '{"titulo":"Estudiar Express","descripcion":"Repasar middlewares y rutas"}'

curl -X PUT http://localhost:3000/tareas/1 -H "Authorization: Bearer <token>" \
     -H "Content-Type: application/json" -d '{"completada":true}'

curl -X DELETE http://localhost:3000/tareas/1 -H "Authorization: Bearer <token>"
```

### Formato de los errores

```json
{
  "error": {
    "estado": 400,
    "mensaje": "Los datos de la tarea no son válidos.",
    "detalles": { "titulo": "El título es obligatorio y debe tener entre 3 y 100 caracteres." }
  }
}
```

## Depuración

- **console.log:** el middleware `bitacora` imprime cada petición con su código y tiempo; los errores 500 se imprimen completos con `console.error`.
- **--inspect:** `npm run debug` abre el inspector en el puerto 9229. En VS Code, en *Ejecutar y depurar*, elige **Adjuntar a npm run debug** y coloca puntos de interrupción; también funciona desde `chrome://inspect` en Chrome.

---
Proyecto académico.
