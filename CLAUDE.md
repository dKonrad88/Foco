# Foco · Hábitos — memória compartilhada entre máquinas (Claude Code)

> As sessões do Claude Code do **Mac (casa)** e do **PC da Empresa** NÃO compartilham histórico de chat.
> A única coisa compartilhada é **este repositório git**. Por isso este arquivo é a memória comum.
> **No início de cada sessão:** dê `git pull` e leia este arquivo. **No fim:** atualize o "Log de handoff" e dê `git add -A && git commit && git push`.

## Projeto
- App pessoal **single-file**: `index.html` (HTML/CSS/JS, ~1779 linhas, estilo PWA de celular, offline-first).
- Publicado no **GitHub Pages**: https://dkonrad88.github.io/Foco/
- Repo: `github.com/dKonrad88/Foco` — branch **`main`**.
- É um **rastreador de hábitos**. 3 abas: **Foco** (`setTab('foco')` — tela do dia, registro rápido), **Hábitos** (`habitos` — cadastro/edição) e **Insights** (`insights` — dashboards/heatmap).

## Onde vivem os dados (NÃO PERDER)
- **Código/layout** → `index.html` (versionado no git). Mudanças vão pelo git.
- **Dados do usuário** (hábitos, logs) → **Supabase** + **localStorage** (offline-first). **NÃO** ficam no git.
- localStorage: prefixo **`focoapp_`** (ex.: `focoapp_habits`, `focoapp_logs`, `focoapp_counter`, `focoapp_dirty`, `focoapp_lastSync`). A flag `dirty='1'` marca mudanças locais não sincronizadas.
- ⚠️ **Regra de ouro:** offline-first com last-write-wins por chave. No login, se há `dirty` local, o app **pergunta** (enviar local vs baixar nuvem). Cuidado pra não subir estado vazio por cima de dados bons.

## Supabase (compartilhado com o HUB Pessoal)
- **Mesmo projeto** do HUB: `jlouesrrmqeauzlgvrpw` · URL `https://jlouesrrmqeauzlgvrpw.supabase.co`.
- Chave anon (publishable, pode ficar no HTML público): `sb_publishable_ulG1woVG1p1Seax63GGYPQ_PG6-8l-G`.
- Tabela própria: **`foco_state`** — linhas `(user_id, key, value, updated_at)`, `upsert` com `onConflict:'user_id,key'`. Chaves: `habits`, `logs`, `counter`, `theme`.
- O HUB grava em `hub_state` (tabela diferente) — **não se atropelam**. Auth (e-mail/senha) é a mesma conta nos dois.

## Modelo de dados (schema dos hábitos — diferente do HUB de propósito)
- **Hábito** (`habits[]`): `id, nome, icon, cor, cat, tipo, periodo, alvo, unidade, rotulo, tom, tomCustom, atalhos, items, substr, desde`.
- **Log** (`logs[]`): `t` (data/timestamp), `feito`, `valor`, `hora`, `items`, `recaida`, `s`.
- `counter` = contador incremental de IDs. `theme` = tema atual.
- Funções-base: `migrate()` (sobe versões antigas), `normalizeGrouped()` (normaliza), `recount()` (recalcula), `save()`/`load()`, `applyTheme()`/`curTheme()`, `enter()` (entra no dia).

## Relação com o HUB Pessoal (acoplamento intencional)
- O **HUB embute o Foco**: a aba "Habit Tracker" do HUB é um `<iframe id="focoFrame" src="https://dkonrad88.github.io/Foco/">`. Como é **mesmo origin** (`dkonrad88.github.io`), o iframe herda login/sessão automaticamente.
- **O Foco é a fonte única de hábitos.** O tracker antigo do HUB (`ht*`) foi aposentado.
- ⚠️ **Por isso:** não quebrar a URL pública nem exigir login separado. Mudanças que afetem como o Foco renderiza dentro de um iframe (altura, viewport mobile) podem impactar o HUB. O HUB **não** lê `foco_state` diretamente — só embute a tela.

## Fluxo entre as duas máquinas
- Usuário diz **"tô no PC da Empresa"** ou **"tô no Mac"**. **Mac (casa)** = máquina canônica.
- **Ao começar:** `git pull` + ler este CLAUDE.md. **Ao terminar:** atualizar o "Log de handoff", `git add -A && git commit && git push`.
- Edição pelo app Claude Code (aba Code), nunca pelo Codespace. ⚠️ No Windows, salvar `index.html` sempre em **UTF-8** (evita mojibake).

## Log de handoff (a sessão mais recente escreve no topo)
- **2026-06-21 — Mac (casa) — Criado este CLAUDE.md:** primeira memória compartilhada do Foco. Contexto: o **HUB Pessoal passou a embutir o Foco** (iframe na aba Habit Tracker) — ver seção "Relação com o HUB". Mapeados aqui: estrutura (3 abas foco/habitos/insights), dados (`foco_state` no Supabase `jlouesrrmqeauzlgvrpw`, localStorage prefixo `focoapp_`), schema de hábito/log, e o acoplamento com o HUB. Nada de código mudou nesta sessão do lado do Foco — só documentação.
