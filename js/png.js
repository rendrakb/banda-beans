/* Adds a pHYs chunk to a PNG so print software knows the real DPI. */
(function (root) {
  var B = root.Beans = root.Beans || {};
  var table = null;
  function crc32(buf) {
    if (!table) { table = new Uint32Array(256); for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; table[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 255] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  B.setPngDpi = function (arrayBuffer, dpi) {
    var src = new Uint8Array(arrayBuffer), ppm = Math.round(dpi / 0.0254);
    var chunk = new Uint8Array(21), dv = new DataView(chunk.buffer);
    dv.setUint32(0, 9); chunk.set([0x70, 0x48, 0x59, 0x73], 4);           /* length, 'pHYs' */
    dv.setUint32(8, ppm); dv.setUint32(12, ppm); chunk[16] = 1;           /* x, y, unit = metre */
    dv.setUint32(17, crc32(chunk.subarray(4, 17)));
    var out = new Uint8Array(src.length + 21), at = 33;                   /* after signature + IHDR */
    out.set(src.subarray(0, at), 0); out.set(chunk, at); out.set(src.subarray(at), at + 21);
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
