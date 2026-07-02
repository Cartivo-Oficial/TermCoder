// Rasterize build/icon.svg into the PNGs + a Windows .ico the app/installer need.
// Run with: node scripts/make-icons.mjs
//
// IMPORTANT: the Windows shell (Explorer/taskbar) only reliably renders PNG-
// compressed icon entries at 256px. Smaller sizes MUST be classic BMP/DIB or the
// shell silently falls back to a generic/stale icon — which is exactly the "old
// logo won't go away" bug. So we emit BMP for 16–128 and PNG only for 256.
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";
import sharp from "sharp";

const here = dirname(fileURLToPath(import.meta.url));
const buildDir = join(here, "..", "build");
const svg = join(buildDir, "icon.svg");

const pngSizes = [
  { name: "icon.png", size: 1024 },
  { name: "icon@512.png", size: 512 },
  { name: "icon@256.png", size: 256 },
];

for (const { name, size } of pngSizes) {
  await sharp(svg, { density: 384 }).resize(size, size).png().toFile(join(buildDir, name));
  console.log(`wrote build/${name} (${size}px)`);
}

/** A 32bpp bottom-up BGRA DIB (BITMAPINFOHEADER + XOR pixels + empty AND mask). */
async function bmpDib(size) {
  const rgba = await sharp(svg, { density: 384 }).resize(size, size).ensureAlpha().raw().toBuffer();
  const xor = Buffer.alloc(size * size * 4);
  for (let y = 0; y < size; y++) {
    const src = (size - 1 - y) * size * 4; // rows bottom-up
    const dst = y * size * 4;
    for (let x = 0; x < size; x++) {
      const s = src + x * 4;
      const d = dst + x * 4;
      xor[d] = rgba[s + 2]; // B
      xor[d + 1] = rgba[s + 1]; // G
      xor[d + 2] = rgba[s]; // R
      xor[d + 3] = rgba[s + 3]; // A
    }
  }
  // 1bpp AND mask, rows padded to 4 bytes; all-zero since alpha carries opacity.
  const andStride = Math.ceil(Math.ceil(size / 8) / 4) * 4;
  const andMask = Buffer.alloc(andStride * size, 0);

  const header = Buffer.alloc(40);
  header.writeUInt32LE(40, 0); // biSize
  header.writeInt32LE(size, 4); // biWidth
  header.writeInt32LE(size * 2, 8); // biHeight = XOR + AND
  header.writeUInt16LE(1, 12); // biPlanes
  header.writeUInt16LE(32, 14); // biBitCount
  header.writeUInt32LE(0, 16); // BI_RGB
  header.writeUInt32LE(xor.length + andMask.length, 20); // biSizeImage
  return Buffer.concat([header, xor, andMask]);
}

function buildIco(images) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(images.length, 4);

  const entries = [];
  let offset = 6 + images.length * 16;
  for (const { size, buffer } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0); // width (0 = 256)
    e.writeUInt8(size >= 256 ? 0 : size, 1); // height
    e.writeUInt8(0, 2); // palette count
    e.writeUInt8(0, 3); // reserved
    e.writeUInt16LE(1, 4); // color planes
    e.writeUInt16LE(32, 6); // bpp
    e.writeUInt32LE(buffer.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += buffer.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.buffer)]);
}

const images = [];
for (const size of [16, 24, 32, 48, 64, 128]) {
  images.push({ size, buffer: await bmpDib(size) });
}
// 256px as PNG (the one size the shell renders as PNG reliably).
images.push({ size: 256, buffer: await sharp(svg, { density: 384 }).resize(256, 256).png().toBuffer() });

writeFileSync(join(buildDir, "icon.ico"), buildIco(images));
console.log(`wrote build/icon.ico (BMP 16–128 + PNG 256)`);
