// Prueba automática de la API: npm test
// Levanta la API en un puerto libre con una carpeta de datos temporal (no toca data/tareas.json),
// recorre el CRUD, la autenticación, los errores y la escritura concurrente, y muestra un resumen.
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');

const verde = (t) => `\x1b[32m${t}\x1b[0m`;
const rojo = (t) => `\x1b[31m${t}\x1b[0m`;
const gris = (t) => `\x1b[90m${t}\x1b[0m`;
const escribir = (t = '') => process.stdout.write(`${t}\n`);

async function main() {
  const carpeta = await fs.mkdtemp(path.join(os.tmpdir(), 'api-tareas-prueba-'));
  process.env.DATA_DIR = carpeta;
  process.env.JWT_SECRET ??= 'secreto-solo-para-pruebas-automaticas-0123456789';

  // La bitácora del servidor se guarda aparte para que no se mezcle con la tabla de resultados
  const bitacoraServidor = [];
  console.log = console.warn = console.error = (...partes) => bitacoraServidor.push(partes.join(' '));

  const { arrancar, detener } = require('../server');
  const { puerto } = await arrancar(0);
  const BASE = `http://127.0.0.1:${puerto}`;
  const archivoTareas = path.join(carpeta, 'tareas.json');
  const resultados = [];

  async function probar(descripcion, metodo, ruta, { token, cuerpo, crudo, esperado }) {
    const inicio = performance.now();
    const respuesta = await fetch(BASE + ruta, {
      method: metodo,
      headers: {
        ...((cuerpo || crudo) && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: crudo ?? (cuerpo ? JSON.stringify(cuerpo) : undefined),
    });
    const json = await respuesta.json().catch(() => ({}));
    const ms = Math.round(performance.now() - inicio);
    anotar(respuesta.status === esperado, metodo, ruta, String(respuesta.status), `${ms} ms`, descripcion);
    return json;
  }

  function anotar(paso, metodo, ruta, obtenido, tiempo, descripcion) {
    resultados.push(paso);
    escribir(`${paso ? verde('✔') : rojo('✖')} ${metodo.padEnd(6)} ${ruta.padEnd(24)} ${obtenido.padEnd(4)} ${tiempo.padStart(6)}  ${descripcion}`);
  }

  async function revisarArchivo(descripcion, condicion) {
    const tareas = JSON.parse(await fs.readFile(archivoTareas, 'utf8'));
    anotar(condicion(tareas), 'FS', 'data/tareas.json', '—', '', descripcion);
  }

  escribir(`\nAPI de tareas · prueba automática en ${BASE}`);
  escribir(gris(`Datos temporales: ${carpeta}`));
  escribir();
  escribir(`  MÉTODO RUTA                     HTTP  TIEMPO  QUÉ SE PRUEBA`);

  // --- Rutas públicas y protección
  await probar('El servidor responde', 'GET', '/salud', { esperado: 200 });
  await probar('Sin token → ruta protegida', 'GET', '/tareas', { esperado: 401 });
  await probar('Token falso → rechazado', 'GET', '/tareas', { token: 'abc.def.ghi', esperado: 401 });

  // --- Registro e inicio de sesión
  await probar('Registro con datos inválidos', 'POST', '/register', { cuerpo: { usuario: 'a', password: '123' }, esperado: 400 });
  await probar('Registro de ana (bcrypt)', 'POST', '/register', { cuerpo: { usuario: 'ana', password: 'Tareas2026' }, esperado: 201 });
  await probar('Usuario repetido', 'POST', '/register', { cuerpo: { usuario: 'ana', password: 'Tareas2026' }, esperado: 409 });
  await probar('Login con contraseña incorrecta', 'POST', '/login', { cuerpo: { usuario: 'ana', password: 'otra12345' }, esperado: 401 });
  const { token } = await probar('Login de ana → token JWT', 'POST', '/login', { cuerpo: { usuario: 'ana', password: 'Tareas2026' }, esperado: 200 });
  await probar('Perfil con token', 'GET', '/perfil', { token, esperado: 200 });

  // --- CRUD
  await probar('JSON mal formado', 'POST', '/tareas', { token, crudo: '{"titulo": "Sin cerrar",', esperado: 400 });
  await probar('Tarea sin descripción', 'POST', '/tareas', { token, cuerpo: { titulo: 'Solo título' }, esperado: 400 });
  const { tarea } = await probar('CREATE: nueva tarea', 'POST', '/tareas', {
    token, cuerpo: { titulo: 'Preparar exposición', descripcion: 'Diapositivas del tema de Express.js' }, esperado: 201,
  });
  const ruta = `/tareas/${tarea?.id}`;
  await revisarArchivo('La tarea quedó guardada en el archivo', (t) => t.some((x) => x.id === tarea?.id));
  await probar('READ: todas las tareas', 'GET', '/tareas', { token, esperado: 200 });
  await probar('READ: una tarea por id', 'GET', ruta, { token, esperado: 200 });
  await probar('Id que no es número', 'GET', '/tareas/abc', { token, esperado: 400 });
  await probar('Id que no existe', 'GET', '/tareas/999', { token, esperado: 404 });
  await probar('UPDATE: marcar completada', 'PUT', ruta, { token, cuerpo: { completada: true }, esperado: 200 });
  await revisarArchivo('El cambio se escribió en el archivo', (t) => t.find((x) => x.id === tarea?.id)?.completada === true);
  await probar('UPDATE con campo no permitido', 'PUT', ruta, { token, cuerpo: { id: 50 }, esperado: 400 });
  await probar('Método no permitido', 'PATCH', ruta, { token, esperado: 405 });

  // --- Permisos entre usuarios
  await probar('Registro de beto', 'POST', '/register', { cuerpo: { usuario: 'beto', password: 'Beto2026x' }, esperado: 201 });
  const { token: tokenBeto } = await probar('Login de beto', 'POST', '/login', { cuerpo: { usuario: 'beto', password: 'Beto2026x' }, esperado: 200 });
  await probar('Beto edita la tarea de ana', 'PUT', ruta, { token: tokenBeto, cuerpo: { titulo: 'Cambio ajeno' }, esperado: 403 });
  await probar('Beto borra la tarea de ana', 'DELETE', ruta, { token: tokenBeto, esperado: 403 });
  await probar('DELETE: ana borra su tarea', 'DELETE', ruta, { token, esperado: 200 });
  await probar('La tarea ya no existe', 'GET', ruta, { token, esperado: 404 });

  // --- Escritura concurrente: 10 tareas al mismo tiempo (fs.promises + fila de escritura)
  const inicio = performance.now();
  const respuestas = await Promise.all(Array.from({ length: 10 }, (_, i) => fetch(`${BASE}/tareas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ titulo: `Tarea simultánea ${i + 1}`, descripcion: 'Creada en paralelo por la prueba' }),
  })));
  const ids = await Promise.all(respuestas.map(async (r) => (await r.json()).tarea?.id));
  anotar(respuestas.every((r) => r.status === 201) && new Set(ids).size === 10, 'POST', '/tareas  (×10)', '201', `${Math.round(performance.now() - inicio)} ms`, '10 tareas en paralelo, ids únicos');
  await revisarArchivo('Las 10 tareas están en el archivo', (t) => ids.every((id) => t.some((x) => x.id === id)));

  // --- Sesión, rutas y errores del servidor
  await probar('Cerrar sesión', 'POST', '/logout', { token, esperado: 200 });
  await probar('Token de sesión cerrada', 'GET', '/tareas', { token, esperado: 401 });
  await probar('Ruta inexistente', 'GET', '/no-existe', { esperado: 404 });
  const respaldo = await fs.readFile(archivoTareas, 'utf8');
  await fs.writeFile(archivoTareas, '[{ "id": 1, ');
  await probar('tareas.json dañado → error 500', 'GET', '/tareas', { token: tokenBeto, esperado: 500 });
  await fs.writeFile(archivoTareas, respaldo);
  for (let i = 0; i < 5; i += 1) await fetch(`${BASE}/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ usuario: 'ana', password: 'incorrecta1' }) });
  await probar('6.º intento fallido → bloqueo', 'POST', '/login', { cuerpo: { usuario: 'ana', password: 'Tareas2026' }, esperado: 429 });

  await detener();
  await fs.rm(carpeta, { recursive: true, force: true });

  const aprobadas = resultados.filter(Boolean).length;
  escribir(`\n  ${aprobadas === resultados.length ? verde(`${aprobadas} de ${resultados.length} pruebas aprobadas`) : rojo(`${aprobadas} de ${resultados.length} pruebas aprobadas`)}`);
  escribir(gris(`  El servidor registró ${bitacoraServidor.length} líneas en su bitácora durante la prueba.`));
  escribir();
  process.exitCode = aprobadas === resultados.length ? 0 : 1;
}

main().catch((error) => {
  process.stderr.write(`\n✖ La prueba no pudo completarse: ${error.stack}\n`);
  process.exit(1);
});
