# HANDOFF — projeto "HTML - Foco" (Foco · Hábitos)

> **LEIA ISTO PRIMEIRO** ao abrir uma sessão nova. Este arquivo = **onde paramos + próximos passos**.
> Arquitetura estável, dados e a "regra de ouro" do sync: ver **CLAUDE.md**.
> Fluxo: `git pull` no início · editar → `git add -A && commit && push origin main` (Pages publica sozinho).

App no ar: **https://dkonrad88.github.io/Foco/** · Repo: `github.com/dKonrad88/Foco` (`main`).
Última sessão: **2026-07-27 (Mac)** · `index.html` single-file.

---

## 🎯 FOCO DA VEZ — Vista Semana + agendamento por dia (recém-construído)

**Problema que resolveu (fala do usuário):** hábitos de frequência (ex.: *Estudar inglês*, *Escutar podcast*) não tinham *quando* — só ficavam na lista. Sem dia marcado, ele empurrava com a barriga até a última semana e não fazia. E ele queria **ver a semana toda de antemão**, não descobrir no dia.

**O que é (aditivo, não toca em Metas nem no schema de log):**
- **Agendamento por dia da semana:** campo novo **`h.dias`** = array `0..6` (0=dom … 6=sáb). Editado no modal do hábito (aba Hábitos → editar): 7 bolinhas **D S T Q Q S S** + atalhos **Dias úteis / Todo dia / Limpar**. Persistido junto de habits no `foco_state` (é só mais um campo do objeto hábito). Vazio = comportamento antigo.
- **Sub-aba Semana** (dentro de **Foco**, toggle **Hoje ⇄ Semana** no topo — `focoView`): mostra a **semana inteira** (seg→dom), cada dia com os hábitos agendados naquele dia; **hoje** destacado; feito = ✓ teal, dia passado não-feito = vermelho tracejado ("perdido"). Topo: navegação **‹ 27 jul – 2 ago ›** (`focoWeekOff`, navega passado/futuro), resumo **"N compromissos · X/Y"**, faixa **"Todo dia"** com os ícones dos diários, e no rodapé o grupo **"N sem dia fixo"** (frequência ainda não distribuída, com botão **agendar** que abre o editor). **Marcar direto da Semana:** tocar no círculo de um hábito **bool** marca/desmarca ele feito naquele dia sem sair (`wkToggle`, só dias ≤ hoje, `stopPropagation`); hábito **número/item** (precisa de valor, ex.: Água em ml, Corrida em km) o toque leva pro **Hoje** daquele dia pra registrar (`goDia`).

**Onde no código (tudo com prefixo `wk`/`foco`):** `renderWeekView` (⚠️ **renomeada** de `renderSemana` pra não colidir com a `renderSemana` da aba Hábitos, que é outra coisa — o heatmap), `focoViewToggle`, `setFocoView`, `shiftWeek`/`thisWeek`, `goDia`, `weekDates`, `wkClassify` (separa agendados / "todo dia" / "sem dia fixo"), `wkSort`, `alvoCurto`. No editor: `tmpDias`, `renderDiasPick`, `toggleDia`, `setDiasQuick`. Regra retrocompatível em **`expectedToday`**: `if(hasDias(h))` o hábito só é esperado no **Hoje** nos seus dias (via `curWeekday()`); sem dias, lógica antiga intacta.

**Testado (navegador, seed sintético):** toggle, render da semana, agendar+salvar+persistir, hábito cai nos dias certos, feito/perdido na semana passada, navegação de semana, `goDia`, retrocompat do Hoje, e a "Semana" da aba Hábitos segue OK. 0 erro de console.

