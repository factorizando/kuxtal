import sharp from "sharp";
import { mkdir } from "fs/promises";

await mkdir("public/icons", { recursive: true });

const svg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">

  <!-- Fondo -->
  <rect width="512" height="512" fill="#689EC2"/>

  <!-- K blanca sólida — centrada, con espacio arriba y abajo -->
  <text
    x="256" y="322"
    text-anchor="middle"
    font-family="Arial, Helvetica, sans-serif"
    font-size="210"
    font-weight="700"
    fill="#F4F2ED">K</text>

  <!-- Ave estilo gaviota — esquina superior derecha -->
  <path d="M 320 148 Q 358 92 396 148"
    stroke="#F4F2ED" stroke-width="22" fill="none" stroke-linecap="round"/>
  <path d="M 396 148 Q 434 92 468 142"
    stroke="#F4F2ED" stroke-width="22" fill="none" stroke-linecap="round"/>

  <!-- ECG — claramente debajo de la K -->
  <path d="M 28 390 L 148 390 L 182 355 L 218 412 L 250 372 L 278 390 L 484 390"
    stroke="#F4F2ED" stroke-width="16" fill="none"
    stroke-linecap="round" stroke-linejoin="round"/>

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

console.log("✅ Íconos generados: icon-192.png e icon-512.png");
