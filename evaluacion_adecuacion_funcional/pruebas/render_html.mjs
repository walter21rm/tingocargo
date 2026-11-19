/**
 * Captura en PNG los HTML listados en un manifiesto (usado por capturas_terminal.py).
 * Uso: node render_html.mjs ruta/manifiesto.json
 */
import fs from "fs";
import puppeteer from "puppeteer-core";

const manifiesto = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const browser = await puppeteer.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"]
});
const page = await browser.newPage();
for (const item of manifiesto) {
  await page.setViewport({ width: item.ancho, height: 400, deviceScaleFactor: 1.25 });
  await page.goto(`file://${item.html}`, { waitUntil: "load" });
  await page.screenshot({ path: item.png, fullPage: true });
  console.log(`captura → ${item.png.split("/").pop()}`);
}
await browser.close();