**Em aberto / próximos passos:**
1. **Usuário vai usar de verdade:** abrir a Semana e **agendar** os hábitos que procrastina (inglês, podcast, treino, igreja…). Na primeira vez o grupo **"sem dia fixo"** vem cheio (nada tem dia ainda) — é a caixa de entrada a organizar; esvazia conforme agenda.
2. ⚠️ **Acoplamento HUB:** o HUB **porta `expectedToday` verbatim** e **não conhece `h.dias`**. Enquanto nenhum hábito tiver dias, o dashboard do HUB fica idêntico. Depois que houver agendamento, o "hoje" do HUB pode mostrar um hábito a mais (ele ignora os dias). **Não quebra** (campo extra é ignorado) — mas pra alinhar, replicar `hasDias`+regra no `FOCO` do hubpessoal. **Sinalizado, não replicado.**
3. Ideias (não pedidas): agrupar "sem dia fixo" por categoria se ficar longo; espelhar a Semana no HUB.
4. **Push (iPhone) — FUNCIONANDO: piloto confirmado pelo usuário + lembretes por horário.** (Supabase `jlouesrrmqeauzlgvrpw`, mesmo do HUB — tudo aditivo, prefixo `foco_`.)
   - **Piloto confirmado** pelo usuário: a notificação chega no iPhone dele (app instalado + login).
   - **Lembrete por hábito:** campo **`h.remind`** = array de `"HH:MM"` (editor do hábito, abaixo dos dias; `tmpRemind`/`renderRemind`/`addRemind`/`rmRemind`). O agendador respeita **`h.dias`** (só nos dias marcados; vazio = todo dia) e **pula bool já feito hoje**.
   - **Backend:** tabela **`foco_push_subs`** (subs; RLS `own_push_subs`). Duas Edge Functions (`npm:web-push`): **`foco-send-push`** (`verify_jwt=true`, sob demanda pelo botão "Enviar teste", usa JWT do user) e **`foco-cron-push`** (`verify_jwt=false`, protegida por header **`x-cron-key`**; service_role; calcula hora **America/Sao_Paulo**; envia os hábitos cujo `remind` bate o `HH:MM`+dia atuais; aceita `{now,dow,today,test}` p/ debug). **`pg_cron`** job **`foco-push-tick`** (jobid 3) roda **a cada minuto** → `pg_net` chama `foco-cron-push` (200 confirmado). Pausar: `select cron.unschedule('foco-push-tick');`.
   - **Segredos (fora do git — só embutidos nas Edge Functions no Supabase):** VAPID **privada** + **`x-cron-key`** (`013c8365-…`). VAPID **pública** no `index.html` (`VAPID_PUBLIC`). Idealmente mover pra secrets do Supabase depois.
   - **No app:** Ajustes → "Ativar notificações" (`pushEnable`: exige standalone+login) e "Enviar teste" (`pushTest`). `sw.js` (cache **`foco-v2`**) mostra/abre a notificação.
   - **Limitações / próximo:** fuso fixo BR (1 user só); dedup simples (cron 1×/min, `HH:MM` exato — se atrasar, pode duplicar); **marcar da notificação** ainda não (bool via botão de ação é o próximo; número abre o app — digitar ml na notificação não dá pelo padrão web). Custo: função roda ~1440×/dia (ok no free tier).

---

## Também em aberto — Metas anuais (aba Metas, da sessão de 06/jul)

Feature construída e no ar; faltava o **usuário validar os números**. Nesta sessão a análise começou (achei defaults estranhos, ex.: **Água → meta ~912.500 ml/ano** = 2500×365, matematicamente certo mas ilegível; e a contagem **dias vs coisas** — *Ler livros* conta dias registrados, não livros) mas o usuário **pivotou** pra resolver a procrastinação (a Semana). Retomar quando ele quiser:
- Gerar/apagar/ajustar metas e conferir se os 3 níveis (Compromisso/Meta/Superação) fazem sentido; janela do ano começa no 1º mês com ≥7 dias (`anoStartMonth`).
- **"Dias" vs "coisas"** segue sinalizado, não resolvido.
Detalhes técnicos das Metas: `renderMetas`, `metaState`, `anoAgg`, `criarTodasMetas`, `anualAlvo`, `subirMeta`; chave `metas` no `foco_state`.

## Regras de trabalho (do usuário)
PT-BR · confirmar a mudança antes de aplicar, mas **commit+push é autônomo** · ser crítico/direto · avisar se achar senha/chave/dado sensível.
