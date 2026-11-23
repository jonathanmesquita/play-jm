/*
 * Conferência do site no Chromium, com os cabeçalhos de produção do arquivo `_headers`
 * (CSP incluída). Roda com `npm test` e em todo pull request (.github/workflows/ci.yml).
 *
 * O que guarda: a página abre sem erro de console, de CSP ou de rede, de 320 a 1440 px,
 * sem rolagem horizontal e sem violação WCAG A/AA no axe; imagens e fonte carregam; o
 * Arriba Jump aponta para os endereços certos; os títulos trancados não têm link nem botão;
 * e o HTML não tem script nem estilo inline, que a CSP não deixaria rodar.
 */

import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { chromium } from "playwright";

const RAIZ = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const AXE = fs.readFileSync(path.join(RAIZ, "node_modules/axe-core/axe.min.js"), "utf8");

const TIPOS = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8"
};

/* Lê o `_headers` do Cloudflare Pages: um padrão por bloco (com `*` no fim) e os cabeçalhos indentados. */
function lerCabecalhos() {
  const blocos = [];
  let atual = null;
  for (const linha of fs.readFileSync(path.join(RAIZ, "_headers"), "utf8").split("\n")) {
    if (!linha.trim()) continue;
    if (!linha.startsWith(" ")) {
      atual = { padrao: linha.trim(), cabecalhos: {} };
      blocos.push(atual);
    } else {
      const i = linha.indexOf(":");
      atual.cabecalhos[linha.slice(0, i).trim()] = linha.slice(i + 1).trim();
    }
  }
  return blocos;
}

const BLOCOS = lerCabecalhos();
const casa = (padrao, caminho) => new RegExp(`^${padrao.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*")}$`).test(caminho);

function servir() {
  return http.createServer((req, res) => {
    const caminho = new URL(req.url, "http://x").pathname;
    const arquivo = path.join(RAIZ, caminho === "/" ? "index.html" : caminho);
    const permitido = !arquivo.includes("node_modules") && !/\/(tests|\.git)\//.test(arquivo);
    if (!arquivo.startsWith(RAIZ) || !permitido || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) {
      res.writeHead(404);
      return res.end("não encontrado");
    }
    const cabecalhos = { "Content-Type": TIPOS[path.extname(arquivo)] ?? "application/octet-stream" };
    for (const bloco of BLOCOS) if (casa(bloco.padrao, caminho)) Object.assign(cabecalhos, bloco.cabecalhos);
    res.writeHead(200, cabecalhos);
    fs.createReadStream(arquivo).pipe(res);
  });
}

let servidor;
let navegador;
let base;

before(async () => {
  servidor = servir();
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://localhost:${servidor.address().port}`;
  navegador = await chromium.launch();
});

after(async () => {
  await navegador?.close();
  await new Promise((ok) => (servidor ? servidor.close(ok) : ok()));
});

async function abrir(viewport) {
  const context = await navegador.newContext({ viewport });
  await context.addInitScript(() =>
    document.addEventListener("securitypolicyviolation", (e) =>
      console.error(`CSP bloqueou ${e.violatedDirective} ${e.blockedURI}`)
    )
  );
  const page = await context.newPage();
  const erros = [];
  page.on("console", (m) => m.type() === "error" && erros.push(m.text()));
  page.on("pageerror", (e) => erros.push(e.message));
  page.on("response", (r) => r.status() >= 400 && erros.push(`${r.status()} ${r.url()}`));
  await page.goto(`${base}/`);
  await page.waitForSelector("h1");
  return { page, context, erros };
}

for (const [nome, width, height] of [
  ["celular pequeno", 320, 640],
  ["celular", 390, 844],
  ["desktop", 1440, 900]
]) {
  test(`${nome} (${width}px): sem erro, sem rolagem lateral, um <h1> e sem violação do axe`, async () => {
    const { page, context, erros } = await abrir({ width, height });
    try {
      assert.equal(await page.locator("h1").count(), 1, "deve haver um único <h1>");

      const largura = await page.evaluate(() => ({
        pagina: document.documentElement.scrollWidth,
        janela: document.documentElement.clientWidth
      }));
      assert.ok(largura.pagina <= largura.janela, `rolagem lateral: página ${largura.pagina}px em janela de ${largura.janela}px`);

      /* Rola até o fim para as imagens com loading="lazy" carregarem. */
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForFunction(() => [...document.images].every((i) => i.complete));
      const quebradas = await page.$$eval("img", (imgs) => imgs.filter((i) => i.naturalWidth === 0).map((i) => i.src));
      assert.deepEqual(quebradas, [], "imagens que não carregaram");

      assert.ok(await page.evaluate(() => document.fonts.check('16px "Press Start 2P"')), "a fonte de pixel não carregou");

      await page.evaluate(AXE);
      const violacoes = await page.evaluate(async () => {
        const r = await axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"] });
        return r.violations.map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
      });
      assert.deepEqual(violacoes, [], "violações de acessibilidade");
      assert.deepEqual(erros, [], "erros no console, na CSP ou na rede");
    } finally {
      await context.close();
    }
  });
}

test("Arriba Jump aponta para os endereços certos e os títulos trancados não têm link nem botão", async () => {
  const { page, context } = await abrir({ width: 1440, height: 900 });
  try {
    const jogar = page.getByRole("link", { name: "Jogar" });
    assert.equal(await jogar.getAttribute("href"), "https://arriba-jump.jm.dev.br");
    const codigo = page.getByRole("link", { name: "Código" });
    assert.equal(await codigo.getAttribute("href"), "https://github.com/jonathanmesquita/arriba-jump");

    const trancados = page.locator("article.trancado");
    assert.equal(await trancados.count(), 4, "Dossiê 92 e três jogos ainda sem nome");
    assert.equal(await trancados.locator("a, button").count(), 0, "título trancado não pode ter link nem botão");
    assert.equal(await trancados.getByText("Em breve").count(), 4);
  } finally {
    await context.close();
  }
});

test("a CSP é fechada e o HTML não tem script nem estilo inline", async () => {
  const resposta = await fetch(`${base}/`);
  const csp = resposta.headers.get("content-security-policy");
  assert.ok(csp, "falta o cabeçalho Content-Security-Policy");
  assert.ok(!/unsafe-inline|unsafe-eval|\*/.test(csp), "a CSP não pode liberar inline, eval nem curinga");
  assert.match(csp, /script-src 'none'/);
  assert.match(csp, /frame-ancestors 'none'/);
  for (const cabecalho of ["x-content-type-options", "referrer-policy", "permissions-policy", "strict-transport-security"]) {
    assert.ok(resposta.headers.get(cabecalho), `falta o cabeçalho ${cabecalho}`);
  }

  const html = await resposta.text();
  assert.ok(!/<script/i.test(html), "o site não usa JavaScript");
  assert.ok(!/<style/i.test(html) && !/\sstyle=/i.test(html), "nada de estilo inline");
});

test("favicon, ícone do iOS e robots.txt são servidos", async () => {
  for (const caminho of ["/favicon.ico", "/assets/img/apple-touch-icon.png", "/robots.txt"]) {
    assert.equal((await fetch(`${base}${caminho}`)).status, 200, caminho);
  }
});
