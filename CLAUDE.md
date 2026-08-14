# Foco · Hábitos — memória compartilhada entre máquinas (Claude Code)

> As sessões do Claude Code do **Mac (casa)** e do **PC da Empresa** NÃO compartilham histórico de chat.
> A única coisa compartilhada é **este repositório git**. Por isso este arquivo é a memória comum.
> **No início de cada sessão:** dê `git pull`, leia o **`HANDOFF.md`** (onde paramos + próximos passos) e depois este arquivo (arquitetura). **No fim:** atualize o **`HANDOFF.md`** e dê `git add -A && git commit && git push`.
> Nome do projeto para o usuário: **"HTML - Foco"**.

## Projeto
- App pessoal **single-file**: `index.html` (HTML/CSS/JS, ~1945 linhas, PWA offline-first).
- Publicado no **GitHub Pages**: https://dkonrad88.github.io/Foco/
- Repo: `github.com/dKonrad88/Foco` — branch **`main`**. Arquivos: `index.html`, `manifest.json`, `sw.js`, `apple-touch-icon.png`, `icon-192.png`, `icon-512.png`, `icon.svg`, `CLAUDE.md`, `HANDOFF.md`.
- É um **rastreador de hábitos**. **4 abas** (`setTab(...)`): **Foco** (`foco` — tela do dia), **Hábitos** (`habitos` — cadastro/edição), **Insights** (`insights` — dashboards) e **Metas** (`metas` — **metas anuais**, ver HANDOFF.md).
- A aba **Foco** tem um toggle **Hoje ⇄ Semana** (`focoView`): **Hoje** = a **vista Lista** (o "modo card"/stepper foi removido); **Semana** = **planejador semanal** (`renderWeekView`) que usa o agendamento `h.dias`. Ver HANDOFF.md. ⚠️ Existe outra `renderSemana` (heatmap da aba Hábitos, `habView`) — coisa diferente, não confundir.
- **PWA instalável** (`manifest.json`/`sw.js`/ícones): celular ou app instalado = **tela cheia**; desktop = **mockup de celular** (media query `max-width:480px`/`display-mode:standalone`). Botão "Atualizar app" em Ajustes.
- **Identidade da suíte:** fonte **Inter**, acento **azul `#185FA5` + teal `#1a7a8a`** (`--green` = teal), tema **dark⇄light** (dark padrão; Copa/bandeira BR removidos), cards radius 14px.

## Onde vivem os dados (NÃO PERDER)
- **Código/layout** → `index.html` (versionado no git). Mudanças vão pelo git.
- **Dados do usuário** (hábitos, logs) → **Supabase** + **localStorage** (offline-first). **NÃO** ficam no git.
- localStorage: prefixo **`focoapp_`** (ex.: `focoapp_habits`, `focoapp_logs`, `focoapp_counter`, `focoapp_metas`, `focoapp_theme`, `focoapp_dirty`, `focoapp_lastSync`). A flag `dirty='1'` marca mudanças locais não sincronizadas.
- ⚠️ **Regra de ouro:** offline-first com last-write-wins por chave. No login, se há `dirty` local, o app **pergunta** (enviar local vs baixar nuvem). Cuidado pra não subir estado vazio por cima de dados bons.

## Supabase (compartilhado com o HUB Pessoal)
- **Mesmo projeto** do HUB: `jlouesrrmqeauzlgvrpw` · URL `https://jlouesrrmqeauzlgvrpw.supabase.co`.
- Chave anon (publishable, pode ficar no HTML público): `sb_publishable_ulG1woVG1p1Seax63GGYPQ_PG6-8l-G`.
- Tabela própria: **`foco_state`** — linhas `(user_id, key, value, updated_at)`, `upsert` com `onConflict:'user_id,key'`. Chaves: `habits`, `logs`, `counter`, `metas`, `theme`. (**`metas`** é a chave das metas anuais — aditiva; RLS `own_rows` cobre qualquer chave.)
- O HUB grava em `hub_state` (tabela diferente) — **não se atropelam**. Auth (e-mail/senha) é a mesma conta nos dois.

## Modelo de dados (schema dos hábitos — diferente do HUB de propósito)
- **Hábito** (`habits[]`): `id, nome, icon, cor, cat, tipo, periodo, alvo, unidade, rotulo, tom, tomCustom, atalhos, items, substr, desde, dias`. **`dias`** = array `0..6` (0=dom…6=sáb), agendamento por dia da semana (aditivo, opcional; alimenta a vista Semana e filtra o Hoje via `expectedToday`). Vazio/ausente = comportamento antigo.
- **Log** (`logs[]`): `t` (data/timestamp), `feito`, `valor`, `hora`, `items`, `recaida`, `s`. *(tom "personalizado"/`tomCustom` foi removido — só `padrao`/`evitar`.)*
- **Meta anual** (`metas[]`): `id, hid` (id do hábito de origem), `comp`, `meta`, `sup` (**Compromisso/Meta/Superação**, totais do ano). Agregada por ano com janela **a partir do início real** (`anoStartMonth()` = 1º mês com ≥7 dias de registro; prorateia a meta). Funções: `renderMetas`, `metaState`, `anoAgg`, `criarTodasMetas`, `anualAlvo`, `subirMeta`. **Não** afeta o HUB (o dashboard do HUB não lê a chave `metas`). Detalhes no HANDOFF.md.
- `counter` = contador incremental de IDs. `theme` = tema atual.
- Funções-base: `migrate()` (sobe versões antigas), `normalizeGrouped()` (normaliza), `recount()` (recalcula), `save()`/`load()`, `applyTheme()`/`curTheme()`, `enter()` (entra no dia).

