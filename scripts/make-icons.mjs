// Renders public/favicon.svg into the PNG icons the PWA manifest and iOS need.
import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';

const svg = readFileSync(new URL('../public/favicon.svg', import.meta.url), 'utf8');
const square = svg.replace('rx="112"', 'rx="0"');
const browser = await chromium.launch();
const page = await browser.newPage();
async function render(file, size, markup, padding = 0) {
  await page.setViewportSize({ width: size, height: size });
  const inner = size - padding * 2;
  await page.setContent(
    `<html><body style="margin:0;background:#0b0f14;display:flex;align-items:center;justify-content:center;width:${size}px;height:${size}px">` +
      markup.replace('<svg ', `<svg width="${inner}" height="${inner}" `) +
      '</body></html>',
  );
  await page.screenshot({ path: new URL(`../public/${file}`, import.meta.url).pathname });
}
await render('pwa-192.png', 192, square);
await render('pwa-512.png', 512, square);
await render('pwa-maskable-512.png', 512, square, 64);
await render('apple-touch-icon.png', 180, square);
await browser.close();
