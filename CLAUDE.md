# Foco · Equilíbrio — memória compartilhada entre máquinas (Claude Code)

> As sessões do Claude Code do **Mac (casa)** e do **PC da Empresa** NÃO compartilham histórico de chat.
> A única coisa compartilhada é **este repositório git**. Por isso este arquivo é a memória comum.
> **No início de cada sessão:** dê `git pull`, leia o **`HANDOFF.md`** (onde paramos + próximos passos) e depois este arquivo (arquitetura). **No fim:** atualize o **`HANDOFF.md`** e dê `git add -A && git commit && git push`.
> Nome do projeto para o usuário: **"HTML - Foco"**.

## Projeto (v2 "Equilíbrio", desde 2026-09-19)
- PWA pessoal: **`index.html`** (UI + sync, ES5, ~1290 linhas) + **`equilibrio.js`** (domínio puro, `window.EQ`, ~840 linhas) + `sw.js` + `manifest.json` + ícones.
- Publicado no **GitHub Pages**: https://dkonrad88.github.io/Foco/ · Repo `github.com/dKonrad88/Foco`, branch **`main`**.
- **Ideia:** estruturar a vida em **7 pilares** (Treino, Sono, Alimentação, Conhecimento, Carreira, Descanso e lazer, Débora) com **poucos hábitos de 1 toque**, um **ritual à noite (≤5 min)** e uma **Pontuação de Equilíbrio** estilo "Fitness do Strava" (memória de ~6 semanas), **semáforo semanal** por pilar e **roda da vida** (radar). Tom **neutro, só dados** (sem emoji, sem frases motivacionais, sem celebração).
- **3 abas** (barra inferior): **Hoje** (lista por pilar, 1 toque; cartões "Ontem ficou aberto", "Revisão do mês", faixa de viagem; botão "Fechar o dia"), **Equilíbrio** (pontuação + curva 8 semanas + "Esta semana" semáforo + **roda da vida no final**), **Pilares** (pilares, "Em espera", "Virou rotina", modo viagem, ajustes: conta, lembrete da noite, tema, atualizar app, exportar).
- **Ciclo de vida do hábito:** `ativo` → `rotina` (virou automático: sai da tela, revisão mensal) · `espera` (quero, mas não agora: fica discreto; o app sugere **um por vez** quando o pilar está estável há 4 semanas).
- **Modo viagem = plano mínimo:** Treino fica verde com 1 treino qualquer na semana; "Comi bem" 😐 vale como bem; os outros pilares pausam (neutros).
- Perfil do usuário que originou o desenho (respostas do questionário): arquivo **privado fora do git** no PC da Empresa (`G:\g_Diego\HTML\Foco-perfil\perfil-foco.md`). **Não versionar** (o repo é público).
- **PWA:** celular/instalado = tela cheia; desktop = mockup de celular. Identidade da suíte: Inter, azul `#185FA5`, tema escuro padrão.

## Onde vivem os dados (NÃO PERDER)
- **Código** → git. **Dados** → Supabase (`foco_state`, chaves **`v2_*`**) + localStorage prefixo **`foco2_`** (offline-first).
- **Contrato completo: [`CONTRATO.md`](CONTRATO.md)** (tabela, chaves, JSON, regra da pontuação, como o HUB lê).
- Chaves v1 (`habits`, `logs`, `counter`, `metas`, `theme`) e localStorage `focoapp_*` estão **congeladas**: o v2 nunca lê nem escreve. Snapshot no Supabase: **`backup.foco_state_v1_20260919`** (schema `backup`, só service_role).
- ⚠️ **Regra de ouro do sync (implementada):** só grava depois de um **pull bem-sucedido** (`pulledOk`); toda subida **relê a nuvem e faz merge** antes do upsert (`subir()`); merge por `_t` (plano/ajustes por objeto, registros **por dia**); semente `_t:0` perde para qualquer edição real; valida antes de subir (plano com pilares e hábitos, registros objeto, ajustes com `inicio`) e **aborta** se inválido; instâncias na mesma origem (aba, iframe do HUB, PWA) se juntam via `storage`/`juntarLS`.

