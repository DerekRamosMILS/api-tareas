// Middlewares de manejo de errores. Van al final de server.js, después de todas las rutas.
const ErrorHttp = require('../utils/ErrorHttp');

/** Cualquier ruta que no coincidió con las anteriores termina aquí → 404. */
function rutaNoEncontrada(req, res, next) {
  next(ErrorHttp.noEncontrado(`La ruta ${req.method} ${req.originalUrl} no existe.`));
}

/** Para rutas que existen pero no aceptan ese método (por ejemplo PATCH /tareas/1) → 405. */
function metodoNoPermitido(...metodos) {
  return (req, res, next) => {
    res.set('Allow', metodos.join(', '));
    next(new ErrorHttp(405, `El método ${req.method} no está permitido en ${req.path}. Usa: ${metodos.join(', ')}.`));
  };
}

/**
 * Manejador central: Express lo reconoce porque recibe 4 parámetros (err, req, res, next).
 * Traduce cada error a un código HTTP y a un JSON con el mismo formato:
 * { "error": { "estado": 400, "mensaje": "...", "detalles": { ... } } }
 */
// eslint-disable-next-line no-unused-vars
function manejadorErrores(err, req, res, next) {
  let error = err;

  if (err.type === 'entity.parse.failed') {
    // body-parser no pudo leer el JSON (comillas o comas de más, llaves sin cerrar…)
    error = ErrorHttp.solicitudInvalida('El cuerpo no es un JSON válido. Revisa comillas, comas y llaves.');
  } else if (err.type === 'entity.too.large') {
    error = new ErrorHttp(413, 'El cuerpo de la petición es demasiado grande (máximo 10 kb).');
  } else if (!(err instanceof ErrorHttp)) {
    // Error inesperado: se registra completo en la consola para depurarlo, pero al cliente no se le
    // muestran detalles internos (rutas de archivos, stack, etc.)
    console.error(`\n✖ Error 500 en ${req.method} ${req.originalUrl}`);
    console.error(err);
    error = new ErrorHttp(500, 'Ocurrió un error interno en el servidor. Intenta de nuevo más tarde.');
  }

  if (error.estado === 401) res.set('WWW-Authenticate', 'Bearer');
  if (res.headersSent) return next(err);

  return res.status(error.estado).json({
    error: {
      estado: error.estado,
      mensaje: error.message,
      ...(error.detalles && { detalles: error.detalles }),
    },
  });
}

module.exports = { rutaNoEncontrada, metodoNoPermitido, manejadorErrores };
