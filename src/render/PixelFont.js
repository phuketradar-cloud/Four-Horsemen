// 5x7 bitmap font (uppercase, retro RPG style). Each glyph = 7 rows of 5-bit masks (bit 4 = left pixel).
// Glyph strips are rasterised once per colour and cached, so text draws are plain drawImage calls.
const G = {
  A: [14, 17, 17, 31, 17, 17, 17], B: [30, 17, 17, 30, 17, 17, 30], C: [14, 17, 16, 16, 16, 17, 14],
  D: [30, 17, 17, 17, 17, 17, 30], E: [31, 16, 16, 30, 16, 16, 31], F: [31, 16, 16, 30, 16, 16, 16],
  G: [14, 17, 16, 23, 17, 17, 15], H: [17, 17, 17, 31, 17, 17, 17], I: [14, 4, 4, 4, 4, 4, 14],
  J: [7, 2, 2, 2, 2, 18, 12], K: [17, 18, 20, 24, 20, 18, 17], L: [16, 16, 16, 16, 16, 16, 31],
  M: [17, 27, 21, 21, 17, 17, 17], N: [17, 17, 25, 21, 19, 17, 17], O: [14, 17, 17, 17, 17, 17, 14],
  P: [30, 17, 17, 30, 16, 16, 16], Q: [14, 17, 17, 17, 21, 18, 13], R: [30, 17, 17, 30, 20, 18, 17],
  S: [15, 16, 16, 14, 1, 1, 30], T: [31, 4, 4, 4, 4, 4, 4], U: [17, 17, 17, 17, 17, 17, 14],
  V: [17, 17, 17, 17, 17, 10, 4], W: [17, 17, 17, 21, 21, 21, 10], X: [17, 17, 10, 4, 10, 17, 17],
  Y: [17, 17, 10, 4, 4, 4, 4], Z: [31, 1, 2, 4, 8, 16, 31],
  0: [14, 17, 19, 21, 25, 17, 14], 1: [4, 12, 4, 4, 4, 4, 14], 2: [14, 17, 1, 2, 4, 8, 31],
  3: [31, 2, 4, 2, 1, 17, 14], 4: [2, 6, 10, 18, 31, 2, 2], 5: [31, 16, 30, 1, 1, 17, 14],
  6: [6, 8, 16, 30, 17, 17, 14], 7: [31, 1, 2, 4, 8, 8, 8], 8: [14, 17, 17, 14, 17, 17, 14],
  9: [14, 17, 17, 15, 1, 2, 12],
  ' ': [0, 0, 0, 0, 0, 0, 0], '.': [0, 0, 0, 0, 0, 12, 12], ',': [0, 0, 0, 0, 12, 4, 8],
  ':': [0, 12, 12, 0, 12, 12, 0], ';': [0, 12, 12, 0, 12, 4, 8], '!': [4, 4, 4, 4, 4, 0, 4],
  '?': [14, 17, 1, 2, 4, 0, 4], "'": [4, 4, 8, 0, 0, 0, 0], '"': [10, 10, 0, 0, 0, 0, 0],
  '-': [0, 0, 0, 14, 0, 0, 0], '+': [0, 4, 4, 31, 4, 4, 0], '/': [1, 1, 2, 4, 8, 16, 16],
  '(': [2, 4, 8, 8, 8, 4, 2], ')': [8, 4, 2, 2, 2, 4, 8], '[': [14, 8, 8, 8, 8, 8, 14],
  ']': [14, 2, 2, 2, 2, 2, 14], '%': [24, 25, 2, 4, 8, 19, 3], '#': [10, 31, 10, 10, 31, 10, 0],
  '*': [0, 4, 21, 14, 21, 4, 0], '=': [0, 0, 31, 0, 31, 0, 0], '>': [8, 4, 2, 1, 2, 4, 8],
  '<': [2, 4, 8, 16, 8, 4, 2], '&': [12, 18, 20, 8, 21, 18, 13], '_': [0, 0, 0, 0, 0, 0, 31],
  '▲': [0, 4, 14, 31, 0, 0, 0], '▼': [0, 0, 31, 14, 4, 0, 0], '▶': [8, 12, 14, 15, 14, 12, 8],
  '♥': [0, 10, 31, 31, 14, 4, 0], '·': [0, 0, 0, 4, 0, 0, 0],
};

const CHARS = Object.keys(G);
const INDEX = new Map(CHARS.map((c, i) => [c, i]));
export const GLYPH_W = 6; // 5 px + 1 spacing
export const GLYPH_H = 8;

const atlasCache = new Map();

function atlasFor(color) {
  let a = atlasCache.get(color);
  if (a) return a;
  a = document.createElement('canvas');
  a.width = CHARS.length * GLYPH_W;
  a.height = 7;
  const c = a.getContext('2d');
  c.fillStyle = color;
  CHARS.forEach((ch, i) => {
    const rows = G[ch];
    for (let y = 0; y < 7; y++) for (let x = 0; x < 5; x++) if (rows[y] & (16 >> x)) c.fillRect(i * GLYPH_W + x, y, 1, 1);
  });
  atlasCache.set(color, a);
  return a;
}

export function textWidth(text, scale = 1) {
  return text.length ? (text.length * GLYPH_W - 1) * scale : 0;
}

// align: 'left' | 'center' | 'right'. shadow: colour string or false.
export function drawText(ctx, text, x, y, color = '#ddd', opts = {}) {
  const scale = opts.scale || 1;
  const str = String(text).toUpperCase();
  let px = Math.round(x);
  const w = textWidth(str, scale);
  if (opts.align === 'center') px = Math.round(x - w / 2);
  else if (opts.align === 'right') px = Math.round(x - w);
  const py = Math.round(y);
  if (opts.shadow !== false) drawRaw(ctx, str, px + scale, py + scale, opts.shadow || '#000', scale);
  drawRaw(ctx, str, px, py, color, scale);
  return w;
}

function drawRaw(ctx, str, x, y, color, scale) {
  const atlas = atlasFor(color);
  for (let i = 0; i < str.length; i++) {
    const idx = INDEX.get(str[i]);
    if (idx === undefined) { if (str[i] !== ' ') ctx.drawImage(atlas, INDEX.get('?') * GLYPH_W, 0, 5, 7, x + i * GLYPH_W * scale, y, 5 * scale, 7 * scale); continue; }
    if (str[i] === ' ') continue;
    ctx.drawImage(atlas, idx * GLYPH_W, 0, 5, 7, x + i * GLYPH_W * scale, y, 5 * scale, 7 * scale);
  }
}

// Word-wrap into lines that fit maxChars.
export function wrapText(text, maxChars) {
  const words = String(text).split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if (!line.length) line = w;
    else if ((line + ' ' + w).length <= maxChars) line += ' ' + w;
    else { lines.push(line); line = w; }
    while (line.length > maxChars) { lines.push(line.slice(0, maxChars)); line = line.slice(maxChars); }
  }
  if (line.length) lines.push(line);
  return lines;
}
