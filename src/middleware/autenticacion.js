// Middlewares de autenticación y sesión.
const jwt = require('jsonwebtoken');
const config = require('../config');
const ErrorHttp = require('../utils/ErrorHttp');

// Sesiones cerradas con POST /logout: id del token (jti) → momento en que expira.
// Un JWT no se puede "borrar"; se rechaza aquí hasta que caduque por sí solo.
const sesionesCerradas = new Map();

function cerrarSesion(idSesion, expiraEnMs) {
  sesionesCerradas.set(idSesion, expiraEnMs);
  const ahora = Date.now();
  for (const [id, expira] of sesionesCerradas) if (expira < ahora) sesionesCerradas.delete(id);
}

/**
 * Exige el encabezado "Authorization: Bearer <token>" con un JWT válido.
 * Si todo está bien deja los datos en req.usuario y req.sesion; si no, responde 401.
 */
function verificarToken(req, res, next) {
  const [esquema, token] = (req.get('Authorization') ?? '').split(' ');
  if (esquema !== 'Bearer' || !token) {
    return next(ErrorHttp.noAutorizado('Falta el token. Envía el encabezado Authorization: Bearer <token>.'));
  }

  let datos;
  try {
    datos = jwt.verify(token, config.jwt.secreto, { algorithms: ['HS256'], issuer: config.jwt.emisor });
  } catch (error) {
    const mensaje = error.name === 'TokenExpiredError'
      ? 'La sesión expiró. Inicia sesión de nuevo.'
      : 'El token no es válido.';
    return next(ErrorHttp.noAutorizado(mensaje));
  }

  if (sesionesCerradas.has(datos.jti)) {
    return next(ErrorHttp.noAutorizado('Esta sesión ya se cerró. Inicia sesión de nuevo.'));
  }

  req.usuario = { id: datos.sub, usuario: datos.usuario };
  req.sesion = { id: datos.jti, expira: datos.exp * 1000 };
  return next();
}

/**
 * Limita los inicios de sesión fallidos por IP (por defecto 5 en 15 minutos → 429).
 * Escucha el final de la respuesta: un 401 suma un fallo y un 200 limpia el contador.
 */
function limitarIntentos({ maximo = 5, ventanaMs = 15 * 60 * 1000 } = {}) {
  const intentos = new Map(); // ip → { fallos, desde }

  return (req, res, next) => {
    const clave = req.ip;
    const ahora = Date.now();
    const registro = intentos.get(clave);
    if (registro && ahora - registro.desde > ventanaMs) intentos.delete(clave);

    const actual = intentos.get(clave);
    if (actual && actual.fallos >= maximo) {
      const segundos = Math.ceil((actual.desde + ventanaMs - ahora) / 1000);
      res.set('Retry-After', String(segundos));
      return next(new ErrorHttp(429, `Demasiados intentos fallidos. Vuelve a intentar en ${Math.ceil(segundos / 60)} min.`));
    }

    res.on('finish', () => {
      if (res.statusCode === 401) {
        const r = intentos.get(clave) ?? { fallos: 0, desde: Date.now() };
        r.fallos += 1;
        intentos.set(clave, r);
      } else if (res.statusCode === 200) {
        intentos.delete(clave);
      }
    });
    return next();
  };
}

module.exports = { verificarToken, cerrarSesion, limitarIntentos };
