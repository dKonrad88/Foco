// foco-cron-push v2 — lembrete da noite do Foco v2 ("Equilíbrio").
//
// Chamado a cada minuto pelo pg_cron (job foco-push-tick) via pg_net, com o header x-cron-key.
// Para cada usuário com assinatura em foco_push_subs:
//   1. lê v2_ajustes (sem v2_ajustes -> pula; não existem mais lembretes por hábito);
//   2. pushOn = ajustes.pushOn !== false; hora = ajustes.pushHora || '21:30';
//   3. fora de teste: pula se !pushOn ou now !== hora;
//   4. lê v2_registros + v2_resumo; dia de hoje fechado (_f ou alguma chave sem '_') -> pula (exceto teste);
//   5. envia "Dia ainda aberto · <pilar> em <valor> esta semana" (ou o texto padrão).
//
// Parâmetros de debug no corpo JSON (todos opcionais):
//   now   "HH:MM"       hora simulada (fuso America/Sao_Paulo)
//   dow   0..6          dia da semana simulado (só informativo no v2)
//   today "YYYY-MM-DD"  data simulada
//   test  true          ignora pushOn/horário/dia fechado; título "Teste do lembrete da noite"
//   dry   true          calcula e devolve sem enviar nada (nem remover assinaturas)
// Com test ou dry, a resposta traz "detail" com o resultado de cada usuário.
//
// Segredos: lidos dos secrets do Supabase (VAPID_PRIVATE, FOCO_CRON_KEY). Nada embutido no código.

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const VAPID_PUBLIC = 'BH9Zr-JA_68JJPCTuudMPhlFyt2UNM-Lhg6BRFKu_dNCHgejNQpfcvJltoe2SBenTBQhzteKKn5iqp9E-5FEifc'
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE') ?? ''
const VAPID_SUBJECT = 'mailto:konraddiego@gmail.com'
const CRON_KEY = Deno.env.get('FOCO_CRON_KEY') ?? ''
const TZ = 'America/Sao_Paulo'

const HORA_PADRAO = '21:30'
const TITULO = 'Foco'
const TITULO_TESTE = 'Teste do lembrete da noite'
const TAG = 'foco-noite'
const URL_APP = '/Foco/'
const TEXTO_PADRAO = 'Dia ainda aberto · 1 minuto pra fechar'
// Resumo calculado há mais de N dias (app sem abrir) não descreve "esta semana": usa o texto padrão.
const RESUMO_MAX_DIAS = 7
// Validade do push no serviço de entrega (s): um lembrete da noite que chega de madrugada não serve.
const PUSH_TTL = 2 * 60 * 60

type Obj = Record<string, unknown>
// Cliente sem tipos gerados do banco: evita que os genéricos do supabase-js travem .from() num type-check.
// deno-lint-ignore no-explicit-any
type Admin = any
type SubRow = { user_id: string; endpoint: string | null; p256dh: string | null; auth: string | null }
type Env = { now: string; today: string; test: boolean; dry: boolean }
type Acc = { matched: number; sent: number; failed: number; gone: string[] }

function json(obj: unknown, status = 200): Response {
  return new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } })
}

function msg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function isObj(v: unknown): v is Obj {
  return !!v && typeof v === 'object' && !Array.isArray(v)
}

// jsonb normalmente chega como objeto; se alguém gravou uma string JSON, tenta decodificar.
function asObj(v: unknown): Obj | null {
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v)
    } catch {
      return null
    }
  }
  return isObj(v) ? v : null
}

// "9:30", "09:30", "21:30:00" -> "HH:MM"; qualquer outra coisa -> null.
function normHora(v: unknown): string | null {
  if (typeof v !== 'string') return null
  const m = /^\s*(\d{1,2}):(\d{2})(?::\d{2})?\s*$/.exec(v)
  if (!m) return null
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return null
  return String(h).padStart(2, '0') + ':' + m[2]
}

function isData(v: unknown): v is string {
  return typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v + 'T00:00:00Z'))
}

// b - a, em dias inteiros.
function diffDias(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 86400000)
}

// SPEC §2: dia fechado = _f OU existe alguma chave que não começa com '_'.
function diaFechado(dia: unknown): boolean {
  const d = asObj(dia)
  if (!d) return false
  if (d._f) return true
  return Object.keys(d).some((k) => k.charAt(0) !== '_')
}

