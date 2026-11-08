// Acceso a un archivo JSON con fs.promises (todas las operaciones son asíncronas).
// Mientras Node espera al disco, el Event Loop sigue atendiendo otras peticiones.
const fs = require('node:fs/promises');
const path = require('node:path');

class ArchivoJson {
  /**
   * @param {string} ruta Ruta completa del archivo (por ejemplo data/tareas.json)
   * @param {*} valorInicial Contenido con el que se crea si todavía no existe
   */
  constructor(ruta, valorInicial) {
    this.ruta = ruta;
    this.valorInicial = valorInicial;
    this.cola = Promise.resolve(); // cadena de escrituras pendientes
  }

  /** Lee y convierte el archivo. Si no existe, lo crea con el valor inicial. */
  async leer() {
    try {
      const texto = await fs.readFile(this.ruta, 'utf8');
      return JSON.parse(texto);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.escribir(this.valorInicial);
        return structuredClone(this.valorInicial);
      }
      if (error instanceof SyntaxError) {
        throw new Error(`El archivo ${path.basename(this.ruta)} no contiene JSON válido: ${error.message}`);
      }
      throw error;
    }
  }

  /** Escribe en un archivo temporal y luego lo renombra: si algo falla a la mitad, el original no se corrompe. */
  async escribir(datos) {
    await fs.mkdir(path.dirname(this.ruta), { recursive: true });
    const temporal = `${this.ruta}.tmp`;
    await fs.writeFile(temporal, `${JSON.stringify(datos, null, 2)}\n`, 'utf8');
    await fs.rename(temporal, this.ruta);
  }

  /**
   * Lee, aplica un cambio y guarda, en fila: si llegan dos peticiones al mismo tiempo,
   * la segunda espera a que termine la primera y ninguna borra el cambio de la otra.
   * Si la función de cambio lanza un error, no se escribe nada.
   * @param {(datos: any) => any} cambio Modifica los datos y devuelve el resultado para la ruta
   */
  modificar(cambio) {
    const operacion = this.cola.then(async () => {
      const datos = await this.leer();
      const resultado = await cambio(datos);
      await this.escribir(datos);
      return resultado;
    });
    this.cola = operacion.catch(() => {}); // un error no detiene la fila
    return operacion;
  }
}

module.exports = ArchivoJson;
