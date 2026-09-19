# HANDOFF — projeto "HTML - Foco" (Foco · Equilíbrio)

> **LEIA ISTO PRIMEIRO** ao abrir uma sessão nova. Este arquivo = **onde paramos + próximos passos**.
> Arquitetura, dados e a "regra de ouro" do sync: **CLAUDE.md**. Formato dos dados: **CONTRATO.md**.
> Fluxo: `git pull` no início · editar → `git add -A && commit && push origin main` (Pages publica sozinho).

App no ar: **https://dkonrad88.github.io/Foco/** · Repo: `github.com/dKonrad88/Foco` (`main`).
Última sessão: **2026-09-19 (PC da Empresa)**.

---

## 🎯 ONDE PARAMOS — v2 "Equilíbrio" publicado

**Por que mudou:** o usuário parou de usar o v1 em julho: esquecia de abrir e, quando abria, eram 37 hábitos pra marcar,
análises, metas… "carreguei demais". Pediu algo **EXTREMAMENTE leve**, um **painel de equilíbrio** da vida em pilares,
**ritual à noite ≤5 min**, **tom de dados**, e uma evolução simples tipo **"Fitness do Strava"**.

**O que foi entregue (tudo no ar):**
- App reescrito: 3 abas **Hoje · Equilíbrio · Pilares**; 7 pilares; 12 hábitos ativos de 1 toque (Treino: academia 3×/sem +
  corrida 1×/sem · Sono: dormi bem · Alimentação: comi bem 😀😐😣 + água ok + sem besteira · Conhecimento: li hoje 4× + inglês 2× ·
  Carreira: revisão semanal · Descanso: tempo pra mim 1× · Débora: fui presente 4× + date a cada 15 dias).
  16 hábitos **em espera** (Bíblia, igreja, pets, amigos, bike, podcast…) e 5 que **viraram rotina** (facial ×2, sem rede social,
  suplementos, café).
- **Pontuação de Equilíbrio** (100 = cumprindo o plano; memória ~6 semanas), semáforo por pilar, roda da vida.
- **Lembrete da noite** (padrão 21:30, ajustável na aba Pilares): só chega se o dia ainda estiver aberto; texto cita o pilar mais fraco.
- HUB: painel read-only novo (pontuação + curva, semáforo 6 semanas + hoje, roda da vida).
- Histórico v1 **não aparece** (pedido explícito). Chaves v1 congeladas + backup `backup.foco_state_v1_20260919`.

**Primeiro uso esperado (iPhone):** "Atualizar app" → o app abre no Hoje com a semente; ao logar/sincronizar, sobe `v2_*`
para a nuvem. A pontuação começa em 100 e os números ficam confiáveis depois da 1ª semana. Reativar o push: aba Pilares →
Lembrete da noite → "Ativar notificações neste aparelho" (a assinatura antiga continua valendo; o teste confirma).

## Próximos passos / o que observar
1. **Usuário vai usar de verdade** e dizer se agora dá vontade de abrir. Ajustes finos prováveis: planos (frequências de leitura,
   inglês, presença), hábitos que entram/saem, horário do push.
2. **Decisões tomadas por padrão (confirmar com ele se incomodar):** Sono **pausa** no modo viagem; faixas do semáforo 90/60;
   push 21:30; ícones Tabler no lugar de emoji; "Fechar o dia" explícito (qualquer marcação já conta como dia fechado para o push).
3. **Sugestões de "em espera"** só aparecem após 28 dias de uso e com o pilar estável 4 semanas (1 por vez, cooldown 21 dias).
4. **Revisão mensal** dos hábitos que viraram rotina aparece no Hoje a cada 30 dias.
5. Segurança: VAPID privada e cron-key seguem embutidas no código das Edge Functions (fora do git). Mover para secrets do
   Supabase quando der (`Deno.env.get`).
6. Limpeza opcional futura: apagar chaves v1 / localStorage `focoapp_*` — **só se o usuário pedir** (o backup existe).

## Regras de trabalho (do usuário)
PT-BR · confirmar a mudança antes de aplicar, mas **commit+push é autônomo** · ser crítico/direto · avisar se achar
senha/chave/dado sensível · perfil pessoal (questionário) fica fora do git.
