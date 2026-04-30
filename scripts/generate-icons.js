import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <rect width="512" height="512" rx="96" fill="#689EC2"/>
  
  <!-- K esquina superior izquierda -->
  <text x="52" y="112" font-family="system-ui, sans-serif" font-size="90"
    font-weight="700" fill="white" opacity="0.75">K</text>

  <!-- Tallo -->
  <line x1="256" y1="420" x2="256" y2="240"
    stroke="white" stroke-width="18" stroke-linecap="round"/>

  <!-- Hoja izquierda -->
  <path d="M 256 330 Q 180 300 185 240 Q 228 268 256 330"
    fill="white" opacity="0.95"/>

  <!-- Hoja derecha -->
  <path d="M 256 300 Q 332 270 327 210 Q 284 238 256 300"
    fill="white" opacity="0.95"/>

  <!-- Línea de pulso -->
  <path d="M 80 420 L 140 420 L 165 370 L 200 470 L 230 390 L 256 420 L 432 420"
    stroke="white" stroke-width="14" fill="none"
    stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>
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
