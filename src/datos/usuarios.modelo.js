// Operaciones sobre data/usuarios.json. Cada usuario: { id, usuario, passwordHash, creadoEn }.
// El id es un UUID aleatorio: no se puede adivinar ni se repite aunque se borre el archivo.
// La contraseña nunca se guarda: solo su hash de bcrypt.
const crypto = require('node:crypto');
const config = require('../config');
const ArchivoJson = require('./ArchivoJson');
const ErrorHttp = require('../utils/ErrorHttp');

const archivo = new ArchivoJson(config.archivos.usuarios, []);

const mismoNombre = (a, b) => a.toLowerCase() === b.toLowerCase();

async function buscarPorUsuario(usuario) {
  const usuarios = await archivo.leer();
  return usuarios.find((u) => mismoNombre(u.usuario, usuario)) ?? null;
}

async function buscarPorId(id) {
  const usuarios = await archivo.leer();
  return usuarios.find((u) => u.id === id) ?? null;
}

function crear({ usuario, passwordHash }) {
  return archivo.modificar((usuarios) => {
    // La revisión de duplicados va dentro de la fila para que dos registros simultáneos no se cuelen
    if (usuarios.some((u) => mismoNombre(u.usuario, usuario))) {
      throw ErrorHttp.conflicto(`El usuario "${usuario}" ya está registrado.`);
    }
    const nuevo = {
      id: crypto.randomUUID(),
      usuario,
      passwordHash,
      creadoEn: new Date().toISOString(),
    };
    usuarios.push(nuevo);
    return nuevo;
  });
}

async function contar() {
  return (await archivo.leer()).length;
}

/** Versión segura para enviar al cliente (sin el hash). */
function publico({ id, usuario, creadoEn }) {
  return { id, usuario, creadoEn };
}

module.exports = { buscarPorUsuario, buscarPorId, crear, contar, publico };
