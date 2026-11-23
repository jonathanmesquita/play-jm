/*
 * Conferência do site no Chromium, com os cabeçalhos de produção do `vercel.json`
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

/* Lê o `vercel.json`: cada regra tem um `source` (com `(.*)` para "qualquer coisa") e os cabeçalhos. */
const REGRAS = JSON.parse(fs.readFileSync(path.join(RAIZ, "vercel.json"), "utf8")).headers;
const casa = (source, caminho) => new RegExp(`^${source.replace(/\(\.\*\)/g, ".*")}$`).test(caminho);

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
    for (const regra of REGRAS) {
      if (casa(regra.source, caminho)) for (const h of regra.headers) cabecalhos[h.key] = h.value;
    }
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

      /* Sentinela de "o CSS foi aplicado": com HTML novo e CSS velho, os rádios dos filtros aparecem e o cartão perde a borda. */
      const estilo = await page.evaluate(() => ({
        radios: [...document.querySelectorAll(".filtros input")].map((i) => getComputedStyle(i).opacity),
        borda: getComputedStyle(document.querySelector("article.cartao")).borderTopWidth,
        marcadores: getComputedStyle(document.querySelector(".trilho")).listStyleType
      }));
      assert.deepEqual([...new Set(estilo.radios)], ["0"], "os rádios dos filtros devem estar escondidos (CSS não aplicado?)");
      assert.equal(estilo.borda, "2px", "o cartão deve ter borda de 2px (CSS não aplicado?)");
      assert.equal(estilo.marcadores, "none", "a lista de cartões não pode ter marcadores (CSS não aplicado?)");

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

      const fontes = await page.evaluate(async () => {
        await document.fonts.ready;
        return [...document.fonts].filter((f) => f.status === "loaded").map((f) => f.family.replaceAll('"', ""));
      });
      assert.ok(fontes.includes("Press Start 2P"), `a fonte de pixel não carregou (carregadas: ${fontes.join(", ")})`);
      assert.ok(fontes.includes("Inter Variable"), `a fonte do texto não carregou (carregadas: ${fontes.join(", ")})`);

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

test("os jogos no ar apontam para os endereços certos e os títulos trancados não têm link nem botão", async () => {
  const { page, context } = await abrir({ width: 1440, height: 900 });
  try {
    /* Cada "Jogar" diz de qual jogo é (o nome acessível contém o texto visível "Jogar"). */
    const destinos = {
      "Arriba Jump": "https://arriba-jump.jm.dev.br",
      "JJ — CONTINUE COMIGO": "https://jj-continue-comigo.jm.dev.br"
    };
    for (const [titulo, destino] of Object.entries(destinos)) {
      const links = page.getByRole("link", { name: `Jogar ${titulo}` });
      const hrefs = await links.evaluateAll((els) => els.map((e) => e.href.replace(/\/$/, "")));
      assert.ok(hrefs.length >= 1, `falta o link "Jogar ${titulo}"`);
      assert.ok(hrefs.every((h) => h === destino), `"Jogar ${titulo}" deve apontar para ${destino}, mas aponta para ${hrefs}`);
      for (const texto of await links.allTextContents()) assert.match(texto, /Jogar/, "o texto visível do botão contém Jogar");
    }
    /* O destaque e o cartão do Arriba Jump + o cartão do JJ: três botões, e nenhum outro título tem. */
    assert.equal(await page.getByRole("link", { name: /^Jogar / }).count(), 3);
    assert.equal(
      await page.getByRole("link", { name: "Código" }).getAttribute("href"),
      "https://github.com/jonathanmesquita/arriba-jump"
    );

    const trancados = page.locator("article.trancado");
    assert.equal(await trancados.count(), 3, "Caetano, Dossiê 92 e um jogo ainda sem nome");
    assert.equal(await trancados.locator("a, button").count(), 0, "título trancado não pode ter link nem botão");

    /* Cada cartão: título, situação e etiquetas exatas. Gênero só onde o jogo tem ficha; o resto fica sem. */
    const lido = async (cartao) => ({
      titulo: (await cartao.locator("h3").textContent()).trim(),
      situacao: (await cartao.locator(".selo").textContent()).trim(),
      etiquetas: await cartao.locator(".etiquetas li").allTextContents()
    });
    const noAr = page.locator("article.cartao:not(.trancado)");
    assert.deepEqual(await Promise.all((await noAr.all()).map(lido)), [
      { titulo: "Arriba Jump", situacao: "No ar", etiquetas: ["Plataforma", "Runner", "Pixel art"] },
      { titulo: "JJ — CONTINUE COMIGO", situacao: "No ar", etiquetas: ["Visual novel", "Pixel art", "Godot 4"] }
    ]);
    assert.deepEqual(await Promise.all((await trancados.all()).map(lido)), [
      { titulo: "Caetano: Entre Mundos", situacao: "Em desenvolvimento", etiquetas: ["Plataforma 2D", "Pixel art", "Godot 4"] },
      { titulo: "Dossiê 92", situacao: "Em breve", etiquetas: [] },
      { titulo: "Jogo 3", situacao: "Em breve", etiquetas: [] }
    ]);

    /* O site público não carrega a senha do JJ: só avisa que o acesso é com senha. */
    assert.match(await page.content(), /Acesso com senha\./);
  } finally {
    await context.close();
  }
});

