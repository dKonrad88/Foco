# Contrato de dados — Foco v2 ("Equilíbrio")

> **Para o HUB e para a Edge Function de push.** O app Foco é o **único** que grava; os outros só **leem**.
> Se este formato mudar, atualizar junto: `equilibrio.js` (domínio), o módulo `FOCO` do HUB e a função `foco-cron-push`.
> Versão do contrato: **2** (`v2_ajustes.versao = 2`). Desde 2026-09-19.

## Tabela

`public.foco_state` — padrão key/value da suíte.

| coluna | tipo | |
|---|---|---|
| `user_id` | uuid | FK `auth.users`, parte da PK |
| `key` | text | parte da PK |
| `value` | jsonb | o conteúdo |
| `updated_at` | timestamptz | |

PK `(user_id, key)` · RLS `own_rows` (`auth.uid() = user_id`) · upsert com `onConflict:'user_id,key'`.

## Chaves

| key | conteúdo | escrito por |
|---|---|---|
| `v2_plano` | pilares + hábitos | app |
| `v2_registros` | marcações por dia | app |
| `v2_ajustes` | início, lembrete, viagens, revisão, sugestões | app |
| `v2_resumo` | pontuação já calculada (só para o texto do push) | app (derivado) |
| `habits`, `logs`, `counter`, `metas`, `theme` | **v1, CONGELADAS** — o v2 nunca lê nem escreve. Snapshot em `backup.foco_state_v1_20260919` (service_role). | ninguém |

## Formatos

`_t` = `Date.now()` da última alteração do objeto (ou do dia). `_t: 0` = semente nunca editada (ao subir vira `1`).
Merge entre aparelhos (`EQ.mergeEstado`): plano e ajustes por `_t` do objeto; registros **por dia** (`_t` do dia);
empate fica com a nuvem; `ajustes.inicio` = o menor dos dois.

### `v2_plano`
```json
{
  "_t": 1758400000000,
  "pilares": [
    { "id": "treino", "nome": "Treino", "icon": "barbell", "estado": "ativo", "ordem": 1 }
  ],
  "habitos": [
    { "id": "academia", "pid": "treino", "nome": "Academia", "icon": "barbell",
      "tipo": "check", "pontos": 2, "plano": { "n": 3, "dias": 7 },
      "estado": "ativo", "desde": "2026-09-20", "dica": "", "ordem": 1,
      "viagem": { "modo": "minimo", "porSemana": 1, "grupo": true } }
  ]
}
```
- Pilar `estado`: `ativo` | `espera`. `icon` = nome Tabler sem o `ti-`.
- Hábito `tipo`: `check` (sim/não) | `nota` (3 carinhas: `1` bem, `0.5` mais ou menos, `0` mal).
- `pontos`: `2` essencial | `1` complemento. `plano`: `n` vezes a cada `dias` (7, 14 ou 30).
- `estado`: `ativo` | `espera` (quero, mas não agora) | `rotina` (virou automático; revisão mensal).
- `desde`: dia em que ficou ativo (antes disso os dias contam como "no plano").
- `viagem.modo`: `pausa` (neutro) | `normal` | `ok` (nota 0.5 vale 1) | `minimo` (`porSemana`, `grupo`: qualquer hábito do pilar conta).
- `pid` pode ser `null` só em `espera`/`rotina`.

### `v2_registros`
```json
{ "2026-09-22": { "_t": 1758580000000, "_f": 1, "academia": 1, "comi": 0.5, "agua": 1 } }
```
- Chave = id do hábito; valor `1` (check) ou `1`/`0.5`/`0` (nota). Ausente = não registrado.
- `_f: 1` = dia fechado pelo botão. **Dia fechado** = `_f` ou qualquer chave que não comece com `_`.

### `v2_ajustes`
```json
{ "_t": 1758400000000, "versao": 2, "inicio": "2026-09-20",
  "pushOn": true, "pushHora": "21:30",
  "viagens": [ { "de": "2026-10-02", "ate": "2026-10-06" } ],
  "rotinaRevisao": "2026-09-20",
  "sugestao": { "ultimaEm": null, "dispensadas": {} },
  "faixas": { "verde": 0.9, "amarelo": 0.6 } }
```
- `viagens[].ate: null` = viagem em andamento.

### `v2_resumo` (derivado)
```json
{ "calculadoEm": "2026-09-22T21:05:00.000Z", "data": "2026-09-22", "geral": 78, "delta7": 4,
  "pilares": { "treino": 96, "sono": 72 }, "fraco": { "id": "conhecimento", "nome": "Conhecimento", "valor": 54 },
  "fechadoHoje": true }
```

## Domínio compartilhado — `equilibrio.js`

`https://dkonrad88.github.io/Foco/equilibrio.js` define `window.EQ` (script clássico, ES5, sem DOM).
**Quem lê os dados não reimplementa a regra: carrega este arquivo.** O HUB injeta o script sob demanda.
Principais funções: `EQ.pontuacao(ctx, hoje)` → `{valor, delta7, serie, pilares[{id,nome,icon,valor,cor}], fraco, diasDeUso}`;
`EQ.cumprimentoPilar(ctx, pid, ds)`; `EQ.emViagem(ajustes, ds)`; `EQ.diaFechado(registros, ds)`; `EQ.mergeEstado(local, nuvem)`.
`ctx = {plano, registros, ajustes}`. Testes embutidos: `EQ._selfTest()`.

### A regra da Pontuação de Equilíbrio (resumo)
1. **Cumprimento do hábito** num dia = crédito / esperado numa janela de `plano.dias` dias (esperado por dia = `n/dias`), teto 1,2.
   Dias antes de `desde`/`inicio` e dias de viagem em `pausa` contam como "no plano". Hoje ainda não marcado não derruba.
2. **Pilar** = média dos hábitos ativos ponderada por `pontos`. **Geral** = média de todos os hábitos ativos ponderada por `pontos`.
3. **Pontuação** = média móvel exponencial do geral com memória de ~6 semanas (τ = 42 dias), começando em 100.
4. **Semáforo** = cumprimento do pilar hoje: verde ≥ 90, amarelo ≥ 60, vermelho < 60 (`ajustes.faixas`).

## Como ler (HUB)
```js
const { data } = await sb.from('foco_state').select('key,value')
  .eq('user_id', cloudUser.id).in('key', ['v2_plano', 'v2_registros', 'v2_ajustes']);
const m = {}; data.forEach(r => m[r.key] = r.value);
const p = EQ.pontuacao({ plano: m.v2_plano, registros: m.v2_registros || {}, ajustes: m.v2_ajustes || {} }, EQ.hoje());
```
Sem `v2_plano` = o Foco v2 ainda não foi aberto.

## Push (Edge Function `foco-cron-push`, pg_cron a cada minuto) — fonte em `edge/foco-cron-push/index.ts`
Lê `v2_ajustes` (`pushOn`, `pushHora`), `v2_registros[hoje]` e `v2_resumo`. Envia **uma** notificação por noite no horário,
**só se o dia ainda estiver aberto**: "Dia ainda aberto · <pilar mais fraco> em <valor> esta semana". Sem `v2_ajustes` → nada.
Os lembretes por hábito da v1 (`habits[].remind`) foram aposentados.
