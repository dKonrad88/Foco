# HANDOFF — projeto "HTML - Foco" (Foco · Equilíbrio)

> **LEIA ISTO PRIMEIRO** ao abrir uma sessão nova. Este arquivo = **onde paramos + próximos passos**.
> Arquitetura, dados e a "regra de ouro" do sync: **CLAUDE.md**. Formato dos dados: **CONTRATO.md**.
> Fluxo: `git pull` no início · editar → `git add -A && commit && push origin main` (Pages publica sozinho).

App no ar: **https://dkonrad88.github.io/Foco/** · Repo: `github.com/dKonrad88/Foco` (`main`).
Última sessão: **2026-09-20 (Mac)** — correção: dia fechado agora trava a edição (ver "Correções" abaixo). Reestruturação v2: **2026-09-19 (PC da Empresa)**.

## 🔧 Correções pós-v2
- **2026-09-20 (Mac) — dia fechado passou a travar a edição:** o usuário notou que, mesmo após "Fechar o dia" (`_f`), ainda dava pra marcar/desmarcar. Agora `toggleCheck`/`setNota` abortam com toast quando `diaTravado(diaVer)` (helper: `_f` no registro do dia); as linhas do dia fechado ficam esmaecidas (`.row.trv`); o rótulo "Dia fechado" virou o **botão `data-a="reabrir"`** (ação `reabrir` → `reabrirDia`: remove `_f` + `subirJa`). Só o fechamento **explícito** (`_f`) trava — marcar hábitos normalmente NÃO trava (senão a 1ª marca travaria as próximas). Não mudou o formato dos dados (usa o `_f` que já existia) → HUB/CONTRATO/cron intactos. Testado no navegador (self-test 98/98, fluxo fechar→travar→reabrir→marcar). Cache `sw.js` → **`foco-v4`**.

---

## 🎯 ONDE PARAMOS — v2 "Equilíbrio" publicado

**Por que mudou:** o usuário parou de usar o v1 em julho: esquecia de abrir e, quando abria, eram 37 hábitos pra marcar,
análises, metas… "carreguei demais". Pediu algo **EXTREMAMENTE leve**, um **painel de equilíbrio** da vida em pilares,
**ritual à noite ≤5 min**, **tom de dados**, e uma evolução simples tipo **"Fitness do Strava"**.

**O que foi entregue (app e HUB no ar; push v2 com deploy pendente, ver abaixo):**
- App reescrito: 3 abas **Hoje · Equilíbrio · Pilares**; 7 pilares; 12 hábitos ativos de 1 toque (Treino: academia 3×/sem +
  corrida 1×/sem · Sono: dormi bem · Alimentação: comi bem 😀😐😣 + água ok + sem besteira · Conhecimento: li hoje 4× + inglês 2× ·
  Carreira: revisão semanal · Descanso: tempo pra mim 1× · Débora: fui presente 4× + date a cada 15 dias).
  16 hábitos **em espera** (Bíblia, igreja, pets, amigos, bike, podcast…) e 5 que **viraram rotina** (facial ×2, sem rede social,
  suplementos, café).
- **Pontuação de Equilíbrio** (100 = cumprindo o plano; memória ~6 semanas), semáforo por pilar, roda da vida.
- **Lembrete da noite** (padrão 21:30, ajustável na aba Pilares; **depende do deploy pendente abaixo**): só chega se o dia ainda estiver aberto; texto cita o pilar mais fraco.
- HUB: painel read-only novo (pontuação + curva, semáforo 6 semanas + hoje, roda da vida).
- Histórico v1 **não aparece** (pedido explícito). Chaves v1 congeladas + backup `backup.foco_state_v1_20260919`.

**Primeiro uso esperado (iPhone):** "Atualizar app" → o app abre no Hoje com a semente; ao logar/sincronizar, sobe `v2_*`
para a nuvem. A pontuação começa em 100 e os números ficam confiáveis depois da 1ª semana. Reativar o push: aba Pilares →
Lembrete da noite → "Ativar notificações neste aparelho" (a assinatura antiga continua valendo; o teste confirma).

## ⚠️ PENDENTE — deploy da Edge Function `foco-cron-push` v2
O deploy foi **bloqueado pelo sistema de permissões** (o código levava a VAPID privada e a cron-key embutidas).
Enquanto isso, **a versão v1 continua rodando**: lê as chaves v1 congeladas (`habits[].remind`) e segue mandando os
lembretes antigos (Água 09:20 e 11:21); o **lembrete da noite v2 ainda não existe**.
Caminho seguro (recomendado): no painel do Supabase → Edge Functions → **Secrets**, criar `VAPID_PRIVATE` (a mesma da
função atual) e `FOCO_CRON_KEY` (a mesma que o job `foco-push-tick` manda no header `x-cron-key`); depois fazer o deploy
da versão que lê de `Deno.env` — **fonte versionada em [`edge/foco-cron-push/index.ts`](edge/foco-cron-push/index.ts)**
(sem nenhum segredo; `verify_jwt=false`, auth pelo header). Testar com `{"dry":true,"now":"21:30"}` via `net.http_post`
antes de confiar.

## Próximos passos / o que observar
1. **Usuário vai usar de verdade** e dizer se agora dá vontade de abrir. Ajustes finos prováveis: planos (frequências de leitura,
   inglês, presença), hábitos que entram/saem, horário do push.
2. **Decisões tomadas por padrão (confirmar com ele se incomodar):** Sono **pausa** no modo viagem; faixas do semáforo 90/60;
   push 21:30; ícones Tabler no lugar de emoji; "Fechar o dia" explícito (qualquer marcação já conta como dia fechado para o push).
3. **Sugestões de "em espera"** só aparecem após 28 dias de uso e com o pilar estável 4 semanas (1 por vez, cooldown 21 dias).
4. **Revisão mensal** dos hábitos que viraram rotina aparece no Hoje a cada 30 dias.
5. Segurança: a v1 do `foco-cron-push` e o `foco-send-push` têm VAPID privada e cron-key embutidas (fora do git). A v2
   já lê de `Deno.env`; migrar o `foco-send-push` também quando os secrets existirem.
6. Limpeza opcional futura: apagar chaves v1 / localStorage `focoapp_*` — **só se o usuário pedir** (o backup existe).

## Regras de trabalho (do usuário)
PT-BR · confirmar a mudança antes de aplicar, mas **commit+push é autônomo** · ser crítico/direto · avisar se achar
senha/chave/dado sensível · perfil pessoal (questionário) fica fora do git.
