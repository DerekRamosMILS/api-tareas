// Error con código HTTP. Los controladores y middlewares lo lanzan (throw) o lo pasan a next(),
// y el manejador central (middleware/errores.js) lo convierte en una respuesta JSON.
class ErrorHttp extends Error {
  constructor(estado, mensaje, detalles) {
    super(mensaje);
    this.name = 'ErrorHttp';
    this.estado = estado;
    this.detalles = detalles;
  }

  static solicitudInvalida(mensaje, detalles) {
    return new ErrorHttp(400, mensaje, detalles);
  }

  static noAutorizado(mensaje = 'Necesitas iniciar sesión.') {
    return new ErrorHttp(401, mensaje);
  }

  static prohibido(mensaje = 'No tienes permiso para esta acción.') {
    return new ErrorHttp(403, mensaje);
  }

  static noEncontrado(mensaje = 'No se encontró el recurso.') {
    return new ErrorHttp(404, mensaje);
  }

  static conflicto(mensaje) {
    return new ErrorHttp(409, mensaje);
  }
}

module.exports = ErrorHttp;
