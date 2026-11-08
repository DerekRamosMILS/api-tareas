// Configuración central de la API. El resto del código lee de aquí, nunca de process.env directamente.
// Las variables se cargan desde .env con la opción nativa de Node: node --env-file-if-exists=.env
const path = require('node:path');
const crypto = require('node:crypto');

const entorno = process.env.NODE_ENV || 'development';

let secretoJwt = process.env.JWT_SECRET;
if (!secretoJwt || secretoJwt.length < 32) {
  if (entorno === 'production') {
    throw new Error('JWT_SECRET debe existir y tener al menos 32 caracteres en producción.');
  }
  // En desarrollo no se detiene el servidor: se genera un secreto temporal y se avisa
  secretoJwt = crypto.randomBytes(48).toString('hex');
  console.warn('⚠ JWT_SECRET no está en .env: se usará uno temporal y las sesiones se perderán al reiniciar.');
}

const carpetaDatos = path.resolve(process.env.DATA_DIR || path.join(__dirname, '..', 'data'));

module.exports = Object.freeze({
  puerto: Number(process.env.PORT) || 3000,
  entorno,
  jwt: Object.freeze({
    secreto: secretoJwt,
    expiraEn: process.env.JWT_EXPIRES_IN || '1h',
    emisor: 'api-tareas',
  }),
  bcryptRondas: 10,
  archivos: Object.freeze({
    tareas: path.join(carpetaDatos, 'tareas.json'),
    usuarios: path.join(carpetaDatos, 'usuarios.json'),
  }),
});
