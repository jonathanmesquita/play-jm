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

- Uma página, em português, com **dois jogos no ar**, o Arriba Jump e **JJ — CONTINUE COMIGO**
  (este com acesso por senha), e três títulos trancados: **Caetano: Entre Mundos** ("Em
  desenvolvimento") e Dossiê 92 e Jogo 3 ("Em breve").
- **Etiquetas** de gênero, estilo e motor, só onde o jogo tem ficha: Arriba Jump (Plataforma,
  Runner, Pixel art), JJ (Visual novel, Pixel art, Godot 4) e Caetano (Plataforma 2D, Pixel art,
  Godot 4). Dossiê 92 e Jogo 3 não têm etiqueta: o gênero só entra quando o dono o declara.
- **Estrutura do catálogo do portfólio, em pixel art:** jogo em destaque, filtros em pílula
  (Todos, No ar, Plataforma, Visual novel, Em breve), a fileira "Em destaque" com numerais
  grandes só de contorno, a fileira "Em breve" e os títulos trancados com cadeado.
- **Filtros sem JavaScript:** são rádios nativos + `:has()`, então funcionam por teclado (setas)
  e a CSP continua bloqueando qualquer script (`script-src 'none'`).
- Acessível: um `<h1>`, `alt` nas imagens, foco visível e link para pular ao conteúdo.
- Responsivo, de 320 a 1440 px, sem rolagem lateral.

## Stack

HTML e CSS puros. As fontes (Press Start 2P nos títulos e Inter, a do portfólio, no texto; as
licenças OFL estão em `assets/fonts/`) são hospedadas no próprio site. As cores são os tokens do
portfólio (tinta, argila, creme). Playwright e axe-core existem só para os testes. Hospedagem na Vercel,
com os cabeçalhos em `vercel.json` e o DNS no Cloudflare.

## Arquitetura

```text
index.html                       a página
vercel.json                      CSP e demais cabeçalhos de segurança
assets/
├── css/style.css                estilo único; cores só por token, cada par medido em contraste
├── fonts/                       Press Start 2P e Inter + licenças OFL
├── icons/
│   ├── favicon.ico              16, 32, 48 e 64 px (o teste confere)
│   ├── apple-touch-icon.png     180 px, fundo opaco (o iOS ignora transparência)
│   └── controle-256.png         arte original, sem perda: de onde saem os outros tamanhos
└── img/
    ├── games/                   uma imagem por jogo (hoje: arriba-jump.webp, cortada do jogo)
    └── og.png                   imagem social 1200x630 (gerada por `npm run og`)
404.html                         a página "Game Over" (a Vercel a serve em endereço que não existe)
scripts/og/                      og.html (o modelo) e render.mjs (gera assets/img/og.png)
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
carregadas (as duas fontes); zero violações WCAG A/AA no axe. Confere também que os dois jogos no
ar apontam para os endereços certos, que cada cartão tem título, situação e etiquetas exatas, que
os títulos trancados não têm link nem botão, que **cada filtro mostra só o que casa** (e esconde a
fileira que ficou vazia, e funciona por teclado) e que o HTML não tem script nem estilo inline.

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

- **Mesma estrutura do portfólio, visual de pixel.** O dono pediu que o Play se parecesse com o
  catálogo do `jm.dev.br`, mas em pixel art. Game dev continua separado (endereço próprio), só
  que com a mesma linguagem: tokens de cor, destaque, filtros, fileiras e cartões. O que é do
  Play é o pixel: Press Start 2P, bordas retas e sombra dura, sem canto arredondado.
- **Título trancado sem descrição.** Nenhum trancado tem texto além do nome, da situação e da
  ficha (gênero, estilo, motor) que o dono forneceu: o jogo ainda não existe, e nada é inventado.
  Para destrancar, troque o cartão por um completo em `index.html`, com o botão "Jogar" e o
  `aria-label` "Jogar <título>" (há mais de um botão Jogar na página).
- **Os arquivos de `assets/` revalidam a cada visita** (`Cache-Control: max-age=0, must-revalidate`
  no `vercel.json`), porque o nome deles não tem versão. Já deu errado: com `max-age=86400`, quem
  visitou no mesmo dia ficou com o **CSS velho e o HTML novo**, e a página saiu sem estilo (rádios
  dos filtros à mostra, lista com marcador). Dois testes guardam isso: um confere o cabeçalho e
  o outro confere que o CSS foi aplicado. Se um dia for preciso tirar um arquivo do cache de quem
  já o guardou, mude o `?v=` no link (hoje `style.css?v=2`).
- **Jogo com senha.** O JJ está no ar em `jj-continue-comigo.jm.dev.br`, com a senha configurada
  na Vercel (*Deployment Protection*) por quem o publica. **A senha não fica neste repositório
  nem na página**: o cartão só avisa que o acesso é com senha, e um teste confere que a página
  não a carrega.
- **Sem JavaScript.** Uma vitrine não precisa dele, e a CSP fica mais fechada por isso.
- **Imagem só do que é do projeto.** O pôster é do Arriba Jump (do dono). O ícone, um controle
  de jogo em pixel art, foi importado pelo dono em 256 px; a ferramenta que o gerou **ainda não
  está anotada aqui** (anotar). Os tamanhos de 16 a 64 px e o ícone do iOS saem dele, reduzidos
  com LANCZOS, porque a arte tem bordas suavizadas e não é pixel exato. Arte de terceiros só
  entra com licença e origem anotada.

## Detalhes de jogo, sem enfeite à toa

- **Placar no topo** ("No ar 2 · Em breve 3"): números reais, e um teste confere que batem com
  os cartões, para o placar não ficar velho.
- **Botões que afundam** ao apertar (sombra dura de 4 px que some), com três estados medidos em teste.
- **404 "Game Over"** com a saída "Continuar", que não é indexada.
- **Imagem social** para o link ficar bonito no WhatsApp e no LinkedIn. O modelo está em
  `scripts/og/og.html`; depois de mudar o texto ou a arte, rode `npm run og`.
- **Sem movimento automático** (nada pisca nem anima sozinho): o movimento é só ao passar o mouse
  ou apertar, e some com `prefers-reduced-motion`.

## Roadmap

- [ ] Destrancar cada título quando houver o que mostrar (um por vez), com o gênero dele.
- [ ] Versão de 16 px do ícone desenhada à mão (hoje ela vira uma mancha laranja com um ponto verde).
- [ ] Inglês, se a página ganhar público fora do Brasil.
