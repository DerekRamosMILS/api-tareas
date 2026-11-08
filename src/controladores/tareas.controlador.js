// CRUD de tareas. Los datos ya llegan validados por los middlewares (req.idTarea, req.datos, req.filtros)
// y el usuario autenticado está en req.usuario. Express 5 envía al manejador de errores cualquier
// excepción de una función async, por eso aquí no hace falta try/catch.
const Tareas = require('../datos/tareas.modelo');
const ErrorHttp = require('../utils/ErrorHttp');

/** GET /tareas → todas las tareas guardadas (filtros opcionales) */
async function listar(req, res) {
  const tareas = await Tareas.listar(req.filtros);
  res.json({ total: tareas.length, tareas });
}

/** GET /tareas/:id */
async function obtener(req, res) {
  const tarea = await Tareas.buscarPorId(req.idTarea);
  if (!tarea) throw ErrorHttp.noEncontrado(`No existe la tarea con id ${req.idTarea}.`);
  res.json(tarea);
}

/** POST /tareas  { titulo, descripcion, completada? } → 201 */
async function crear(req, res) {
  const tarea = await Tareas.crear(req.datos, req.usuario);
  res.status(201).location(`/tareas/${tarea.id}`).json({ mensaje: 'Tarea creada.', tarea });
}

/** PUT /tareas/:id  { titulo?, descripcion?, completada? } */
async function actualizar(req, res) {
  const tarea = await Tareas.actualizar(req.idTarea, req.datos, req.usuario);
  res.json({ mensaje: 'Tarea actualizada.', tarea });
}

/** DELETE /tareas/:id */
async function eliminar(req, res) {
  const tarea = await Tareas.eliminar(req.idTarea, req.usuario);
  res.json({ mensaje: `Tarea ${tarea.id} eliminada.`, tarea });
}

module.exports = { listar, obtener, crear, actualizar, eliminar };
