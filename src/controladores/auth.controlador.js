// Registro, inicio de sesión, perfil y cierre de sesión.
const crypto = require('node:crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Usuarios = require('../datos/usuarios.modelo');
const ErrorHttp = require('../utils/ErrorHttp');
const { cerrarSesion: revocarSesion } = require('../middleware/autenticacion');

// Hash de relleno: si el usuario no existe se compara contra este, para que la respuesta tarde
// lo mismo y nadie pueda adivinar qué usuarios están registrados midiendo el tiempo.
const HASH_RELLENO = bcrypt.hashSync('relleno-para-igualar-tiempos', config.bcryptRondas);

/** POST /register  { usuario, password } → 201 */
async function registrar(req, res) {
  const usuario = req.body.usuario.trim();
  // bcrypt agrega una sal aleatoria y aplica 2^10 rondas: el mismo password da un hash distinto cada vez
  const passwordHash = await bcrypt.hash(req.body.password, config.bcryptRondas);
  const nuevo = await Usuarios.crear({ usuario, passwordHash });
  console.log(`  ↳ usuario registrado: ${nuevo.usuario}`);
  res.status(201).json({ mensaje: 'Usuario registrado. Ya puedes iniciar sesión.', usuario: Usuarios.publico(nuevo) });
}

/** POST /login  { usuario, password } → 200 con el token JWT */
async function iniciarSesion(req, res) {
  const encontrado = await Usuarios.buscarPorUsuario(req.body.usuario.trim());
  const coincide = await bcrypt.compare(req.body.password, encontrado?.passwordHash ?? HASH_RELLENO);
  if (!encontrado || !coincide) {
    // El mismo mensaje para "no existe" y "contraseña mal": no se revela cuál de los dos falló
    throw ErrorHttp.noAutorizado('Usuario o contraseña incorrectos.');
  }

  const token = jwt.sign(
    { usuario: encontrado.usuario },
    config.jwt.secreto,
    {
      subject: encontrado.id,
      expiresIn: config.jwt.expiraEn,
      issuer: config.jwt.emisor,
      jwtid: crypto.randomUUID(), // identifica la sesión para poder cerrarla
      algorithm: 'HS256',
    },
  );
  const { exp } = jwt.decode(token);

  res.json({
    mensaje: `Bienvenido, ${encontrado.usuario}.`,
    token,
    tipo: 'Bearer',
    expiraEn: new Date(exp * 1000).toISOString(),
    usuario: Usuarios.publico(encontrado),
  });
}

/** GET /perfil (protegida) → datos del usuario y de la sesión actual */
async function perfil(req, res) {
  const usuario = await Usuarios.buscarPorId(req.usuario.id);
  if (!usuario) throw ErrorHttp.noAutorizado('El usuario de este token ya no existe.');
  res.json({
    usuario: Usuarios.publico(usuario),
    sesion: { id: req.sesion.id, expiraEn: new Date(req.sesion.expira).toISOString() },
  });
}

/** POST /logout (protegida) → invalida el token actual */
function cerrarSesion(req, res) {
  revocarSesion(req.sesion.id, req.sesion.expira);
  res.json({ mensaje: 'Sesión cerrada. Este token ya no sirve.' });
}

module.exports = { registrar, iniciarSesion, perfil, cerrarSesion };
