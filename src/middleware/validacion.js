// Middlewares de validación. Revisan los datos antes de que lleguen al controlador;
// si algo está mal responden 400 con el detalle de cada campo.
const ErrorHttp = require('../utils/ErrorHttp');

const esObjeto = (valor) => typeof valor === 'object' && valor !== null && !Array.isArray(valor);

function exigirCuerpoJson(req) {
  if (!esObjeto(req.body)) {
    throw ErrorHttp.solicitudInvalida('El cuerpo debe ser un objeto JSON. Envía el encabezado Content-Type: application/json.');
  }
  return req.body;
}

function texto(valor, minimo, maximo) {
  if (typeof valor !== 'string') return null;
  const limpio = valor.trim();
  return limpio.length >= minimo && limpio.length <= maximo ? limpio : null;
}

/** Valida el id de la URL (/tareas/:id) y lo deja convertido a número en req.idTarea. */
function validarId(req, res, next) {
  // req.params.id siempre llega como texto ("3"); en tareas.json el id es número (3)
  if (!/^[1-9]\d{0,8}$/.test(req.params.id)) {
    return next(ErrorHttp.solicitudInvalida(`El id "${req.params.id}" no es válido: debe ser un número entero positivo.`));
  }
  req.idTarea = Number(req.params.id);
  return next();
}

/**
 * Valida una tarea. Para POST (parcial = false) título y descripción son obligatorios;
 * para PUT (parcial = true) basta con enviar al menos uno de los campos permitidos.
 * Solo deja pasar titulo, descripcion y completada (en req.datos).
 */
function validarTarea({ parcial = false } = {}) {
  const permitidos = ['titulo', 'descripcion', 'completada'];

  return (req, res, next) => {
    const cuerpo = exigirCuerpoJson(req);
    const errores = {};
    const datos = {};

    const extra = Object.keys(cuerpo).filter((campo) => !permitidos.includes(campo));
    if (extra.length) errores.campos = `Campos no permitidos: ${extra.join(', ')}. Solo se aceptan ${permitidos.join(', ')}.`;

    if (!parcial || 'titulo' in cuerpo) {
      const titulo = texto(cuerpo.titulo, 3, 100);
      if (titulo === null) errores.titulo = 'El título es obligatorio y debe tener entre 3 y 100 caracteres.';
      else datos.titulo = titulo;
    }

    if (!parcial || 'descripcion' in cuerpo) {
      const descripcion = texto(cuerpo.descripcion, 5, 500);
      if (descripcion === null) errores.descripcion = 'La descripción es obligatoria y debe tener entre 5 y 500 caracteres.';
      else datos.descripcion = descripcion;
    }

    if ('completada' in cuerpo) {
      if (typeof cuerpo.completada !== 'boolean') errores.completada = 'completada debe ser true o false (sin comillas).';
      else datos.completada = cuerpo.completada;
    }

    if (parcial && !extra.length && Object.keys(cuerpo).length === 0) {
      errores.cuerpo = 'Envía al menos un campo para actualizar: titulo, descripcion o completada.';
    }

    if (Object.keys(errores).length) {
      return next(ErrorHttp.solicitudInvalida('Los datos de la tarea no son válidos.', errores));
    }
    req.datos = datos;
    return next();
  };
}

/** Filtros opcionales de GET /tareas: ?completada=true|false, ?q=texto, ?mias=true */
function validarFiltros(req, res, next) {
  const { completada, q, mias } = req.query;
  const filtros = {};
  const errores = {};

  if (completada !== undefined) {
    if (completada === 'true' || completada === 'false') filtros.completada = completada === 'true';
    else errores.completada = 'Usa ?completada=true o ?completada=false.';
  }
  if (q !== undefined) {
    if (typeof q === 'string' && q.trim().length <= 50) filtros.texto = q.trim();
    else errores.q = 'La búsqueda debe tener máximo 50 caracteres.';
  }
  if (mias !== undefined) {
    if (mias === 'true') filtros.usuarioId = req.usuario.id;
    else if (mias !== 'false') errores.mias = 'Usa ?mias=true para ver solo tus tareas.';
  }

  if (Object.keys(errores).length) return next(ErrorHttp.solicitudInvalida('Filtros no válidos.', errores));
  req.filtros = filtros;
  return next();
}

function validarRegistro(req, res, next) {
  const { usuario, password } = exigirCuerpoJson(req);
  const errores = {};
  if (typeof usuario !== 'string' || !/^[a-zA-Z0-9._-]{3,30}$/.test(usuario)) {
    errores.usuario = 'Usa de 3 a 30 caracteres: letras, números, punto, guion o guion bajo.';
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 72) {
    errores.password = 'La contraseña debe tener entre 8 y 72 caracteres.';
  } else if (!/[a-zA-Z]/.test(password) || !/\d/.test(password)) {
    errores.password = 'La contraseña debe combinar letras y números.';
  }
  if (Object.keys(errores).length) return next(ErrorHttp.solicitudInvalida('Revisa los datos del registro.', errores));
  return next();
}

function validarLogin(req, res, next) {
  const { usuario, password } = exigirCuerpoJson(req);
  const errores = {};
  if (typeof usuario !== 'string' || !usuario.trim()) errores.usuario = 'Escribe tu usuario.';
  if (typeof password !== 'string' || !password) errores.password = 'Escribe tu contraseña.';
  if (Object.keys(errores).length) return next(ErrorHttp.solicitudInvalida('Faltan datos para iniciar sesión.', errores));
  return next();
}

module.exports = { validarId, validarTarea, validarFiltros, validarRegistro, validarLogin };
