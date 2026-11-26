// 북극곰 옆모습 기준(USFWS 퍼블릭 도메인 "Polar bear in Arctic Alaska") 오리기 — 곰은 따뜻한 크림색(R > B), 하늘 · 눈밭은 푸른 보라(B ≥ R)
import sharp from 'sharp';
const src = 'design/aqua3d-review/polarbear/reference/usfws-polar-bear-side.jpg';
const {data, info} = await sharp(src).raw().toBuffer({resolveWithObject: true});
const W = info.width, H = info.height, C = info.channels, m = new Uint8Array(W * H);
for (let i = 0; i < W * H; i++) { const r = data[i * C], g = data[i * C + 1], b = data[i * C + 2]; m[i] = (b - r < -4 || (r < 100 && Math.abs(b - r) < 14)) && i < 701 * W ? 1 : 0; }
// 가장 큰 덩어리만
const lab = new Int32Array(W * H).fill(-1), sizes = []; let best = -1;
for (let s = 0; s < W * H; s++) if (m[s] && lab[s] < 0) { const id = sizes.length, st = [s]; lab[s] = id; let n = 0; while (st.length) { const i = st.pop(); n++; const x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && m[j] && lab[j] < 0) { lab[j] = id; st.push(j); } } sizes.push(n); if (best < 0 || n > sizes[best]) best = id; }
// 구멍 메우기(바깥과 닿지 않은 빈 칸)
const out = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) out[i] = lab[i] === best ? 1 : 0;
const outside = new Uint8Array(W * H), q = []; for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!out[i]) { outside[i] = 1; q.push(i); } } for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!out[i] && !outside[i]) { outside[i] = 1; q.push(i); } }
while (q.length) { const i = q.pop(), x = i % W; for (const j of [i - W, i + W, x ? i - 1 : -1, x < W - 1 ? i + 1 : -1]) if (j >= 0 && j < W * H && !out[j] && !outside[j]) { outside[j] = 1; q.push(j); } }
const rgba = Buffer.alloc(W * H * 4); let x0 = W, x1 = 0, y0 = H, y1 = 0;
for (let i = 0; i < W * H; i++) { const a = outside[i] ? 0 : 255; rgba[i * 4] = data[i * C]; rgba[i * 4 + 1] = data[i * C + 1]; rgba[i * 4 + 2] = data[i * C + 2]; rgba[i * 4 + 3] = a; if (a) { const x = i % W, y = (i - x) / W; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } }
await sharp(rgba, {raw: {width: W, height: H, channels: 4}}).extract({left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1}).png().toFile('design/aqua3d-review/polarbear/model-art/side-cut.png');
console.log(W, H, x0, x1, y0, y1);