// SPEC §8.6: com resumo.fraco e valor numérico -> pilar mais fraco; senão texto padrão.
function textoCorpo(resumo: Obj | null, today: string): string {
  if (!resumo) return TEXTO_PADRAO
  if (isData(resumo.data) && diffDias(resumo.data, today) > RESUMO_MAX_DIAS) return TEXTO_PADRAO
  const fraco = asObj(resumo.fraco)
  if (!fraco) return TEXTO_PADRAO
  const valor = typeof fraco.valor === 'number' ? fraco.valor : NaN
  const nome = typeof fraco.nome === 'string' ? fraco.nome.trim().slice(0, 40) : ''
  if (!Number.isFinite(valor) || !nome) return TEXTO_PADRAO
  return 'Dia ainda aberto · ' + nome + ' em ' + Math.round(valor) + ' esta semana'
}

// VAPID só é configurado quando algo vai de fato ser enviado (dry não precisa da chave privada).
let vapidPronto = false
let vapidErro: string | null = null
function prepararVapid(): string | null {
  if (vapidPronto || vapidErro) return vapidErro
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
    vapidPronto = true
  } catch (e) {
    vapidErro = 'vapid: ' + msg(e)
  }
  return vapidErro
}

async function processarUsuario(admin: Admin, uid: string, subs: SubRow[], env: Env, acc: Acc): Promise<Obj> {
  const info: Obj = { user: uid, subs: subs.length }

  // 1-2. Ajustes primeiro (linha pequena); registros/resumo só são lidos se o horário bater.
  const { data: ra, error: ea } = await admin
    .from('foco_state')
    .select('value')
    .eq('user_id', uid)
    .eq('key', 'v2_ajustes')
    .limit(1)
  if (ea) throw new Error('v2_ajustes: ' + ea.message)
  const linhaAjustes = Array.isArray(ra) && ra.length ? (ra[0] as Obj) : null
  const ajustes = asObj(linhaAjustes ? linhaAjustes.value : null)
  if (!ajustes) {
    info.status = 'sem_ajustes'
    return info
  }

  // 3-4. Liga/desliga e horário.
  const pushOn = ajustes.pushOn !== false
  const hora = normHora(ajustes.pushHora) || HORA_PADRAO
  info.pushOn = pushOn
  info.hora = hora
  if (!env.test) {
    if (!pushOn) {
      info.status = 'desligado'
      return info
    }
    if (env.now !== hora) {
      info.status = 'fora_do_horario'
      return info
    }
  }

  // 5. Dia de hoje já fechado?
  const { data: rr, error: er } = await admin
    .from('foco_state')
    .select('key,value')
    .eq('user_id', uid)
    .in('key', ['v2_registros', 'v2_resumo'])
  if (er) throw new Error('v2_registros/v2_resumo: ' + er.message)
  let registros: Obj | null = null
  let resumo: Obj | null = null
  for (const row of (Array.isArray(rr) ? rr : []) as Obj[]) {
    if (!row) continue
    if (row.key === 'v2_registros') registros = asObj(row.value)
    else if (row.key === 'v2_resumo') resumo = asObj(row.value)
  }
  const fechado = diaFechado(registros ? registros[env.today] : null)
  info.fechado = fechado
  if (fechado && !env.test) {
    info.status = 'dia_fechado'
    return info
  }

  // 6. Texto.
  const corpo = textoCorpo(resumo, env.today)
  const titulo = env.test ? TITULO_TESTE : TITULO
  info.title = titulo
  info.body = corpo
  acc.matched++

  if (env.dry) {
    info.status = 'dry'
    return info
  }

  const vErr = prepararVapid()
  if (vErr) {
    acc.failed += subs.length
    info.status = 'erro'
    info.erro = vErr
    return info
  }

  const payload = JSON.stringify({ title: titulo, body: corpo, tag: TAG, url: URL_APP })
  let ok = 0
  let falhou = 0
  for (const s of subs) {
    if (!s.endpoint || !s.p256dh || !s.auth) {
      falhou++
      continue
    }
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        { TTL: PUSH_TTL },
      )
      ok++
    } catch (e) {
      falhou++
      // deno-lint-ignore no-explicit-any
      const code = (e as any)?.statusCode
      if (code === 404 || code === 410) acc.gone.push(s.endpoint)
      else console.error('foco-cron-push: envio falhou', uid, code ?? '', msg(e))
    }
  }
  acc.sent += ok
  acc.failed += falhou
  info.status = 'enviado'
  info.sent = ok
  info.failed = falhou
  return info
}