## Relação com o HUB Pessoal (acoplamento intencional)
- O **HUB lê a tabela `foco_state` direto** e renderiza um **dashboard desktop próprio** (módulo `FOCO` no `index.html` do hubpessoal, container `#focoDash`). **Read-only** — só o Foco grava. Versão anterior usava iframe; foi substituída por render nativo desktop (o usuário quer ver no Mac, não a telinha mobile).
- ⚠️ **Acoplamento de schema:** o HUB **porta verbatim** as funções de domínio do Foco (`inPeriod, isDoneLog, metaProgress, metaLine, cleanStreak, streakSoft, expectedToday, cadence, catOrder…`) e os campos do hábito/log (`tipo/tom/periodo/alvo/unidade/cat/desde` · log `valor/feito/items/recaida`). **Se mudar o schema de hábito/log ou essas funções aqui no Foco, o dashboard do HUB pode divergir** — avisar/replicar no `FOCO` do hubpessoal. ⚠️ **Pendência conhecida (2026-07-27):** o Foco agora usa **`h.dias`** em `expectedToday` (agendamento por dia). O HUB tem a `expectedToday` **antiga** (sem `dias`) — não quebra (campo extra é ignorado), mas o "hoje" do HUB pode mostrar um hábito a mais que o Foco já filtrou por dia. Replicar `hasDias`+regra no HUB quando quiser alinhar. A leitura é `sb.from('foco_state').select('key,value')` com chaves `habits`(array)/`logs`(objeto data→id)/`counter`.
- **O Foco é a fonte única de hábitos.** O tracker antigo do HUB (`ht*`) foi aposentado.
- Login: mesmo Supabase/origin → a sessão do HUB já autentica a leitura de `foco_state` (mesma conta).

## Fluxo entre as duas máquinas
- Usuário diz **"tô no PC da Empresa"** ou **"tô no Mac"**. **Mac (casa)** = máquina canônica.
- **Ao começar:** `git pull` + ler este CLAUDE.md. **Ao terminar:** atualizar o "Log de handoff", `git add -A && git commit && git push`.
- Edição pelo app Claude Code (aba Code), nunca pelo Codespace. ⚠️ No Windows, salvar `index.html` sempre em **UTF-8** (evita mojibake).

## Log de handoff (a sessão mais recente escreve no topo)
- **2026-08-13 — Mac — Modo "Você" + notificações push:** sessão grande de **engajamento** (o usuário não tava usando o app — "não tenho motivo pra abrir"). Entregue: (1) **modo "Você"** — a aba Foco abre num espelho das **4 identidades** dele (atleta/fé/parceiro/evolui), cada card com streak+status+hábitos marcáveis; toggle virou Você·Hoje·Semana (`renderVoce`, `IDENTS`, `focoView='voce'` default). (2) Antes: **Vista Semana** + **agendamento por dia** (`h.dias`) + **marcar da Semana**. (3) **Push no iPhone** funcionando (piloto confirmado) + **lembretes por horário** (`h.remind` + Edge Functions `foco-send-push`/`foco-cron-push` + `pg_cron`). Ver HANDOFF.md p/ tudo. Schema do hábito ganhou `dias` e `remind` (aditivos).
- **2026-07-27 — Mac — Vista Semana + agendamento por dia:** nova **sub-aba Semana** dentro de Foco (toggle `focoView` Hoje⇄Semana, `renderWeekView`) e campo **`h.dias`** (dias fixos da semana, seletor no editor do hábito). Resolve a procrastinação dos hábitos de frequência: dá *quando* + visão da semana inteira de antemão. `expectedToday` passou a respeitar `dias` (retrocompatível). Testado no navegador (0 erro). ⚠️ **Divergência com HUB sinalizada** (expectedToday/dias — ver seção acima), **não replicada**. Metas anuais seguem pendentes de validação do usuário. Detalhes: HANDOFF.md.
- **2026-07-06 — Mac — Sessão grande + criado `HANDOFF.md`:** o app virou **só-Lista** (modo card removido), ganhou **PWA instalável**, **identidade da suíte** (Inter, azul `#185FA5`/teal `#1a7a8a`, dark padrão, Copa/bandeira removidos), "Atualizar app" em Ajustes, e a feature nova **Metas anuais** (aba Metas, chave `metas` no `foco_state`, níveis Compromisso/Meta/Superação, janela a partir do início real do registro). Também: removido tom Personalizado; Insights limitado a 5; skill de usuário `phone-frame`. **O estado atual e os próximos passos passaram a viver no `HANDOFF.md` — leia lá primeiro.** Último commit: `0ef2366`.
- **2026-06-21 — Mac (casa) — Criado este CLAUDE.md:** primeira memória compartilhada do Foco. Contexto: o **HUB Pessoal passou a embutir o Foco** (iframe na aba Habit Tracker) — ver seção "Relação com o HUB". Mapeados aqui: estrutura (3 abas foco/habitos/insights), dados (`foco_state` no Supabase `jlouesrrmqeauzlgvrpw`, localStorage prefixo `focoapp_`), schema de hábito/log, e o acoplamento com o HUB. Nada de código mudou nesta sessão do lado do Foco — só documentação.
