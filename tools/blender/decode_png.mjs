/** Minimal original PNG pixel decoder for the Node-only GLB smoke test (ISC).
 * Supports only the non-interlaced 8-bit RGB/RGBA atlases emitted by this build.
 * Not a browser image polyfill and not used by the game. Does not verify CRCs.
 */
import { inflateSync } from 'node:zlib';
import assert from 'node:assert/strict';
export function decodePng(raw) {
  const b = Buffer.from(raw);
  assert.ok(b.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
  let cursor = 8, width, height, channels;
  const compressed = [];
  while (cursor + 12 <= b.length) {
    const length = b.readUInt32BE(cursor), type = b.toString('ascii', cursor + 4, cursor + 8);
    assert.ok(cursor + length + 12 <= b.length, 'PNG chunk range');
    const payload = b.subarray(cursor + 8, cursor + 8 + length);
    if (type === 'IHDR') {
      width = payload.readUInt32BE(0); height = payload.readUInt32BE(4);
      assert.ok(width > 0 && height > 0 && width <= 4096 && height <= 4096);
      assert.equal(payload[8], 8, 'Only 8-bit atlases');
      assert.ok(payload[9] === 2 || payload[9] === 6, 'Only RGB/RGBA atlases');
      channels = payload[9] === 2 ? 3 : 4;
      assert.equal(payload[10], 0); assert.equal(payload[11], 0); assert.equal(payload[12], 0);
    }
    if (type === 'IDAT') compressed.push(payload);
    cursor += length + 12;
    if (type === 'IEND') break;
  }
  assert.ok(width && channels && compressed.length);
  const stride = width * channels;
  const scan = inflateSync(Buffer.concat(compressed), { maxOutputLength: (stride + 1) * height });
  assert.equal(scan.length, (stride + 1) * height);
  const pixels = Buffer.alloc(stride * height);
  const paeth = (a, c, d) => {
    const p = a + c - d, pa = Math.abs(p-a), pc = Math.abs(p-c), pd = Math.abs(p-d);
    return pa <= pc && pa <= pd ? a : pc <= pd ? c : d;
  };
  for (let y = 0; y < height; y++) {
    const filter = scan[y * (stride + 1)]; assert.ok(filter <= 4);
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? pixels[y * stride + x - channels] : 0;
      const c = y > 0 ? pixels[(y - 1) * stride + x] : 0;
      const d = y > 0 && x >= channels ? pixels[(y - 1) * stride + x - channels] : 0;
      const predictor = [0, a, c, Math.floor((a+c)/2), paeth(a,c,d)][filter];
      pixels[y * stride + x] = (scan[y * (stride + 1) + 1 + x] + predictor) & 255;
    }
  }
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    rgba[i*4] = pixels[i*channels]; rgba[i*4+1] = pixels[i*channels+1];
    rgba[i*4+2] = pixels[i*channels+2]; rgba[i*4+3] = channels === 4 ? pixels[i*channels+3] : 255;
  }
  return { width, height, data: rgba, close() {} };
}
