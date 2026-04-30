import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

// Ícono base — círculo verde con la letra K
const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#059669"/>
  <text x="256" y="340" font-family="system-ui, sans-serif" font-size="300"
    font-weight="700" fill="white" text-anchor="middle">K</text>
</svg>
`;

const svgBuffer = Buffer.from(svg);

await sharp(svgBuffer)
  .resize(192, 192)
  .png()
  .toFile("public/icons/icon-192.png");
await sharp(svgBuffer)
  .resize(512, 512)
  .png()
  .toFile("public/icons/icon-512.png");

console.log("✅ Íconos generados correctamente");
