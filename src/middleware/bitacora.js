// Bitácora de peticiones con console.log: método, ruta, código, tiempo y usuario.
// Es la primera herramienta de depuración: muestra qué llegó y cómo respondió la API.
const colores = { verde: 32, amarillo: 33, rojo: 31, gris: 90 };
const pintar = (texto, color) => (process.stdout.isTTY ? `\x1b[${colores[color]}m${texto}\x1b[0m` : texto);

function hora() {
  return new Date().toLocaleTimeString('es-MX', { hour12: false });
}

function bitacora(req, res, next) {
  const inicio = process.hrtime.bigint();
  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
    const estado = res.statusCode;
    const color = estado >= 500 ? 'rojo' : estado >= 400 ? 'amarillo' : 'verde';
    const quien = req.usuario ? pintar(` · ${req.usuario.usuario}`, 'gris') : '';
    console.log(`${pintar(hora(), 'gris')} ${req.method.padEnd(6)} ${req.originalUrl} → ${pintar(estado, color)} ${pintar(`(${ms.toFixed(1)} ms)`, 'gris')}${quien}`);
  });
  next();
}

module.exports = bitacora;
