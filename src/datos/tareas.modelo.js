// Operaciones sobre data/tareas.json. Cada tarea:
// { id, titulo, descripcion, completada, creadaPor: { id, usuario }, creadaEn, actualizadaEn }
const config = require('../config');
const ArchivoJson = require('./ArchivoJson');
const ErrorHttp = require('../utils/ErrorHttp');

const archivo = new ArchivoJson(config.archivos.tareas, []);

/** Lanza 404 si no existe la tarea y 403 si la creó otro usuario. */
function buscarPropia(tareas, id, usuario) {
  const indice = tareas.findIndex((t) => t.id === id);
  if (indice === -1) throw ErrorHttp.noEncontrado(`No existe la tarea con id ${id}.`);
  if (tareas[indice].creadaPor.id !== usuario.id) {
    throw ErrorHttp.prohibido('Solo quien creó la tarea puede modificarla o eliminarla.');
  }
  return indice;
}

async function listar({ completada, texto, usuarioId } = {}) {
  let tareas = await archivo.leer();
  if (completada !== undefined) tareas = tareas.filter((t) => t.completada === completada);
  if (usuarioId !== undefined) tareas = tareas.filter((t) => t.creadaPor.id === usuarioId);
  if (texto) {
    const buscado = texto.toLowerCase();
    tareas = tareas.filter((t) => `${t.titulo} ${t.descripcion}`.toLowerCase().includes(buscado));
  }
  return tareas;
}

async function buscarPorId(id) {
  const tareas = await archivo.leer();
  return tareas.find((t) => t.id === id) ?? null;
}

function crear({ titulo, descripcion, completada = false }, usuario) {
  return archivo.modificar((tareas) => {
    const ahora = new Date().toISOString();
    const tarea = {
      id: tareas.reduce((mayor, t) => Math.max(mayor, t.id), 0) + 1,
      titulo,
      descripcion,
      completada,
      creadaPor: { id: usuario.id, usuario: usuario.usuario },
      creadaEn: ahora,
      actualizadaEn: ahora,
    };
    tareas.push(tarea);
    return tarea;
  });
}

function actualizar(id, cambios, usuario) {
  return archivo.modificar((tareas) => {
    const indice = buscarPropia(tareas, id, usuario);
    tareas[indice] = { ...tareas[indice], ...cambios, actualizadaEn: new Date().toISOString() };
    return tareas[indice];
  });
}

function eliminar(id, usuario) {
  return archivo.modificar((tareas) => {
    const indice = buscarPropia(tareas, id, usuario);
    const [eliminada] = tareas.splice(indice, 1);
    return eliminada;
  });
}

async function contar() {
  return (await archivo.leer()).length;
}

module.exports = { listar, buscarPorId, crear, actualizar, eliminar, contar };
