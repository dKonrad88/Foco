# HANDOFF — projeto "HTML - Foco" (Foco · Hábitos)

> **LEIA ISTO PRIMEIRO** ao abrir uma sessão nova. Este arquivo = **onde paramos + próximos passos**.
> Arquitetura estável, dados e a "regra de ouro" do sync: ver **CLAUDE.md**.
> Fluxo: `git pull` no início · editar → `git add -A && commit && push origin main` (Pages publica sozinho).

App no ar: **https://dkonrad88.github.io/Foco/** · Repo: `github.com/dKonrad88/Foco` (`main`).
Última sessão: **2026-07-06 (Mac)** · Último commit: **`0ef2366`** · `index.html` ~1945 linhas (single-file).

---

## 🎯 FOCO DA VEZ — Metas anuais (recém-construído, aba **Metas**)

Feature nova e **aditiva** (não toca em hábitos/logs). Estado: **construída e no ar**; o usuário ia **gerar as metas e depois ajustar**.

**O que é:** metas do ano que **puxam de um hábito** e são batidas mês a mês, em 3 níveis **Compromisso / Meta / Superação**.

**Como funciona no código (tudo com prefixo `mt-`/`meta`):**
- **Dado:** `metas[]` = `{ id:'m'+n, hid:<habitId>, comp, meta, sup }`. Persistido em `foco_state` chave **`metas`** (+ localStorage `focoapp_metas`). Entra no `save`/`load`/`cloudPull`/`cloudPushAll` junto com habits/logs/counter/theme.
- **Agregação:** `anoAgg(h,ano)` → soma `valor` (numero/qty) ou conta dias-feitos (item/bool) por mês do ano.
- **Janela a partir do início real:** `anoStartMonth()` = 1º mês com **≥7 dias** de registro. Nos dados atuais dá **junho** (maio só tem 2 dias → ignorado). Tudo (Meta default, projeção, banco, ritmo, grid) usa a janela **início→dez** (`mj = 13 - startMonth` meses). O grid apaga jan–mai (mostra "–"); `feitos` exclui os meses fora da janela. **Automático:** em 2027 (registrando desde jan) volta a considerar 12 meses.
- **Defaults ao criar:** Meta = `ceil(anualAlvo(h) × mj/12)`; Compromisso = `ceil(meta×0.75)`; Superação = `ceil(meta×1.25)`. **Sempre arredonda pra cima.** `anualAlvo` anualiza o alvo do hábito pelo período (mês×12, trim×4, ano×1…). Recalcula ao trocar o hábito no seletor.
- **Gerar em massa:** `criarTodasMetas()` — 1 meta por hábito não-evitar com alvo>0 que ainda não tem meta (idempotente). Botão no empty state e no rodapé.
- **UX:** resumo do ano (placar) → lista compacta **agrupada por categoria** (recolhível, `metaCollapsed`) → toca a meta pra abrir (`metaOpen`) o detalhe: barra dos 3 níveis com linha "ritmo", banco, projeção, grid de 12 meses, e "**subir a régua**" (`subirMeta`: Meta←Superação, Superação ← ×1.25). Modal `ovMeta` cria/edita; `excluirMeta` remove só a meta (hábito e registros ficam).
- Protótipo de referência (validou o design): https://claude.ai/code/artifact/14ca086a-7105-45f3-9b71-7c18991f4f40

**Em aberto / próximos passos:**
1. **Usuário vai gerar as metas** (aba Metas → "⚡ Gerar metas dos meus hábitos"), depois **apagar** as que não são metas anuais de verdade (ex.: Cuidados faciais, Almoço com amigo) e **ajustar** os 3 níveis. Pode voltar dizendo se os números fazem sentido.
2. ⚠️ **Contagem "dias" vs "coisas":** pra hábitos de item/bool (ex.: *Ler livros*), a meta conta **dias registrados**, não livros terminados. Se ele quiser contar **livros**, o certo é um hábito **tipo número** (+1 por livro). **Sinalizado, não resolvido.**
3. Ideias futuras (não pedidas ainda): filtrar/ordenar metas por atenção, ver ano passado, e talvez **espelhar as metas no dashboard do HUB** (hoje o HUB não lê a chave `metas`).

---

## O que esta sessão (grande) entregou — resumo
- **App virou só-Lista:** removido o "modo card"/stepper do Foco; a aba **Foco** mostra a **Lista** (linhas com `+`, swipe revela Editar/Zerar, agrupada por categoria, faixa "Tudo feito"). Abre no filtro **"Hoje"** por padrão.
- **PWA instalável:** `manifest.json`, `sw.js` (network-first, nunca cacheia Supabase), ícones (`apple-touch-icon`/`icon-192`/`icon-512` + `icon.svg` fonte — chama 🔥). No **celular/instalado** = tela cheia; no **desktop** = mockup de celular. Botão **"Atualizar app"** em Ajustes (recarrega, já que no standalone não tem barra do Safari).
- **Identidade única da suíte:** fonte **Inter**, acento **azul `#185FA5` + teal `#1a7a8a`**, **removido tema Copa + bandeira do Brasil**, **dark por padrão** (ciclo dark⇄light), cards radius **14px**.
- **Insights:** sub-menu (Resumo/Análise/Coach/Listas) distribuído igual; aba Análise limitada a **5 cards**.
- **Removido tom "Personalizado"** (era inerte sem o card).
- Skill de usuário **`phone-frame`** criada (`~/.claude/skills/phone-frame`) — aplica o mockup de celular no desktop em qualquer app single-file da suíte.
- **Som:** o Foco **já tem** `sfx()` (Web Audio, toggle Ajustes→Som). "Não toca" no iPhone = **interruptor de silencioso**, não é bug.

## Regras de trabalho (do usuário)
PT-BR · confirmar a mudança antes de aplicar, mas **commit+push é autônomo** · ser crítico/direto · avisar se achar senha/chave/dado sensível.
