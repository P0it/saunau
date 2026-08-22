/**
 * app/favicon.ico 생성 — 레거시 폴백 파비콘.
 *
 * 디자인 원본은 app/icon.tsx(next/og 로 렌더). 같은 그림을 그대로 받아서
 * 16/32/48 PNG 로 줄인 뒤 ICO 컨테이너(PNG 내장 방식)로 묶는다.
 * 디자인을 바꿨으면 icon.tsx 를 고친 뒤 이 스크립트를 다시 돌린다.
 *
 *   npx next dev -p 3177        # 다른 터미널에서 먼저 띄운다
 *   node scripts/make-favicon.mjs [http://localhost:3177]
 */
import sharp from "sharp";
import { writeFile } from "node:fs/promises";

const base = process.argv[2] ?? "http://localhost:3177";

const res = await fetch(`${base}/icon`);
if (!res.ok) {
  console.error(`GET ${base}/icon → ${res.status}. dev 서버가 떠 있는지 확인.`);
  process.exit(1);
}
const src = Buffer.from(await res.arrayBuffer());

const SIZES = [16, 32, 48];
const pngs = await Promise.all(
  SIZES.map((s) =>
    sharp(src)
      .resize(s, s, { kernel: "lanczos3", fit: "fill" })
      .png({ compressionLevel: 9 })
      .toBuffer(),
  ),
);

// ICONDIR(6B) + ICONDIRENTRY(16B × n) + PNG 본문들
const dir = Buffer.alloc(6);
dir.writeUInt16LE(0, 0); // reserved
dir.writeUInt16LE(1, 2); // type: icon
dir.writeUInt16LE(SIZES.length, 4);

let offset = 6 + 16 * SIZES.length;
const entries = pngs.map((png, i) => {
  const e = Buffer.alloc(16);
  e.writeUInt8(SIZES[i], 0); // width  (256 이면 0)
  e.writeUInt8(SIZES[i], 1); // height
  e.writeUInt8(0, 2); // 팔레트 없음
  e.writeUInt8(0, 3); // reserved
  e.writeUInt16LE(1, 4); // color planes
  e.writeUInt16LE(32, 6); // bpp
  e.writeUInt32LE(png.length, 8);
  e.writeUInt32LE(offset, 12);
  offset += png.length;
  return e;
});

await writeFile("app/favicon.ico", Buffer.concat([dir, ...entries, ...pngs]));
console.log(`app/favicon.ico 생성 — ${SIZES.join("/")}px, ${offset}B`);