test("os filtros mostram só o que casa, escondem a fileira vazia e funcionam por teclado", async () => {
  const { page, context } = await abrir({ width: 1440, height: 900 });
  try {
    const visiveis = async () =>
      page.locator("article.cartao h3").evaluateAll((hs) =>
        hs.filter((h) => h.getClientRects().length > 0).map((h) => h.textContent.trim())
      );
    const fileiras = async () =>
      page.locator(".fileira > h2").evaluateAll((hs) => hs.filter((h) => h.getClientRects().length > 0).map((h) => h.textContent.trim()));

    assert.deepEqual(await visiveis(), ["Arriba Jump", "JJ — CONTINUE COMIGO", "Caetano: Entre Mundos", "Dossiê 92", "Jogo 3"]);
    assert.deepEqual(await fileiras(), ["Em destaque", "Em breve"]);
    assert.equal(await page.locator(".rank:visible").count(), 2, "os numerais aparecem no filtro Todos");

    const casos = [
      ["No ar", ["Arriba Jump", "JJ — CONTINUE COMIGO"], ["Em destaque"]],
      ["Plataforma", ["Arriba Jump", "Caetano: Entre Mundos"], ["Em destaque", "Em breve"]],
      ["Visual novel", ["JJ — CONTINUE COMIGO"], ["Em destaque"]],
      ["Em breve", ["Caetano: Entre Mundos", "Dossiê 92", "Jogo 3"], ["Em breve"]]
    ];
    for (const [rotulo, titulos, secoes] of casos) {
      await page.locator(".filtros label", { hasText: new RegExp(`^${rotulo}$`) }).click();
      assert.deepEqual(await visiveis(), titulos, `filtro "${rotulo}"`);
      assert.deepEqual(await fileiras(), secoes, `fileiras no filtro "${rotulo}"`);
      assert.equal(await page.locator(".rank:visible").count(), 0, "filtrado, o numeral não faz sentido e some");
    }

    /* Teclado: foco no rádio "Todos" e seta para a direita seleciona "No ar". */
    await page.locator(".filtros label", { hasText: /^Todos$/ }).click();
    await page.locator("#f-todos").focus();
    await page.keyboard.press("ArrowRight");
    assert.ok(await page.locator("#f-live").isChecked(), "a seta para a direita deve selecionar o próximo filtro");
    assert.deepEqual(await visiveis(), ["Arriba Jump", "JJ — CONTINUE COMIGO"]);
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

test("os arquivos de /assets revalidam: sem cache longo, porque o nome não tem versão", async () => {
  /* Já deu errado: com max-age=86400, quem visitou no mesmo dia ficou com o CSS velho e o HTML novo (página sem estilo). */
  for (const caminho of ["/assets/css/style.css", "/assets/img/games/arriba-jump.webp", "/assets/icons/favicon.ico"]) {
    const cache = (await fetch(`${base}${caminho}`)).headers.get("cache-control") ?? "";
    assert.match(cache, /max-age=0/, `${caminho}: deve revalidar (max-age=0), mas veio "${cache}"`);
    assert.match(cache, /must-revalidate/, `${caminho}: deve ter must-revalidate`);
  }
  assert.match(await (await fetch(`${base}/`)).text(), /href="\/assets\/css\/style\.css\?v=\d+"/, "o link do CSS carrega ?v=, para tirar a cópia velha do cache");
});

test("o favicon declarado existe, tem os tamanhos certos e os ícones e robots.txt são servidos", async () => {
  for (const caminho of ["/assets/icons/favicon.ico", "/assets/icons/apple-touch-icon.png", "/robots.txt"]) {
    assert.equal((await fetch(`${base}${caminho}`)).status, 200, caminho);
  }

  /* O .ico precisa ter os tamanhos que o HTML declara; com uma imagem só, o navegador reduz sozinho e borra. */
  const ico = Buffer.from(await (await fetch(`${base}/assets/icons/favicon.ico`)).arrayBuffer());
  assert.equal(ico.readUInt16LE(2), 1, "o arquivo não é um .ico");
  const tamanhos = Array.from({ length: ico.readUInt16LE(4) }, (_, i) => ico[6 + 16 * i] || 256).sort((x, y) => x - y);
  assert.deepEqual(tamanhos, [16, 32, 48, 64], "o favicon.ico deve ter 16, 32, 48 e 64 px");

  /* O ícone do iPhone ignora transparência e tem 180 px: PNG sem canal alfa. */
  const apple = Buffer.from(await (await fetch(`${base}/assets/icons/apple-touch-icon.png`)).arrayBuffer());
  assert.equal(apple.readUInt32BE(16), 180);
  assert.equal(apple.readUInt32BE(20), 180);
  assert.equal(apple[25], 2, "o apple-touch-icon deve ser RGB, sem transparência");
});
