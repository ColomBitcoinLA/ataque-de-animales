/**
 * CommonJS wrapper para el dominio puro (M1-A).
 * Punto de entrada explícito para CommonJS: require('./js/domain/index.cjs').
 * No se promete resolución implícita de require('./js/domain') porque no existe index.js/package.json local.
 */

module.exports = require("./index.mjs");
