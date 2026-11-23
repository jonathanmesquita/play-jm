# Play JM

> **EN:** The creative side of Jonathan Mesquita: games and pixel art under the name
> **Sapo Pixelado**, kept apart from the software portfolio at
> [jm.dev.br](https://jm.dev.br). A static site — plain HTML and CSS, no JavaScript, no build.
> Address: **https://play.jm.dev.br**.

**Versão:** 0.1.0 · **Estado:** protótipo

## Problema

Jogos e pixel art são hobby e não devem competir com os projetos de software no portfólio
profissional, que cita esse lado numa frase só. Falta um lugar próprio para eles.

## Solução

Um site pequeno e separado, com o que já está no ar (Arriba Jump) e os títulos que estão
chegando, **trancados** até haver algo para mostrar. Um título trancado não tem link nem botão.

## Funcionalidades

- Uma página, em português, com o Arriba Jump no ar e quatro títulos trancados: **JJ — CONTINUE
  COMIGO** e **Caetano: Entre Mundos** ("Em desenvolvimento") e Dossiê 92 e Jogo 3 ("Em breve").
- **Etiquetas** de gênero, estilo e motor, só onde o jogo tem ficha: Arriba Jump (Plataforma,
  Runner, Pixel art), JJ (Visual novel, Pixel art, Godot 4) e Caetano (Plataforma 2D, Pixel art,
  Godot 4). Dossiê 92 e Jogo 3 não têm etiqueta: o gênero só entra quando o dono o declara.
- Sem JavaScript. A CSP bloqueia qualquer script (`script-src 'none'`).
- Acessível: um `<h1>`, `alt` nas imagens, foco visível e link para pular ao conteúdo.
- Responsivo, de 320 a 1440 px, sem rolagem lateral.

## Stack

HTML e CSS puros. A fonte de pixel (Press Start 2P, licença OFL em `assets/fonts/`) é hospedada
no próprio site. Playwright e axe-core existem só para os testes. Hospedagem na Vercel,
com os cabeçalhos em `vercel.json` e o DNS no Cloudflare.

## Arquitetura

```text
index.html                       a página
vercel.json                      CSP e demais cabeçalhos de segurança
assets/
├── css/style.css                estilo único; cores só por token, cada par medido em contraste
├── fonts/                       Press Start 2P + licença OFL
├── icons/
│   ├── favicon.ico              16, 32, 48 e 64 px (o teste confere)
│   ├── apple-touch-icon.png     180 px, fundo opaco (o iOS ignora transparência)
│   └── controle-256.png         arte original, sem perda: de onde saem os outros tamanhos
└── img/games/                   uma imagem por jogo (hoje: arriba-jump.webp, cortada do jogo)
tests/site.test.mjs              Chromium + axe + CSP
```

Imagem nova de jogo entra em `assets/img/games/<jogo>.webp`; ícone, em `assets/icons/`.

## Rodar localmente

Não há build. Qualquer servidor estático serve:

```bash
python3 -m http.server 8000
```

## Testes

```bash
npm ci && npx playwright install chromium   # uma vez
npm test
```

Abre o site no Chromium com os cabeçalhos do `vercel.json` e confere, em 320, 390 e 1440 px:
nenhum erro de console, de CSP ou de rede; sem rolagem lateral; um `<h1>`; imagens e fonte
carregadas; zero violações WCAG A/AA no axe. Confere também que o Arriba Jump aponta para os
endereços certos, que os títulos trancados não têm link nem botão e que o HTML não tem script
nem estilo inline.

## Variáveis de ambiente

Nenhuma.

## Deploy

Vercel, com o preset `Other`, sem comando de build e sem diretório de saída: a raiz do
repositório é servida como está. O domínio `play.jm.dev.br` é um CNAME no Cloudflare apontando
para a Vercel, com o proxy do Cloudflare **desligado** (só DNS), senão o certificado pode falhar.
A Vercel só aplica os cabeçalhos do `vercel.json`; um arquivo `_headers` (formato do Cloudflare
Pages) seria ignorado. Depois de cada deploy, confira que o commit de produção é da `main`
deste repositório.

## Decisões

- **Separado do portfólio.** Game dev é hobby; ele tem o próprio endereço e o próprio visual
  (escuro, com fonte de pixel), diferente do `jm.dev.br`.
- **Título trancado sem descrição.** Nenhum trancado tem texto além do nome, da situação e da
  ficha (gênero, estilo, motor) que o dono forneceu: o jogo ainda não existe, e nada é inventado. Para destrancar, troque o cartão trancado por um completo em `index.html`.
- **Sem JavaScript.** Uma vitrine não precisa dele, e a CSP fica mais fechada por isso.
- **Imagem só do que é do projeto.** O pôster é do Arriba Jump (do dono). O ícone, um controle
  de jogo em pixel art, foi importado pelo dono em 256 px; a ferramenta que o gerou **ainda não
  está anotada aqui** (anotar). Os tamanhos de 16 a 64 px e o ícone do iOS saem dele, reduzidos
  com LANCZOS, porque a arte tem bordas suavizadas e não é pixel exato. Arte de terceiros só
  entra com licença e origem anotada.

## Roadmap

- [ ] Destrancar cada título quando houver o que mostrar (um por vez), com o gênero dele.
- [ ] Versão de 16 px do ícone desenhada à mão (hoje ela vira uma mancha laranja com um ponto verde).
- [ ] Filtro por gênero (como no portfólio). Exige JavaScript e afrouxar a CSP; só vale com mais títulos.
- [ ] Imagem social (`og:image`) da página.
- [ ] Inglês, se a página ganhar público fora do Brasil.
