// 사진 일부를 키워 격자(원본 픽셀 좌표)를 얹는다 — 표식 자리를 읽으려고
import sharp from 'sharp';
const [src, x0, y0, w, h, scale = 2, step = 25, out] = process.argv.slice(2);
const X0 = +x0, Y0 = +y0, W = +w, H = +h, S = +scale, ST = +step;
const lines = [];
for (let x = Math.ceil(X0 / ST) * ST; x <= X0 + W; x += ST) lines.push(`<line x1="${(x - X0) * S}" y1="0" x2="${(x - X0) * S}" y2="${H * S}" stroke="${x % (ST * 4) ? 'rgba(0,255,0,.35)' : 'rgba(255,0,0,.8)'}" stroke-width="1"/><text x="${(x - X0) * S + 2}" y="12" fill="#ff0" font-size="11">${x}</text>`);
for (let y = Math.ceil(Y0 / ST) * ST; y <= Y0 + H; y += ST) lines.push(`<line x1="0" y1="${(y - Y0) * S}" x2="${W * S}" y2="${(y - Y0) * S}" stroke="${y % (ST * 4) ? 'rgba(0,255,0,.35)' : 'rgba(255,0,0,.8)'}" stroke-width="1"/><text x="2" y="${(y - Y0) * S - 2}" fill="#ff0" font-size="11">${y}</text>`);
const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${W * S}" height="${H * S}">${lines.join('')}</svg>`);
await sharp(src).extract({left: X0, top: Y0, width: W, height: H}).resize(Math.round(W * S), Math.round(H * S)).composite([{input: svg}]).png().toFile(out);
