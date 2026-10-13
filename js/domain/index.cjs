/**
 * CommonJS wrapper para el dominio puro (M1-A).
 * Permite que require('./js/domain') o require('./js/domain/index.cjs') funcione
 * de manera transparente en entornos CJS (Node.js backend y tests).
 */

module.exports = require("./index.mjs");
