/**
 * analyze-render.mjs — Medición objetiva de una captura de render (M2 / Cali Viva POC).
 *
 * Sin dependencias: decodifica un PNG (zlib nativo de Node) y calcula métricas de
 * exposición y composición. Sirve para verificar de forma MEDIBLE el defecto reportado
 * por los jugadores ("terreno sobreexpuesto, casi blanco") antes y después del POC.
 *
 * Uso:
 *   node tools/analyze-render.mjs docs/poc-cali-viva-art.png [docs/otra.png ...]
 *
 * Métricas:
 *   meanLuma        luminancia media (0-255) del frame completo
 *   clippedWhitePct % de píxeles con los tres canales >= 250 (zonas lavadas)
 *   nearBlackPct    % de píxeles con luminancia <= 12 (zonas sin información)
 *   midtonePct      % de píxeles en la banda 60-200 (rango con detalle)
 *   contrastP95P05  diferencia entre el percentil 95 y el 5 de luminancia
 *   satMean         saturación media (0-1): color real frente a gris lavado
 *   distinctHues    número de franjas de tono (0-11) con más del 1% de los píxeles
 *   skyVsGroundPct  reparto de la mitad superior/inferior (composición)
 */

import fs from "node:fs";
import zlib from "node:zlib";

/** Decodifica un PNG de 8 bits, color type 2 (RGB) o 6 (RGBA), sin entrelazar. */
export function decodePng(buffer) {
  if (buffer.readUInt32BE(0) !== 0x89504e47) throw new Error("no es un PNG");
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idat = [];
  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      const bitDepth = data.readUInt8(8);
      colorType = data.readUInt8(9);
      const interlace = data.readUInt8(12);
      if (bitDepth !== 8) throw new Error(`profundidad no soportada: ${bitDepth}`);
      if (interlace !== 0) throw new Error("PNG entrelazado no soportado");
    } else if (type === "IDAT") {
      idat.push(Buffer.from(data));
    } else if (type === "IEND") {
      break;
    }
    offset += 12 + length;
  }
  if (colorType !== 2 && colorType !== 6) throw new Error(`color type no soportado: ${colorType}`);
  const channels = colorType === 6 ? 4 : 3;
  const raw = zlib.inflateSync(Buffer.concat(idat));
  const stride = width * channels;
  const out = Buffer.alloc(height * stride);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const rowStart = y * stride;
    const prevStart = (y - 1) * stride;
    for (let x = 0; x < stride; x++) {
      const rawByte = raw[pos++];
      const left = x >= channels ? out[rowStart + x - channels] : 0;
      const up = y > 0 ? out[prevStart + x] : 0;
      const upLeft = y > 0 && x >= channels ? out[prevStart + x - channels] : 0;
      let value;
      switch (filter) {
        case 0: value = rawByte; break;
        case 1: value = rawByte + left; break;
        case 2: value = rawByte + up; break;
        case 3: value = rawByte + ((left + up) >> 1); break;
        case 4: {
          const p = left + up - upLeft;
          const pa = Math.abs(p - left);
          const pb = Math.abs(p - up);
          const pc = Math.abs(p - upLeft);
          value = rawByte + (pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft);
          break;
        }
        default: throw new Error(`filtro PNG desconocido: ${filter}`);
      }
      out[rowStart + x] = value & 0xff;
    }
  }
  return { width, height, channels, pixels: out };
}

function percentile(sorted, p) {
  const index = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[index];
}

/** Analiza una captura y devuelve métricas de exposición y composición. */
export function analyzePng(buffer) {
  const { width, height, channels, pixels } = decodePng(buffer);
  const total = width * height;
  const lumas = new Float32Array(total);
  let clippedWhite = 0;
  let nearBlack = 0;
  let midtone = 0;
  let satSum = 0;
  const hueBins = new Array(12).fill(0);
  let upperSum = 0;
  let lowerSum = 0;
  let upperCount = 0;
  let lowerCount = 0;

  for (let i = 0, p = 0; i < total; i++, p += channels) {
    const r = pixels[p];
    const g = pixels[p + 1];
    const b = pixels[p + 2];
    const luma = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    lumas[i] = luma;
    if (r >= 250 && g >= 250 && b >= 250) clippedWhite++;
    if (luma <= 12) nearBlack++;
    if (luma >= 60 && luma <= 200) midtone++;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const sat = max === 0 ? 0 : (max - min) / max;
    satSum += sat;
    if (sat > 0.18 && max > 40) {
      let hue;
      if (max === r) hue = ((g - b) / (max - min)) % 6;
      else if (max === g) hue = (b - r) / (max - min) + 2;
      else hue = (r - g) / (max - min) + 4;
      hue = ((hue * 60) + 360) % 360;
      hueBins[Math.floor(hue / 30) % 12]++;
    }
    const y = Math.floor(i / width);
    if (y < height / 2) { upperSum += luma; upperCount++; }
    else { lowerSum += luma; lowerCount++; }
  }

  const sorted = Array.from(lumas).sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / total;
  const threshold = total * 0.01;
  return {
    width,
    height,
    meanLuma: +mean.toFixed(2),
    p05: +percentile(sorted, 5).toFixed(2),
    p50: +percentile(sorted, 50).toFixed(2),
    p95: +percentile(sorted, 95).toFixed(2),
    contrastP95P05: +(percentile(sorted, 95) - percentile(sorted, 5)).toFixed(2),
    clippedWhitePct: +((clippedWhite / total) * 100).toFixed(2),
    nearBlackPct: +((nearBlack / total) * 100).toFixed(2),
    midtonePct: +((midtone / total) * 100).toFixed(2),
    satMean: +(satSum / total).toFixed(3),
    distinctHues: hueBins.filter((count) => count > threshold).length,
    upperHalfLuma: +(upperSum / Math.max(1, upperCount)).toFixed(2),
    lowerHalfLuma: +(lowerSum / Math.max(1, lowerCount)).toFixed(2),
  };
}

const files = process.argv.slice(2);
if (files.length > 0) {
  for (const file of files) {
    try {
      const stats = analyzePng(fs.readFileSync(file));
      console.log(JSON.stringify({ file: file.replace(/\\/g, "/"), ...stats }));
    } catch (error) {
      console.log(JSON.stringify({ file, error: error.message }));
    }
  }
}
