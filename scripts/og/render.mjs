/*
 * Gera assets/img/og.png (1200x630) a partir de scripts/og/og.html, no Chromium do Playwright.
 * Rode `npm run og` depois de mudar o texto, a arte ou as fontes do modelo.
 */
import path from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..", "..");
const navegador = await chromium.launch();
try {
  const page = await navegador.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(path.join(RAIZ, "scripts/og/og.html")).href);
  await page.evaluate(() => document.fonts.ready);
  const fontes = await page.evaluate(() => [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', "")));
  for (const esperada of ["Press Start 2P", "Inter Variable"]) {
    if (!fontes.includes(esperada)) throw new Error(`A fonte ${esperada} não carregou (carregadas: ${fontes.join(", ")}); a imagem sairia errada.`);
  }
  await page.screenshot({ path: path.join(RAIZ, "assets/img/og.png"), clip: { x: 0, y: 0, width: 1200, height: 630 } });
  console.log("assets/img/og.png gerada (1200x630)");
} finally {
  await navegador.close();
}
