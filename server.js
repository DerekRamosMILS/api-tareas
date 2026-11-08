// API RESTful de tareas · Actividad 3 · Desarrollo Full Stack (Universidad Tecmilenio)
// Este archivo reúne la configuración del servidor, todas las rutas y la cadena de autenticación.
// La lógica de cada parte vive en src/ (controladores, middlewares y acceso a los archivos JSON).
const http = require('node:http');
const path = require('node:path');
const express = require('express');
const bodyParser = require('body-parser');

const config = require('./src/config');
const bitacora = require('./src/middleware/bitacora');
const { verificarToken, limitarIntentos } = require('./src/middleware/autenticacion');
const { validarId, validarTarea, validarFiltros, validarRegistro, validarLogin } = require('./src/middleware/validacion');
const { rutaNoEncontrada, metodoNoPermitido, manejadorErrores } = require('./src/middleware/errores');
const auth = require('./src/controladores/auth.controlador');
const tareas = require('./src/controladores/tareas.controlador');
const Tareas = require('./src/datos/tareas.modelo');
const Usuarios = require('./src/datos/usuarios.modelo');

const app = express();
app.disable('x-powered-by');

// ---------- Middlewares generales ----------
app.use(express.static(path.join(__dirname, 'public')));   // consola de pruebas en http://localhost:3000
app.use(bitacora);                                         // console.log de cada petición (antes de body-parser,
                                                           // para que también se registren los JSON mal formados)
app.use(bodyParser.json({ limit: '10kb' }));               // convierte el cuerpo JSON en req.body

// ---------- Rutas públicas ----------
app.get('/salud', async (req, res) => {
  res.json({ estado: 'ok', tareas: await Tareas.contar(), usuarios: await Usuarios.contar(), activoDesde: inicio });
});
app.post('/register', validarRegistro, auth.registrar);
app.post('/login', limitarIntentos(), validarLogin, auth.iniciarSesion);

// ---------- Sesión (requiere token) ----------
app.get('/perfil', verificarToken, auth.perfil);
app.post('/logout', verificarToken, auth.cerrarSesion);

// ---------- CRUD de tareas (todas requieren token) ----------
app.get('/tareas', verificarToken, validarFiltros, tareas.listar);
app.get('/tareas/:id', verificarToken, validarId, tareas.obtener);
app.post('/tareas', verificarToken, validarTarea(), tareas.crear);
app.put('/tareas/:id', verificarToken, validarId, validarTarea({ parcial: true }), tareas.actualizar);
app.delete('/tareas/:id', verificarToken, validarId, tareas.eliminar);

// ---------- Errores (siempre al final) ----------
app.all('/tareas', metodoNoPermitido('GET', 'POST'));
app.all('/tareas/:id', metodoNoPermitido('GET', 'PUT', 'DELETE'));
app.use(rutaNoEncontrada);
app.use(manejadorErrores);

// ---------- Servidor HTTP ----------
const servidor = http.createServer(app);
const inicio = new Date().toISOString();

async function arrancar(puerto = config.puerto) {
  // Lee (o crea) los archivos antes de aceptar peticiones: si tareas.json está dañado, se avisa de inmediato
  const [totalTareas, totalUsuarios] = await Promise.all([Tareas.contar(), Usuarios.contar()]);
  await new Promise((resolver, rechazar) => {
    servidor.once('error', rechazar);
    servidor.listen(puerto, resolver);
  });
  return { puerto: servidor.address().port, totalTareas, totalUsuarios };
}

function detener() {
  return new Promise((resolver) => servidor.close(resolver));
}

if (require.main === module) {
  arrancar()
    .then(({ puerto, totalTareas, totalUsuarios }) => {
      console.log(`✔ Datos: ${path.relative(process.cwd(), config.archivos.tareas)} (${totalTareas} tareas) · ${path.relative(process.cwd(), config.archivos.usuarios)} (${totalUsuarios} usuarios)`);
      console.log(`✔ API de tareas escuchando en http://localhost:${puerto}  [${config.entorno}]`);
      console.log('  Rutas: POST /register · POST /login · GET /perfil · POST /logout');
      console.log('         GET /tareas · GET /tareas/:id · POST /tareas · PUT /tareas/:id · DELETE /tareas/:id');
      console.log('  Ctrl + C para detener\n');
    })
    .catch((error) => {
      console.error(error.code === 'EADDRINUSE'
        ? `✖ El puerto ${config.puerto} ya está ocupado. Cierra el otro servidor o cambia PORT en .env.`
        : `✖ No se pudo iniciar la API: ${error.message}`);
      process.exit(1);
    });

  // Cierre ordenado con Ctrl + C: deja terminar las peticiones en curso
  process.on('SIGINT', () => {
    console.log('\nDeteniendo el servidor…');
    detener().then(() => process.exit(0));
    setTimeout(() => process.exit(0), 3000).unref();
  });
}

module.exports = { app, servidor, arrancar, detener };