## Supabase (compartilhado com o HUB)
- Projeto `jlouesrrmqeauzlgvrpw` · URL `https://jlouesrrmqeauzlgvrpw.supabase.co` · chave anon publishable no HTML.
- `foco_state` (RLS `own_rows`), `foco_push_subs` (assinaturas de push, RLS `own_push_subs`).
- Edge Functions: **`foco-cron-push`** (v2: lembrete da noite inteligente, `verify_jwt=false` + header `x-cron-key`; chamada a cada minuto pelo `pg_cron` job `foco-push-tick`) e **`foco-send-push`** (botão "Enviar teste", `verify_jwt=true`). **Fonte das funções fica FORA do git** (tem VAPID privada e cron-key embutidas; ideal mover para secrets do Supabase).

## Domínio (`equilibrio.js`) — fonte única da regra
- `EQ.seed`, datas (`iso/hoje/addDias/diffDias/inicioSemana`), `cumprimentoHabito/Pilar/Geral`, `serie`, **`pontuacao`**, `progresso`, `sugestao`, `revisaoRotinaDevida`, **`mergeEstado`**, `resumo`, `_selfTest()` (98 asserções; rode no console: `EQ._selfTest()`).
- **O HUB carrega este arquivo** (`https://dkonrad88.github.io/Foco/equilibrio.js`) em vez de portar funções. Mudou a regra aqui → HUB acompanha sozinho. Mudou o **formato** → atualizar `CONTRATO.md`, o módulo `FOCO` do HUB e a `foco-cron-push`.
- SW: `equilibrio.js` é **network-first** (Foco `foco-v3` e HUB `hub-v36`). Cada SW só apaga caches com o próprio prefixo (a origem é compartilhada pela suíte).

## Relação com o HUB Pessoal
- Módulo **`var FOCO`** no `index.html` do hubpessoal (container `#focoDash`, aberto pelo `EMBED` na view "Resumo" da página `habits`): **read-only**, lê `v2_plano/v2_registros/v2_ajustes`, calcula com `EQ` e mostra **Pontuação + curva**, **Semáforo semanal** (6 semanas + hoje) e **Roda da vida**. A view "Trabalhar no app" é o iframe do próprio Foco.

## Ambiente / fluxo entre máquinas
- Usuário diz **"tô no PC da Empresa"** ou **"tô no Mac"**. **Mac (casa)** = máquina canônica.
- PC da Empresa: **sem node e sem python** (o `python` é stub) → **perl** para scripts; `pdftotext` em `/mingw64/bin`. Git com `autocrlf=true` (working copy CRLF, repo LF — normal).
- Validar: balanço `{}()[]`, zero mojibake (`Ã`), ES5 no app/`equilibrio.js`, e **rodar no navegador** (`EQ._selfTest()` + abrir o app sem login).
- Publicar: bump do `CACHE` no `sw.js` (`foco-vN`), commit + push (Pages publica sozinho). Usuário testa no iPhone via "Atualizar app".

## Log de handoff (a sessão mais recente escreve no topo)
- **2026-09-19 — PC da Empresa — 🔄 REESTRUTURAÇÃO v2 "Equilíbrio" (reescrita completa):** o usuário não usava o app (esquecia de abrir + 37 hábitos pesavam). Fizemos um questionário (9 + 31 + 11 perguntas) → **7 pilares**, hábitos de 1 toque, ritual à noite, **Pontuação de Equilíbrio** (EWMA τ=42 sobre cumprimento vs. plano), semáforo + roda da vida, estados ativo/espera/rotina, modo viagem = plano mínimo, push só se o dia estiver aberto. Layout escolhido entre 5 mockups: **Modelo 1** (abas Hoje · Equilíbrio · Pilares) com a roda da vida no fim da aba Equilíbrio. **Histórico v1 não aparece no app novo** (pedido do usuário); chaves v1 congeladas + backup `backup.foco_state_v1_20260919`. Novo `equilibrio.js` compartilhado com o HUB; módulo `FOCO` do HUB reescrito; `foco-cron-push` v2 (lembretes por hábito aposentados). Contrato em `CONTRATO.md`. Construído via workflow multiagente (domínio → app/HUB/push em paralelo → 5 revisores + verificação → correções) e testado no navegador (self-test 98/98, telas, viagem, navegação de datas, **sync contra nuvem simulada**: aparelho novo, merge com outro aparelho, nuvem mais nova vence semente, estado inválido aborta).
- **2026-08-13 — Mac — Modo "Você" + notificações push** (v1, substituído pelo v2).
- **2026-07-27 — Mac — Vista Semana + agendamento por dia** (v1, substituído pelo v2).
- **2026-07-06 — Mac — PWA, identidade da suíte, Metas anuais** (v1; metas anuais removidas no v2).
- **2026-06-21 — Mac — Criado este CLAUDE.md** (v1).