Deno.serve(async (req: Request) => {
  if (!CRON_KEY || !VAPID_PRIVATE) return json({ error: 'secrets ausentes: VAPID_PRIVATE / FOCO_CRON_KEY' }, 500)
  if (req.headers.get('x-cron-key') !== CRON_KEY) return json({ error: 'forbidden' }, 403)

  let body: Obj = {}
  try {
    const b = await req.json()
    if (isObj(b)) body = b
  } catch {
    // sem corpo ou corpo inválido: segue com os valores reais
  }

  // Hora, dia da semana e data em America/Sao_Paulo.
  const agora = new Date()
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
    hourCycle: 'h23',
  }).formatToParts(agora)
  const gp = (t: string) => parts.find((p) => p.type === t)?.value || ''
  let hh = gp('hour').padStart(2, '0')
  if (hh === '24') hh = '00'
  const mm = gp('minute').padStart(2, '0')
  const wdMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  let dow = wdMap[gp('weekday')] ?? 0
  let today = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(agora)
  let now = hh + ':' + mm

  // Parâmetros de debug (valores inválidos são ignorados).
  const nowParam = normHora(body.now)
  if (nowParam) now = nowParam
  if (body.dow != null && body.dow !== '') {
    const d = Number(body.dow)
    if (Number.isInteger(d) && d >= 0 && d <= 6) dow = d
  }
  if (isData(body.today)) today = body.today
  const test = body.test === true || body.test === 1 || body.test === 'true'
  const dry = body.dry === true || body.dry === 1 || body.dry === 'true'
  const verbose = test || dry
  const env: Env = { now, today, test, dry }

  try {
    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
      auth: { persistSession: false, autoRefreshToken: false },
    })

    const { data: subs, error: se } = await admin.from('foco_push_subs').select('user_id,endpoint,p256dh,auth')
    if (se) return json({ now, dow, today, dry, test, error: se.message }, 500)
    if (!Array.isArray(subs) || !subs.length) {
      return json({ now, dow, today, users: 0, matched: 0, sent: 0, failed: 0, removed: 0, errors: 0, dry, test })
    }

    const byUser: Record<string, SubRow[]> = {}
    for (const s of subs as SubRow[]) {
      if (!s || !s.user_id) continue
      ;(byUser[s.user_id] = byUser[s.user_id] || []).push(s)
    }

    const acc: Acc = { matched: 0, sent: 0, failed: 0, gone: [] }
    const detail: Obj[] = []
    let errors = 0
    const uids = Object.keys(byUser)

    // Um usuário com erro (linha malformada, falha de leitura) não derruba os outros.
    for (const uid of uids) {
      let info: Obj
      try {
        info = await processarUsuario(admin, uid, byUser[uid], env, acc)
      } catch (e) {
        errors++
        info = { user: uid, subs: byUser[uid].length, status: 'erro', erro: msg(e) }
        console.error('foco-cron-push: usuário com erro', uid, msg(e))
      }
      if (verbose) detail.push(info)
    }

    // Assinaturas expiradas (404/410) saem da tabela.
    let removed = 0
    if (acc.gone.length) {
      const uniq = Array.from(new Set(acc.gone))
      const { error: de } = await admin.from('foco_push_subs').delete().in('endpoint', uniq)
      if (de) console.error('foco-cron-push: limpeza de assinaturas falhou', de.message)
      else removed = uniq.length
    }

    const out: Obj = {
      now,
      dow,
      today,
      users: uids.length,
      matched: acc.matched,
      sent: acc.sent,
      failed: acc.failed,
      removed,
      errors,
      dry,
      test,
    }
    if (vapidErro) out.error = vapidErro
    if (verbose) out.detail = detail
    return json(out)
  } catch (e) {
    console.error('foco-cron-push: falha geral', msg(e))
    return json({ now, dow, today, dry, test, error: msg(e) }, 500)
  }
})
