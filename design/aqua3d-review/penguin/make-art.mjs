// 황제펭귄 2D 원화(2026-11-24 [사용자: "황제펭귄도 추가해"]) — 헤엄치는 옆모습을 SVG 로 직접 그린다(머리 오른쪽 · 512 · 투명).
// 사용자 참고 사진은 비율 · 무늬 자리(검은 등 · 흰 배 · 노란 귀 무늬 · 아랫부리 주황 줄 · 새끼의 회색 솜털과 흰 얼굴 가면)만 봤다(저작권).
// node design/aqua3d-review/penguin/make-art.mjs → public/aqua/fish/{emperor_penguin,juv_emperor_penguin,fry_emperor_penguin}.webp
import sharp from 'sharp';

const S = 512;
const tex = (id, freq, amt) => `<filter id="${id}" x="-5%" y="-5%" width="110%" height="110%"><feTurbulence type="fractalNoise" baseFrequency="${freq}" numOctaves="3" seed="7" result="n"/><feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 ${amt} 0" result="a"/><feComposite in="a" in2="SourceGraphic" operator="in" result="m"/><feBlend in="SourceGraphic" in2="m" mode="multiply"/></filter>`;

function adult(young) {
  // 몸 윤곽(부리 끝 → 이마 → 등 → 꼬리 → 배 → 목 → 아랫부리)
  const bill = young ? 462 : 478;
  const body = `M ${bill} 250 Q ${bill - 26} 236 418 232 C 398 206 356 190 314 188 C 232 186 144 206 96 234 L 62 250 L 96 266 C 150 314 250 336 332 324 C 388 314 412 288 426 266 Q ${bill - 24} 262 ${bill} 250 Z`;
  const back = young ? '#3c4250' : '#171b26', backHi = young ? '#5b6272' : '#3a4256';
  const ear = young ? '#e9e4d2' : '#f2a93a', chest = young ? '#f4f2ea' : '#f7e7a8';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    <clipPath id="b"><path d="${body}"/></clipPath>
    <linearGradient id="bk" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${backHi}"/><stop offset=".6" stop-color="${back}"/></linearGradient>
    <linearGradient id="wh" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".7" stop-color="#e6e8ec"/><stop offset="1" stop-color="#b9bdc4"/></linearGradient>
    <linearGradient id="ch" x1="1" y1="0" x2="0" y2="0"><stop offset="0" stop-color="${chest}" stop-opacity=".95"/><stop offset=".35" stop-color="${chest}" stop-opacity=".35"/><stop offset=".6" stop-color="${chest}" stop-opacity="0"/></linearGradient>
    <linearGradient id="er2" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${ear}"/><stop offset=".55" stop-color="${young ? ear : '#f7c85a'}"/><stop offset="1" stop-color="${chest}" stop-opacity=".2"/></linearGradient><radialGradient id="er" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="${ear}"/><stop offset=".7" stop-color="${ear}" stop-opacity=".85"/><stop offset="1" stop-color="${ear}" stop-opacity="0"/></radialGradient>
    <linearGradient id="fl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${backHi}"/><stop offset="1" stop-color="${back}"/></linearGradient>
    ${tex('ft', .9, .25)}
  </defs>
  <g filter="url(#ft)">
    <path d="${body}" fill="url(#bk)"/>
    <g clip-path="url(#b)">
      <path d="M 432 262 C 392 262 318 268 238 278 C 176 284 124 270 70 256 L 70 360 L 450 360 Z" fill="url(#wh)"/>
      <path d="M 432 262 C 392 262 318 268 238 278 L 238 360 L 450 360 Z" fill="url(#ch)"/>
      <path d="M 398 240 C 390 238 380 244 374 254 C 366 268 352 280 336 288 C 356 286 372 276 384 264 C 392 256 400 250 398 240 Z" fill="url(#er2)"/>
      <path d="M 96 236 C 160 212 250 202 316 200" stroke="#ffffff" stroke-opacity=".12" stroke-width="5" fill="none"/>
    </g>
  </g>
  <!-- 아랫부리 주황 줄(어른만) · 눈 -->
  ${young ? '' : `<path d="M ${bill - 6} 252 Q ${bill - 30} 262 430 262" stroke="#ef8a5c" stroke-width="5" stroke-linecap="round" fill="none"/>`}
  <circle cx="${young ? 404 : 406}" cy="238" r="3.4" fill="#05060a"/><circle cx="${young ? 405 : 407}" cy="237" r="1.1" fill="#fff" opacity=".8"/>
  <!-- 날개 지느러미(뒤로 젖힌 노) · 흰 뒷가장자리 -->
  <path d="M 344 258 C 318 268 280 300 240 352 C 236 358 242 362 248 357 C 286 322 322 296 348 282 Z" fill="url(#fl)"/>
  <path d="M 244 358 C 284 322 322 296 348 282" stroke="#eef0f3" stroke-width="3" fill="none" stroke-opacity=".85"/>
  <!-- 발(꼬리 밑) -->
  <path d="M 108 262 C 96 270 82 276 70 276 C 84 280 98 278 114 270 Z" fill="#3b2e34"/>
  </svg>`;
}

function chick() {
  // 둥글고 짧은 솜털 몸 · 검은 머리에 흰 얼굴 가면 · 작은 검은 부리
  const body = `M 444 246 Q 436 230 426 226 C 404 196 356 172 300 172 C 210 170 140 196 112 230 L 76 250 L 112 270 C 140 310 220 336 300 334 C 366 332 404 300 418 270 Q 436 262 448 246 Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}">
  <defs>
    <clipPath id="b"><path d="${body}"/></clipPath>
    <linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7bcc3"/><stop offset=".55" stop-color="#9aa0a8"/><stop offset="1" stop-color="#7d838c"/></linearGradient>
    <filter id="fz" x="-10%" y="-10%" width="120%" height="120%"><feTurbulence type="fractalNoise" baseFrequency=".6" numOctaves="2" seed="3" result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale="7" xChannelSelector="R" yChannelSelector="G"/></filter>
    ${tex('ft', 1.1, .3)}
  </defs>
  <g filter="url(#fz)"><g filter="url(#ft)">
    <path d="${body}" fill="url(#g)"/>
    <g clip-path="url(#b)">
      <circle cx="386" cy="236" r="60" fill="#15171d"/>
      <path d="M 452 236 C 440 226 426 224 414 230 C 400 238 396 256 402 272 C 410 290 432 296 452 286 Z" fill="#f3f3f0"/>
      <path d="M 300 300 C 340 330 300 340 260 336 L 420 340 Z" fill="#aeb3ba" opacity=".4"/>
    </g>
  </g></g>
  <path d="M 456 248 Q 446 242 434 244 Q 446 254 456 248 Z" fill="#0b0c10"/>
  <circle cx="420" cy="242" r="3.8" fill="#05060a"/><circle cx="421" cy="241" r="1.2" fill="#fff" opacity=".8"/>
  <path d="M 322 262 C 304 280 286 304 270 338 C 290 318 310 296 330 276 Z" fill="#8c929b"/>
  <path d="M 116 262 C 104 270 92 274 82 274 C 94 278 106 276 120 270 Z" fill="#2f2c33"/>
  </svg>`;
}

for (const [key, svg] of [['emperor_penguin', adult(false)], ['juv_emperor_penguin', adult(true)], ['fry_emperor_penguin', chick()]]) {
  if (process.argv[2] && !process.argv.slice(2).includes(key)) continue;
  await sharp(Buffer.from(svg)).webp({ quality: 92, alphaQuality: 100 }).toFile(`public/aqua/fish/${key}.webp`);
  console.log(key);
}
