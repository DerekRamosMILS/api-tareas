# Consultas a inteligencia artificial

La actividad pide consultar una IA en tres momentos: un servidor de Express con manejo de errores, la lectura y escritura con `fs.promises`, y el uso de bcryptjs con JWT para `/register` y `/login`. La IA consultada fue **Claude (Anthropic)**. Aquí se registra qué se preguntó, el ejemplo que dio y qué se adaptó o se corrigió, con su porqué.

---

## 1. Servidor básico de Express con manejo de errores

**Pregunta:** «Dame un ejemplo básico de configuración de un servidor con Express.js que escuche en el puerto 3000 e incluya manejo de errores».

**Ejemplo de la IA:**

```js
const express = require('express');
const app = express();
app.use(express.json());

app.get('/', (req, res) => res.send('API funcionando'));

// 404
app.use((req, res) => res.status(404).json({ error: 'Ruta no encontrada' }));

// Manejador de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Algo salió mal' });
});

app.listen(3000, () => console.log('Servidor en http://localhost:3000'));
```

**Qué se adaptó:**

| Del ejemplo | En la API de tareas | Por qué |
|---|---|---|
| Todo error termina en 500 «Algo salió mal» | Clase `ErrorHttp` con el código correcto: 400, 401, 403, 404, 405, 409, 413, 429 y 500 | El cliente debe saber si el error es suyo (4xx) o del servidor (5xx) |
| Un JSON mal formado también da 500 | Se detecta `err.type === 'entity.parse.failed'` de body-parser y se responde 400 | Es un error del cliente, no del servidor |
| Mensaje genérico | Formato único `{ error: { estado, mensaje, detalles } }` con el detalle por campo | Mensajes claros, como pide la rúbrica |
| `express.json()` | `body-parser.json({ limit: '10kb' })` | La actividad pide body-parser; el límite evita cuerpos enormes (413) |
| Sin bitácora | Middleware `bitacora` con método, ruta, código, milisegundos y usuario | Primera herramienta de depuración con console.log |
| `app.listen(3000)` fijo | `http.createServer(app)` con `PORT` desde `.env`, aviso si el puerto está ocupado y cierre ordenado con Ctrl + C | Usa el módulo `http` de Node y evita errores confusos al arrancar |
| `console.error(err.stack)` y nada más | El stack se imprime en la consola, pero al cliente nunca se le envía | No se exponen rutas internas ni detalles del servidor |
| — | Respuesta 405 para métodos no permitidos y encabezado `WWW-Authenticate` en los 401 | Códigos HTTP más precisos |

---

## 2. Lectura y escritura con fs.promises

**Pregunta:** «Dame un ejemplo básico para leer y escribir un archivo JSON de tareas con fs.promises en Node.js».

**Ejemplo de la IA:**

```js
const fs = require('fs').promises;
const ARCHIVO = './tareas.json';

async function leerTareas() {
  try {
    const datos = await fs.readFile(ARCHIVO, 'utf8');
    return JSON.parse(datos);
  } catch (error) {
    return [];
  }
}

async function guardarTareas(tareas) {
  await fs.writeFile(ARCHIVO, JSON.stringify(tareas, null, 2));
}
```

**Qué se adaptó:**

| Del ejemplo | En la API de tareas (`src/datos/ArchivoJson.js`) | Por qué |
|---|---|---|
| Cualquier error devuelve `[]` | Solo si el archivo no existe (`ENOENT`) se crea vacío; si el JSON está dañado se lanza un error claro que termina en 500 | Si el archivo se daña, devolver `[]` y guardar encima **borraría todas las tareas** sin avisar |
| `writeFile` directo sobre el archivo | Se escribe en `tareas.json.tmp` y luego `fs.rename` | Si el proceso se cae a la mitad, el archivo original queda intacto |
| Leer, modificar y guardar por separado | Método `modificar()` que pone las escrituras en fila con una cadena de promesas | Dos peticiones simultáneas no se pisan; la prueba crea 10 tareas en paralelo y no se pierde ninguna |
| Ruta relativa `./tareas.json` | `path.join` desde `config.js`, con `DATA_DIR` opcional | Funciona sin importar desde qué carpeta se ejecute; las pruebas usan una carpeta temporal |
| Funciones sueltas para un solo archivo | Una clase reutilizada para `tareas.json` y `usuarios.json` | Modularidad: el mismo código sirve para los dos archivos |
| — | Nada usa `readFileSync` ni `writeFileSync` | Las versiones síncronas bloquean el Event Loop y detendrían a todos los usuarios mientras se lee el disco |

---

## 3. bcryptjs y JWT para /register y /login

**Pregunta:** «Dame un ejemplo práctico para encriptar contraseñas con bcryptjs y generar tokens con jsonwebtoken en las rutas /register y /login de Express, con un middleware que proteja rutas».

**Ejemplo de la IA:**

```js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const SECRETO = 'mi_secreto';
const usuarios = [];

app.post('/register', async (req, res) => {
  const { username, password } = req.body;
  const hash = await bcrypt.hash(password, 10);
  usuarios.push({ username, password: hash });
  res.status(201).json({ mensaje: 'Usuario registrado' });
});

app.post('/login', async (req, res) => {
  const { username, password } = req.body;
  const usuario = usuarios.find((u) => u.username === username);
  if (!usuario) return res.status(404).json({ error: 'Usuario no encontrado' });
  const valido = await bcrypt.compare(password, usuario.password);
  if (!valido) return res.status(401).json({ error: 'Contraseña incorrecta' });
  const token = jwt.sign({ username }, SECRETO, { expiresIn: '1h' });
  res.json({ token });
});

function verificarToken(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(403).json({ error: 'Token requerido' });
  jwt.verify(token, SECRETO, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token inválido' });
    req.user = decoded;
    next();
  });
}
```

**Qué se adaptó:**

| Del ejemplo | En la API de tareas | Por qué |
|---|---|---|
| `SECRETO = 'mi_secreto'` en el código | `JWT_SECRET` en `.env` (fuera de GitHub), mínimo 32 caracteres | Con el secreto publicado cualquiera podría fabricar tokens |
| Usuarios en un arreglo en memoria | `data/usuarios.json` con `fs.promises`; solo se guarda `passwordHash` | Los usuarios no se pierden al reiniciar y la contraseña nunca se guarda |
| «Usuario no encontrado» (404) y «Contraseña incorrecta» (401) | Siempre 401 «Usuario o contraseña incorrectos» y comparación contra un hash de relleno | No revela qué usuarios existen, ni por el mensaje ni por el tiempo de respuesta |
| Sin token → 403 | Sin token o token inválido → **401**; token válido pero sin permiso → **403** | 401 = no sé quién eres; 403 = sé quién eres pero no puedes |
| Registro sin validar ni revisar duplicados | `validarRegistro` (usuario y contraseña segura) y 409 si el usuario ya existe | Evita contraseñas débiles y cuentas repetidas |
| `jwt.verify` sin opciones | Se fijan `algorithms: ['HS256']` y `issuer: 'api-tareas'` | Rechaza tokens firmados de otra forma o por otro sistema |
| No hay cierre de sesión | Cada token lleva un `jti`; `POST /logout` lo invalida | La «sesión» se puede terminar antes de que expire |
| Intentos ilimitados | 5 fallos en 15 minutos por IP → 429 con `Retry-After` | Frena ataques de fuerza bruta |
| Cualquier usuario autenticado podría editar todo | PUT y DELETE solo para quien creó la tarea (403 para los demás) | Protección de los datos de cada usuario |
