/* equilibrio.js — domínio do Foco v2 ("Equilíbrio").
   Módulo puro (sem DOM, sem rede), ES5, script clássico.
   Define window.EQ (e module.exports quando existir). Usado pelo app e pelo HUB.
   Fonte da verdade: SPEC Foco v2, seções 2 a 4. */
(function (root) {
  'use strict';

  var EQ = {};
  EQ.VERSION = 1;
  EQ.CAP = 1.2;
  EQ.TAU = 42;
  EQ.KEYS = { plano: 'v2_plano', registros: 'v2_registros', ajustes: 'v2_ajustes', resumo: 'v2_resumo' };

  var DIA_MS = 86400000;
  var EPS = 1e-9;                       // folga de ponto flutuante nas comparações de faixa
  var FAIXAS = { verde: 0.9, amarelo: 0.6 };
  var hasOwn = Object.prototype.hasOwnProperty;

  function p2(n) { return (n < 10 ? '0' : '') + n; }

  /* ================= Datas ================= */
  // Internamente as datas viram "número do dia" em UTC: sem horário de verão, mesmo
  // resultado de new Date(ds+'T12:00:00') no fuso local, e bem mais rápido nos laços.
  function dnum(ds) {
    var s = String(ds);
    return Math.round(Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DIA_MS);
  }
  function dstr(n) {
    var t = new Date(n * DIA_MS);
    return t.getUTCFullYear() + '-' + p2(t.getUTCMonth() + 1) + '-' + p2(t.getUTCDate());
  }

  EQ.iso = function (date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate());
  };
  EQ.hoje = function () { return EQ.iso(new Date()); };
  EQ.addDias = function (ds, n) { return dstr(dnum(ds) + Math.round(+n || 0)); };
  EQ.diffDias = function (a, b) { return dnum(b) - dnum(a); };
  EQ.inicioSemana = function (ds) {
    var n = dnum(ds);
    var dow = new Date(n * DIA_MS).getUTCDay();   // 0 = domingo
    return dstr(n - ((dow + 6) % 7));             // volta até a segunda-feira
  };

  /* ================= Plano ================= */
  function ordemDe(x) { var o = x ? +x.ordem : NaN; return isNaN(o) ? 9999 : o; }

  EQ.pilares = function (plano, estado) {
    var lista = (plano && plano.pilares) || [], tmp = [], i;
    for (i = 0; i < lista.length; i++) {
      if (!lista[i]) continue;
      if (estado && lista[i].estado !== estado) continue;
      tmp.push({ p: lista[i], i: i });
    }
    tmp.sort(function (a, b) { return (ordemDe(a.p) - ordemDe(b.p)) || (a.i - b.i); });
    return tmp.map(function (x) { return x.p; });
  };

  EQ.habitos = function (plano, filtro) {
    var hs = (plano && plano.habitos) || [], pil = (plano && plano.pilares) || [];
    var f = filtro || {}, ordP = {}, tmp = [], i;
    var usaPid = f.pid !== undefined;
    var pidF = f.pid == null ? null : f.pid;
    for (i = 0; i < pil.length; i++) if (pil[i]) ordP['k' + pil[i].id] = ordemDe(pil[i]);
    for (i = 0; i < hs.length; i++) {
      var h = hs[i];
      if (!h) continue;
      if (f.estado && h.estado !== f.estado) continue;
      if (usaPid && (h.pid == null ? null : h.pid) !== pidF) continue;
      var op = (h.pid != null && hasOwn.call(ordP, 'k' + h.pid)) ? ordP['k' + h.pid] : 9999;
      tmp.push({ h: h, op: op, i: i });
    }
    tmp.sort(function (a, b) { return (a.op - b.op) || (ordemDe(a.h) - ordemDe(b.h)) || (a.i - b.i); });
    return tmp.map(function (x) { return x.h; });
  };

  // Estado ativo E pilar ativo.
  EQ.habitosAtivos = function (plano) {
    var pil = (plano && plano.pilares) || [], ativos = {}, i;
    for (i = 0; i < pil.length; i++) if (pil[i] && pil[i].estado === 'ativo') ativos['k' + pil[i].id] = true;
    return EQ.habitos(plano, { estado: 'ativo' }).filter(function (h) {
      return h.pid != null && ativos['k' + h.pid] === true;
    });
  };

  EQ.taxa = function (h) {
    var pl = (h && h.plano) || {}, n = +pl.n, d = +pl.dias;
    if (!(d > 0) || !(n > 0)) return 0;
    return n / d;
  };

  // Tamanho da janela (dias) do hábito.
  function janela(h) {
    var d = Math.round(+((h && h.plano && h.plano.dias) || 0));
    return d >= 1 ? d : 7;
  }

  EQ.textoPlano = function (h) {
    var pl = (h && h.plano) || {}, n = +pl.n || 0, d = +pl.dias || 7;
    if (d === 7 && n >= 7) return 'todo dia';
    if (d === 7) return n + '× na semana';
    if (d === 14) return n + '× a cada 15 dias';
    if (d === 30) return n + '× no mês';
    return n + '× em ' + d + ' dias';
  };

  // Modo de viagem do hábito (ausente = pausa).
  function viagemDe(h) {
    var v = h && h.viagem;
    return (v && v.modo) ? v : { modo: 'pausa' };
  }
  EQ.modoViagem = function (h) { return viagemDe(h).modo; };

  /* ================= Registros ================= */
  EQ.registrado = function (h, dia) {
    return !!(dia && h && hasOwn.call(dia, h.id) && dia[h.id] != null);
  };

  EQ.valor = function (h, dia) {
    if (!EQ.registrado(h, dia)) return 0;
    if (h.tipo === 'nota') {
      var v = +dia[h.id];
      if (isNaN(v) || v < 0) return 0;
      return v > 1 ? 1 : v;
    }
    return 1;
  };

  // Fechado = _f OU alguma chave que não começa com "_".
  EQ.diaFechado = function (registros, ds) {
    var dia = registros && registros[ds], k;
    if (!dia) return false;
    if (dia._f) return true;
    for (k in dia) if (hasOwn.call(dia, k) && k.charAt(0) !== '_') return true;
    return false;
  };

  EQ.emViagem = function (ajustes, ds) {
    var vs = (ajustes && ajustes.viagens) || [], i, v;
    for (i = 0; i < vs.length; i++) {
      v = vs[i];
      if (v && v.de && v.de <= ds && (!v.ate || ds <= v.ate)) return true;
    }
    return false;
  };

  EQ.inicioHabito = function (h, ajustes) {
    var a = (ajustes && ajustes.inicio) || '', d = (h && h.desde) || '';
    return d > a ? d : a;
  };

  /* ================= Cálculo ================= */
  // Contexto preparado uma vez por chamada pública (hábitos ativos, grupos de viagem, cache de viagem).
  function prep(ctx) {
    ctx = ctx || {};
    var plano = ctx.plano || { pilares: [], habitos: [] };
    var P = { plano: plano, reg: ctx.registros || {}, aj: ctx.ajustes || {},
              ativos: EQ.habitosAtivos(plano), grupos: {}, vc: {}, c: 0, e: 0 };
    for (var i = 0; i < P.ativos.length; i++) {
      var h = P.ativos[i];
      if (viagemDe(h).modo === 'minimo') (P.grupos['k' + h.pid] || (P.grupos['k' + h.pid] = [])).push(h);
    }
    return P;
  }

  function viagemP(P, ds) {
    var v = P.vc[ds];
    if (v === undefined) v = P.vc[ds] = EQ.emViagem(P.aj, ds);
    return v;
  }

  // Crédito e esperado de h no dia ds; resultado em P.c e P.e.
  function ce(P, h, ds) {
    var tx = EQ.taxa(h);
    if (ds < EQ.inicioHabito(h, P.aj)) { P.c = tx; P.e = tx; return; }   // dia virtual: neutro
    var dia = P.reg[ds];
    if (viagemP(P, ds)) {
      var vg = viagemDe(h);
      if (vg.modo === 'pausa') { P.c = tx; P.e = tx; return; }
      if (vg.modo === 'minimo') {
        var ps = vg.porSemana == null ? 1 : +vg.porSemana;
        if (!(ps >= 0)) ps = 1;
        var c = EQ.valor(h, dia);
        if (vg.grupo) {                                     // vale o melhor do grupo do pilar
          var g = P.grupos['k' + h.pid] || [];
          for (var i = 0; i < g.length; i++) { var vg2 = EQ.valor(g[i], dia); if (vg2 > c) c = vg2; }
        }
        P.c = c; P.e = ps / 7; return;
      }
      if (vg.modo === 'ok') { var vo = EQ.valor(h, dia); P.c = vo >= 0.5 ? 1 : vo; P.e = tx; return; }
      // 'normal' (ou desconhecido): segue como dia normal
    }
    P.c = EQ.valor(h, dia); P.e = tx;
  }

  function razao(sc, se) {
    if (!(se > 0)) return sc > 0 ? EQ.CAP : 1;   // nada esperado na janela: neutro
    var r = sc / se;
    return r > EQ.CAP ? EQ.CAP : r;
  }

  // Cumprimento da janela de W dias que termina no dia fim (número do dia).
  function jan(P, h, fim) {
    var W = janela(h), sc = 0, se = 0;
    for (var n = fim - W + 1; n <= fim; n++) { ce(P, h, dstr(n)); sc += P.c; se += P.e; }
    return razao(sc, se);
  }

  // Regra do hoje parcial: sem crédito hoje, a janela termina ontem (SPEC §4); com crédito,
  // vale o maior entre a janela com hoje e a que termina ontem, para marcar só melhorar
  // (nota 0.5 hoje não pode ficar abaixo de não marcar ou de marcar 0).
  function cumpH(P, h, ds, parcial) {
    var fim = dnum(ds);
    if (!parcial) return jan(P, h, fim);
    var r0 = jan(P, h, fim - 1);
    ce(P, h, ds);
    if (P.c <= 0) return r0;
    var r = jan(P, h, fim);
    return r > r0 ? r : r0;
  }

  function peso(h) { var p = +h.pontos; return p > 0 ? p : 1; }

  function media(P, hs, ds, parcial) {
    var num = 0, den = 0;
    for (var i = 0; i < hs.length; i++) { var w = peso(hs[i]); num += w * cumpH(P, hs[i], ds, parcial); den += w; }
    return den > 0 ? num / den : null;
  }

  function doPilar(P, pid) { return P.ativos.filter(function (h) { return h.pid === pid; }); }

  function pausadoP(P, pid, ds) {
    if (!viagemP(P, ds)) return false;
    var hs = doPilar(P, pid);
    if (!hs.length) return false;
    for (var i = 0; i < hs.length; i++) if (viagemDe(hs[i]).modo !== 'pausa') return false;
    return true;
  }

  EQ.cumprimentoHabito = function (ctx, h, ds, opts) {
    return cumpH(prep(ctx), h, ds, !!(opts && opts.parcial));
  };
  EQ.cumprimentoPilar = function (ctx, pid, ds, opts) {
    var P = prep(ctx);
    return media(P, doPilar(P, pid), ds, !!(opts && opts.parcial));
  };
  EQ.pilarPausado = function (ctx, pid, ds) { return pausadoP(prep(ctx), pid, ds); };
  EQ.cumprimentoGeral = function (ctx, ds, opts) {
    var P = prep(ctx);
    return media(P, P.ativos, ds, !!(opts && opts.parcial));
  };

  /* ================= Pontuação (EWMA) ================= */
  function janArr(c, e, fim, W) {           // mesma soma de jan(), sobre os vetores pré-calculados
    var sc = 0, se = 0;
    for (var q = fim - W + 1; q <= fim; q++) { sc += c[q]; se += e[q]; }
    return razao(sc, se);
  }

  // Série completa de inicio até hoje numa passada só: crédito/esperado de cada
  // (hábito, dia) calculado uma vez e reaproveitado nas janelas.
  // Retorna { n0, E:[E(inicio) .. E(hoje)] }. Antes de inicio, E = 1.0.
  function serieE(P, hoje) {
    var ini = P.aj.inicio || hoje;
    var n0 = dnum(ini), nh = dnum(hoje), res = { n0: n0, E: [] };
    if (!(nh >= n0)) return res;
    var hs = P.ativos, H = hs.length, maxW = 1, i, j;
    for (j = 0; j < H; j++) if (janela(hs[j]) > maxW) maxW = janela(hs[j]);
    var S = n0 - maxW, L = nh - S + 1;                     // dias antes de inicio são virtuais
    var cs = [], es = [], ws = [], ps = [], datas = new Array(L);
    for (i = 0; i < L; i++) datas[i] = dstr(S + i);
    for (j = 0; j < H; j++) {
      var c = new Array(L), e = new Array(L);
      for (i = 0; i < L; i++) { ce(P, hs[j], datas[i]); c[i] = P.c; e[i] = P.e; }
      cs.push(c); es.push(e); ws.push(janela(hs[j])); ps.push(peso(hs[j]));
    }
    var E = 1, TAU = EQ.TAU;
    for (i = n0 - S; i < L; i++) {
      var ehHoje = (i === L - 1), num = 0, den = 0;
      for (j = 0; j < H; j++) {
        var r = janArr(cs[j], es[j], i, ws[j]);
        if (ehHoje) {                                      // regra do hoje parcial (igual a cumpH)
          var r0 = janArr(cs[j], es[j], i - 1, ws[j]);
          if (cs[j][i] <= 0 || r0 > r) r = r0;
        }
        num += ps[j] * r; den += ps[j];
      }
      if (den > 0) E = E + (num / den - E) / TAU;
      res.E.push(E);
    }
    return res;
  }

  function valorE(s, n) {
    var k = n - s.n0;
    if (k < 0 || !s.E.length) return 1;
    if (k >= s.E.length) k = s.E.length - 1;
    return s.E[k];
  }

  function pct(x) {                         // 0..1.2 -> inteiro 0..120
    var v = Math.round(100 * x);
    return (v < 0 ? 0 : (v > 120 ? 120 : v)) + 0;
  }

  EQ.serie = function (ctx, hoje, N) {
    hoje = hoje || EQ.hoje();
    var s = serieE(prep(ctx), hoje), n = N == null ? 56 : N;
    return s.E.slice(Math.max(0, s.E.length - n));
  };

  EQ.cor = function (v, ajustes) {
    if (v === null || v === undefined || isNaN(v)) return 'sem';
    var f = (ajustes && ajustes.faixas) || FAIXAS;
    var fv = f.verde != null ? +f.verde : FAIXAS.verde, fa = f.amarelo != null ? +f.amarelo : FAIXAS.amarelo;
    if (v >= fv - EPS) return 'verde';
    if (v >= fa - EPS) return 'amarelo';
    return 'vermelho';
  };

  EQ.pontuacao = function (ctx, hoje) {
    hoje = hoje || EQ.hoje();
    var P = prep(ctx), s = serieE(P, hoje), nh = dnum(hoje), i;
    var Eh = valorE(s, nh), E7 = valorE(s, nh - 7);
    var serie = [];
    for (i = Math.max(0, s.E.length - 56); i < s.E.length; i++) serie.push(pct(s.E[i]));
    var lista = EQ.pilares(P.plano, 'ativo'), pil = [], fraco = null;
    for (i = 0; i < lista.length; i++) {
      var p = lista[i], v = media(P, doPilar(P, p.id), hoje, true);
      var valor = v === null ? null : pct(v);
      var pausado = pausadoP(P, p.id, hoje);
      pil.push({ id: p.id, nome: p.nome, icon: p.icon, valor: valor,
                 cor: pausado ? 'pausado' : EQ.cor(valor === null ? null : valor / 100, P.aj) });
      if (!pausado && valor !== null && (!fraco || valor < fraco.valor)) fraco = { id: p.id, nome: p.nome, valor: valor };
    }
    var dias = nh - s.n0 + 1;
    return { valor: pct(Eh), delta7: Math.round(100 * (Eh - E7)) + 0, serie: serie, pilares: pil,
             fraco: fraco, diasDeUso: dias > 0 ? dias : 0 };
  };

  /* ================= Textos, sugestão, revisão ================= */
  EQ.progresso = function (ctx, h, ds) {
    ctx = ctx || {};
    var reg = ctx.registros || {}, ini = (ctx.ajustes && ctx.ajustes.inicio) || '';
    var pl = (h && h.plano) || {}, n = +pl.n || 0, dias = janela(h), x = 0, d, k;
    if (dias === 7) {
      if (n >= 7) return (h && h.dica) || '';
      for (d = EQ.inicioSemana(ds); d <= ds; d = EQ.addDias(d, 1)) if (d >= ini && EQ.valor(h, reg[d]) > 0) x++;
      return x + ' de ' + n + ' na semana';
    }
    if (dias === 14) {
      for (k = 0; k <= 60; k++) {
        d = EQ.addDias(ds, -k);
        if (d < ini) break;
        if (EQ.valor(h, reg[d]) > 0) return k === 0 ? 'último hoje' : (k === 1 ? 'último ontem' : 'último há ' + k + ' dias');
      }
      return 'nenhum ainda';
    }
    for (k = 0; k < dias; k++) { d = EQ.addDias(ds, -k); if (d >= ini && EQ.valor(h, reg[d]) > 0) x++; }
    return x + ' de ' + n + ' em ' + dias + ' dias';
  };

  EQ.sugestao = function (ctx, hoje) {
    hoje = hoje || EQ.hoje();
    var P = prep(ctx), aj = P.aj, i, j, k;
    if (!aj.inicio || EQ.diffDias(aj.inicio, hoje) + 1 < 28) return null;
    var sg = aj.sugestao || {}, disp = sg.dispensadas || {};
    if (sg.ultimaEm && EQ.diffDias(sg.ultimaEm, hoje) < 21) return null;
    function livre(id) {
      var dd = hasOwn.call(disp, id) ? disp[id] : null;
      return !dd || EQ.diffDias(dd, hoje) >= 60;
    }
    var datas = [];
    for (k = 0; k <= 28; k += 7) datas.push(EQ.addDias(hoje, -k));
    var pa = EQ.pilares(P.plano, 'ativo');
    for (i = 0; i < pa.length; i++) {
      var hs = doPilar(P, pa[i].id), estavel = hs.length > 0;
      for (k = 0; estavel && k < datas.length; k++) {
        var v = media(P, hs, datas[k], false);
        if (v === null || v < 0.9 - EPS) estavel = false;
      }
      if (!estavel) continue;
      var esp = EQ.habitos(P.plano, { estado: 'espera', pid: pa[i].id });
      for (j = 0; j < esp.length; j++) {
        if (livre(esp[j].id)) return { tipo: 'habito', id: esp[j].id, pid: pa[i].id,
          texto: pa[i].nome + ' está estável há 4 semanas. Ativar “' + esp[j].nome + '”?' };
      }
    }
    var s = serieE(P, hoje), nh = dnum(hoje);
    if (valorE(s, nh) >= 0.9 - EPS && valorE(s, nh - 28) >= 0.9 - EPS) {
      var pe = EQ.pilares(P.plano, 'espera');
      for (i = 0; i < pe.length; i++) {
        if (livre(pe[i].id)) return { tipo: 'pilar', id: pe[i].id, pid: pe[i].id,
          texto: 'Equilíbrio estável há 4 semanas. Ativar o pilar “' + pe[i].nome + '”?' };
      }
    }
    return null;
  };

  EQ.revisaoRotinaDevida = function (ctx, hoje) {
    ctx = ctx || {};
    hoje = hoje || EQ.hoje();
    if (!EQ.habitos(ctx.plano, { estado: 'rotina' }).length) return false;
    var aj = ctx.ajustes || {}, base = aj.rotinaRevisao || aj.inicio;
    if (!base) return false;
    return EQ.diffDias(base, hoje) >= 30;
  };

  /* ================= Sync: merge ================= */
  function tDe(o) { var t = o ? +o._t : 0; return t > 0 ? t : 0; }   // sem _t = 0
  function copiaRasa(o) { var r = {}; for (var k in o) if (hasOwn.call(o, k)) r[k] = o[k]; return r; }

  EQ.mergeEstado = function (local, nuvem) {
    local = local || {}; nuvem = nuvem || {};
    var subir = { plano: false, registros: false, ajustes: false }, k;

    // plano: maior _t (empate fica com a nuvem)
    var lp = local.plano || null, np = nuvem.plano || null, plano;
    if (!np) { plano = lp; subir.plano = !!lp; }
    else if (lp && tDe(lp) > tDe(np)) { plano = lp; subir.plano = true; }
    else plano = np;

    // ajustes: idem; depois inicio = o menor dos dois
    var la = local.ajustes || null, na = nuvem.ajustes || null, aj;
    if (!na) { aj = la; subir.ajustes = !!la; }
    else if (la && tDe(la) > tDe(na)) { aj = la; subir.ajustes = true; }
    else aj = na;
    if (la && na && la.inicio && na.inicio) {
      var ini = la.inicio < na.inicio ? la.inicio : na.inicio;
      if (aj.inicio !== ini) { aj = copiaRasa(aj); aj.inicio = ini; }
      if (ini !== na.inicio) subir.ajustes = true;
    }

    // registros: união das datas; por data vence o Dia de maior _t (empate fica com a nuvem)
    var lr = local.registros || null, nr = nuvem.registros || null, reg = {};
    if (!nr && lr) subir.registros = true;
    if (nr) for (k in nr) if (hasOwn.call(nr, k) && nr[k]) reg[k] = nr[k];
    if (lr) for (k in lr) {
      if (!hasOwn.call(lr, k) || !lr[k]) continue;
      if (!hasOwn.call(reg, k) || tDe(lr[k]) > tDe(reg[k])) { reg[k] = lr[k]; subir.registros = true; }
    }

    return { plano: plano, registros: reg, ajustes: aj, subir: subir };
  };

  EQ.resumo = function (ctx, hoje) {
    hoje = hoje || EQ.hoje();
    var p = EQ.pontuacao(ctx, hoje), pil = {};
    for (var i = 0; i < p.pilares.length; i++) pil[p.pilares[i].id] = p.pilares[i].valor;
    return { calculadoEm: new Date().toISOString(), data: hoje, geral: p.valor, delta7: p.delta7,
             pilares: pil, fraco: p.fraco, fechadoHoje: EQ.diaFechado(ctx && ctx.registros, hoje) };
  };

  /* ================= Semente ================= */
  EQ.seed = function (hoje) {
    hoje = hoje || EQ.hoje();
    var P = [
      ['treino', 'Treino', 'barbell', 'ativo'],
      ['sono', 'Sono', 'moon', 'ativo'],
      ['alimentacao', 'Alimentação', 'salad', 'ativo'],
      ['conhecimento', 'Conhecimento', 'book', 'ativo'],
      ['carreira', 'Carreira', 'briefcase', 'ativo'],
      ['descanso', 'Descanso e lazer', 'beach', 'ativo'],
      ['debora', 'Débora', 'heart', 'ativo'],
      ['fe', 'Fé', 'building-church', 'espera'],
      ['familia', 'Família e pets', 'dog', 'espera'],
      ['amigos', 'Amigos', 'users', 'espera']
    ];
    var pilares = [], habitos = [], ordem = 0, i;
    for (i = 0; i < P.length; i++) pilares.push({ id: P[i][0], nome: P[i][1], icon: P[i][2], estado: P[i][3], ordem: i + 1 });

    function pausa() { return { modo: 'pausa' }; }
    function minimo() { return { modo: 'minimo', porSemana: 1, grupo: true }; }
    function add(id, pid, nome, icon, tipo, pontos, n, dias, estado, viagem, dica) {
      var h = { id: id, pid: pid, nome: nome, icon: icon, tipo: tipo, pontos: pontos, plano: { n: n, dias: dias },
                estado: estado, desde: hoje, dica: dica || '', ordem: ++ordem, viagem: viagem };
      if (estado !== 'ativo') delete h.desde;
      habitos.push(h);
    }
    // ativos
    add('academia', 'treino', 'Academia', 'barbell', 'check', 2, 3, 7, 'ativo', minimo());
    add('corrida', 'treino', 'Corrida', 'run', 'check', 2, 1, 7, 'ativo', minimo());
    add('dormi', 'sono', 'Dormi bem', 'moon', 'check', 2, 7, 7, 'ativo', pausa(), 'noite passada · 7h ou mais');
    add('comi', 'alimentacao', 'Comi bem', 'salad', 'nota', 2, 7, 7, 'ativo', { modo: 'ok' });
    add('agua', 'alimentacao', 'Água ok', 'droplet', 'check', 1, 7, 7, 'ativo', pausa());
    add('besteira', 'alimentacao', 'Sem besteira', 'ban', 'check', 1, 7, 7, 'ativo', pausa(), 'doce, fast food, vinho');
    add('leitura', 'conhecimento', 'Li hoje', 'book', 'check', 1, 4, 7, 'ativo', pausa());
    add('ingles', 'conhecimento', 'Inglês', 'language', 'check', 1, 2, 7, 'ativo', pausa());
    add('revisao', 'carreira', 'Revisão semanal', 'clipboard-check', 'check', 1, 1, 7, 'ativo', pausa());
    add('tempo', 'descanso', 'Tempo pra mim', 'beach', 'check', 1, 1, 7, 'ativo', pausa(), 'sem agenda, hobby, natureza');
    add('presente', 'debora', 'Fui presente hoje', 'heart', 'check', 1, 4, 7, 'ativo', pausa());
    add('date', 'debora', 'Date', 'glass', 'check', 1, 1, 14, 'ativo', pausa());
    // em espera
    var E = [
      ['bike', 'treino', 'Bike', 'bike', 1, 7],
      ['longo', 'treino', 'Treino longo', 'route', 1, 14],
      ['prova', 'treino', 'Prova / meia maratona', 'medal', 1, 30],
      ['jejum', 'alimentacao', 'Jejum', 'clock', 1, 30],
      ['frutas', 'alimentacao', 'Comer frutas', 'apple', 5, 7],
      ['podcast', 'conhecimento', 'Podcast', 'headphones', 2, 7],
      ['treinamento', 'carreira', 'Treinamento ou palestra', 'presentation', 1, 30],
      ['feedback', 'carreira', 'Dar feedback', 'message-circle', 1, 7],
      ['industria', 'carreira', 'Visitar indústria', 'building-factory', 1, 30],
      ['meditar', 'descanso', 'Meditar', 'yoga', 3, 7],
      ['presente_simb', 'debora', 'Presente simbólico', 'gift', 1, 30],
      ['biblia', 'fe', 'Ler a Bíblia', 'book-2', 5, 7],
      ['igreja', 'fe', 'Ir à igreja', 'building-church', 1, 7],
      ['pets', 'familia', 'Brincar com Thor e Zeus', 'dog', 3, 7],
      ['happy_hour', 'amigos', 'Happy hour', 'beer', 1, 14],
      ['almoco_amigo', 'amigos', 'Almoço com amigo', 'tools-kitchen-2', 1, 14]
    ];
    for (i = 0; i < E.length; i++) add(E[i][0], E[i][1], E[i][2], E[i][3], 'check', 1, E[i][4], E[i][5], 'espera', pausa());
    // virou rotina
    var R = [
      ['facial_manha', null, 'Facial (manhã)', 'sun'],
      ['facial_noite', null, 'Facial (noite)', 'moon-stars'],
      ['sem_rede', null, 'Sem rede social', 'device-mobile-off'],
      ['suplementos', 'alimentacao', 'Suplementos', 'pill'],
      ['cafe', 'alimentacao', 'Café da manhã', 'coffee']
    ];
    for (i = 0; i < R.length; i++) add(R[i][0], R[i][1], R[i][2], R[i][3], 'check', 1, 7, 7, 'rotina', pausa());

    return {
      plano: { _t: 0, pilares: pilares, habitos: habitos },
      ajustes: { _t: 0, versao: 2, inicio: hoje, pushOn: true, pushHora: '21:30', viagens: [],
                 rotinaRevisao: hoje, sugestao: { ultimaEm: null, dispensadas: {} },
                 faixas: { verde: 0.9, amarelo: 0.6 } }
    };
  };

  /* ================= Autoteste (datas fixas, sem hoje real) ================= */
  EQ._selfTest = function () {
    var falhas = [], total = 0;
    function ok(cond, msg) { total++; if (!cond) falhas.push(msg); }
    function perto(a, b, tol, msg) {
      total++;
      if (typeof a !== 'number' || isNaN(a) || Math.abs(a - b) > tol) falhas.push(msg + ' (obtido ' + a + ', esperado ' + b + ')');
    }
    function caso(nome, fn) {
      try { fn(); } catch (err) { total++; falhas.push('caso ' + nome + ': exceção ' + (err && err.message ? err.message : err)); }
    }
    function novoCtx(ini) { var s = EQ.seed(ini); return { plano: s.plano, registros: {}, ajustes: s.ajustes }; }
    function hab(ctx, id) {
      var hs = ctx.plano.habitos;
      for (var i = 0; i < hs.length; i++) if (hs[i].id === id) return hs[i];
      return null;
    }
    function marca(ctx, ds, id, v) {
      var d = ctx.registros[ds] || (ctx.registros[ds] = { _t: 1 });
      d[id] = v === undefined ? 1 : v;
    }
    function marcaFaixa(ctx, de, ate, id, v) { for (var d = de; d <= ate; d = EQ.addDias(d, 1)) marca(ctx, d, id, v); }

    // 1. semente
    caso('1', function () {
      var s = EQ.seed('2026-01-01'), pl = s.plano, vistos = {}, dup = [], desdeOk = true, pidOk = true, i, x;
      ok(EQ.pilares(pl, 'ativo').length === 7, '1: 7 pilares ativos');
      ok(EQ.pilares(pl, 'espera').length === 3, '1: 3 pilares em espera');
      ok(EQ.habitosAtivos(pl).length === 12, '1: 12 hábitos ativos');
      ok(EQ.habitos(pl, { estado: 'espera' }).length === 16, '1: 16 hábitos em espera');
      ok(EQ.habitos(pl, { estado: 'rotina' }).length === 5, '1: 5 hábitos rotina');
      var todos = pl.pilares.concat(pl.habitos);
      for (i = 0; i < todos.length; i++) {
        x = 'k' + todos[i].id;
        if (vistos[x]) dup.push(todos[i].id);
        vistos[x] = true;
      }
      ok(dup.length === 0, '1: ids únicos (' + dup.join(',') + ')');
      for (i = 0; i < pl.habitos.length; i++) {
        x = pl.habitos[i];
        if (x.estado === 'ativo' ? x.desde !== '2026-01-01' : x.desde !== undefined) desdeOk = false;
        if (x.pid !== null && !vistos['k' + x.pid]) pidOk = false;
      }
      ok(desdeOk, '1: desde = hoje só nos ativos');
      ok(pidOk, '1: pid aponta para pilar existente');
      ok(pl._t === 0 && s.ajustes._t === 0, '1: _t = 0 na semente');
      ok(s.ajustes.inicio === '2026-01-01' && s.ajustes.rotinaRevisao === '2026-01-01' && s.ajustes.versao === 2 &&
         s.ajustes.pushOn === true && s.ajustes.pushHora === '21:30' && s.ajustes.viagens.length === 0 &&
         s.ajustes.sugestao.ultimaEm === null && s.ajustes.faixas.verde === 0.9 && s.ajustes.faixas.amarelo === 0.6,
         '1: ajustes padrão');
      ok(EQ.habitos(pl)[0].id === 'academia' && EQ.habitosAtivos(pl)[11].id === 'date', '1: ordem por pilar e hábito');
    });

    // 2. dia 0 sem registros
    caso('2', function () {
      var ctx = novoCtx('2026-01-01'), p = EQ.pontuacao(ctx, '2026-01-01'), todos = true;
      ok(p.valor === 100, '2: pontuação 100 no dia 0 (' + p.valor + ')');
      ok(p.pilares.length === 7, '2: 7 pilares na pontuação');
      for (var i = 0; i < p.pilares.length; i++) if (p.pilares[i].valor !== 100 || p.pilares[i].cor !== 'verde') todos = false;
      ok(todos, '2: todos os pilares 100');
      ok(p.delta7 === 0 && p.diasDeUso === 1 && p.serie.length === 1 && p.serie[0] === 100, '2: delta7, diasDeUso e série');
      ok(p.fraco && p.fraco.id === 'treino' && p.fraco.valor === 100, '2: fraco no empate = primeiro pilar');
    });

    // 3. diário feito 10 dias seguidos
    caso('3', function () {
      var ctx = novoCtx('2026-01-01');
      marcaFaixa(ctx, '2026-01-01', '2026-01-10', 'agua');
      perto(EQ.cumprimentoHabito(ctx, hab(ctx, 'agua'), '2026-01-10'), 1, 1e-9, '3: diário 10 dias seguidos');
    });

    // 4. academia 3/7
    caso('4', function () {
      var ctx = novoCtx('2026-01-01'), h = hab(ctx, 'academia'), ds = '2026-01-20';
      marca(ctx, '2026-01-14', 'academia'); marca(ctx, '2026-01-16', 'academia'); marca(ctx, '2026-01-18', 'academia');
      marca(ctx, '2026-01-13', 'academia');   // fora da janela
      perto(EQ.cumprimentoHabito(ctx, h, ds), 1, 1e-9, '4: 3 de 3 na janela');
      delete ctx.registros['2026-01-18'].academia;
      perto(EQ.cumprimentoHabito(ctx, h, ds), 2 / 3, 0.01, '4: 2 de 3 na janela');
      marca(ctx, '2026-01-18', 'academia'); marca(ctx, '2026-01-20', 'academia');
      perto(EQ.cumprimentoHabito(ctx, h, ds), 1.2, 1e-9, '4: 4 de 3 (teto 1.2)');
    });

    // 5. viagem com pausa
    caso('5', function () {
      var ctx = novoCtx('2026-01-01');
      ctx.ajustes.viagens = [{ de: '2026-01-14', ate: '2026-01-20' }];
      perto(EQ.cumprimentoHabito(ctx, hab(ctx, 'agua'), '2026-01-20'), 1, 1e-9, '5: viagem pausa 7 dias sem registro');
      ok(EQ.pilarPausado(ctx, 'sono', '2026-01-17') === true, '5: pilar só com pausa fica pausado');
      ok(EQ.pilarPausado(ctx, 'treino', '2026-01-17') === false, '5: pilar com mínimo não fica pausado');
      ok(EQ.pilarPausado(ctx, 'sono', '2026-01-21') === false, '5: fora da viagem não pausa');
      var p = EQ.pontuacao(ctx, '2026-01-17');
      ok(p.pilares[1].cor === 'pausado' && (!p.fraco || p.fraco.id !== 'sono'), '5: cor pausado e fora do fraco');
      ctx.ajustes.viagens = [{ de: '2026-01-14', ate: null }];
      ok(EQ.emViagem(ctx.ajustes, '2026-03-01') && !EQ.emViagem(ctx.ajustes, '2026-01-13'), '5: viagem em andamento (ate null)');
    });

    // 6. viagem mínimo em grupo
    caso('6', function () {
      var ctx = novoCtx('2026-01-01');
      ctx.ajustes.viagens = [{ de: '2026-01-14', ate: '2026-01-20' }];
      marca(ctx, '2026-01-16', 'corrida');
      perto(EQ.cumprimentoHabito(ctx, hab(ctx, 'academia'), '2026-01-20'), 1, 1e-9, '6: academia 1.0 com 1 corrida (grupo)');
      perto(EQ.cumprimentoHabito(ctx, hab(ctx, 'corrida'), '2026-01-20'), 1, 1e-9, '6: corrida 1.0');
      perto(EQ.cumprimentoPilar(ctx, 'treino', '2026-01-20'), 1, 1e-9, '6: pilar treino 1.0');
      hab(ctx, 'academia').viagem = { modo: 'minimo', porSemana: 1, grupo: false };
      perto(EQ.cumprimentoHabito(ctx, hab(ctx, 'academia'), '2026-01-20'), 0, 1e-9, '6: sem grupo não herda a corrida');
    });

    // 7. nota em viagem modo ok
    caso('7', function () {
      var ctx = novoCtx('2026-01-01'), h = hab(ctx, 'comi');
      marcaFaixa(ctx, '2026-01-14', '2026-01-20', 'comi', 0.5);
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20'), 0.5, 1e-9, '7: nota 0.5 fora da viagem');
      ctx.ajustes.viagens = [{ de: '2026-01-14', ate: '2026-01-20' }];
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20'), 1, 1e-9, '7: nota 0.5 conta 1 na viagem (ok)');
      marca(ctx, '2026-01-20', 'comi', 0);
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20'), 6 / 7, 1e-9, '7: nota 0 continua 0 na viagem');
    });

    // 8. hoje parcial
    caso('8', function () {
      var ctx = novoCtx('2026-01-01'), h = hab(ctx, 'agua');
      marcaFaixa(ctx, '2026-01-01', '2026-01-19', 'agua');
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20', { parcial: true }), 1, 1e-9, '8: hoje não marcado não derruba (parcial)');
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20'), 6 / 7, 1e-9, '8: sem parcial conta o dia');
      // nota: marcar só melhora (1 por 6 dias, 0.5 hoje)
      var c2 = novoCtx('2026-01-14'), hn = hab(c2, 'comi');
      marcaFaixa(c2, '2026-01-14', '2026-01-19', 'comi', 1);
      marca(c2, '2026-01-20', 'comi', 0.5);
      perto(EQ.cumprimentoHabito(c2, hn, '2026-01-20', { parcial: true }), 1, 1e-9, '8: nota 0.5 hoje não derruba (parcial)');
      perto(EQ.cumprimentoHabito(c2, hn, '2026-01-20'), 6.5 / 7, 1e-9, '8: nota 0.5 sem parcial conta o dia');
      marca(c2, '2026-01-20', 'comi', 0);
      perto(EQ.cumprimentoHabito(c2, hn, '2026-01-20', { parcial: true }), 1, 1e-9, '8: nota 0 hoje não derruba (parcial)');
      // pilar e série com nota 0.5 hoje
      var c3 = novoCtx('2026-01-01'), at = EQ.habitosAtivos(c3.plano), d, j, E = 1;
      for (d = '2026-01-01'; d <= '2026-01-19'; d = EQ.addDias(d, 1)) for (j = 0; j < at.length; j++) marca(c3, d, at[j].id);
      marca(c3, '2026-01-20', 'comi', 0.5); marca(c3, '2026-01-20', 'agua');
      var p = EQ.pontuacao(c3, '2026-01-20');
      ok(p.pilares[2].id === 'alimentacao' && p.pilares[2].valor === 100, '8: mais ou menos hoje não baixa o pilar (' + p.pilares[2].valor + ')');
      for (d = '2026-01-01'; d < '2026-01-20'; d = EQ.addDias(d, 1)) E += (EQ.cumprimentoGeral(c3, d) - E) / EQ.TAU;
      E += (EQ.cumprimentoGeral(c3, '2026-01-20', { parcial: true }) - E) / EQ.TAU;
      perto(EQ.serie(c3, '2026-01-20', 1)[0], E, 1e-9, '8: série usa a mesma regra do hoje parcial');
    });

    // 9. EWMA a partir do baseline
    caso('9', function () {
      var ini = '2026-01-01';
      var ctx = {
        plano: { _t: 1, pilares: [{ id: 'p', nome: 'P', icon: 'x', estado: 'ativo', ordem: 1 }],
                 habitos: [{ id: 'h', pid: 'p', nome: 'H', icon: 'x', tipo: 'check', pontos: 1, plano: { n: 1, dias: 1 },
                             estado: 'ativo', desde: ini, ordem: 1 }] },
        registros: {}, ajustes: { _t: 1, inicio: ini, viagens: [], faixas: { verde: 0.9, amarelo: 0.6 } }
      };
      var hoje = EQ.addDias(ini, 41), s = EQ.serie(ctx, hoje, 100);
      ok(s.length === 42, '9: série com 42 dias (' + s.length + ')');
      perto(s[0], 1 - 1 / 42, 1e-9, '9: primeiro passo');
      perto(s[s.length - 1], 0.364, 0.01, '9: 42 dias com O=0');
      ok(EQ.pontuacao(ctx, hoje).valor === 36, '9: pontuação 36');
    });

    // 10. merge
    caso('10', function () {
      var local = { plano: { _t: 5, x: 'L' },
        registros: { '2026-01-01': { _t: 10, agua: 1 }, '2026-01-02': { _t: 1, agua: 1 }, '2026-01-03': { _t: 3, comi: 1 } },
        ajustes: { _t: 1, inicio: '2026-01-01' } };
      var nuvem = { plano: { _t: 7, x: 'N' },
        registros: { '2026-01-01': { _t: 5, agua: 1, comi: 0 }, '2026-01-02': { _t: 2, _f: 1 }, '2026-01-04': { dormi: 1 } },
        ajustes: { _t: 2, inicio: '2026-01-05' } };
      var m = EQ.mergeEstado(local, nuvem);
      ok(m.plano.x === 'N' && m.subir.plano === false, '10: plano pelo _t (nuvem)');
      ok(m.registros['2026-01-01'] === local.registros['2026-01-01'], '10: dia com _t local maior');
      ok(m.registros['2026-01-02'] === nuvem.registros['2026-01-02'], '10: dia com _t da nuvem maior');
      ok(m.registros['2026-01-03'] === local.registros['2026-01-03'] &&
         m.registros['2026-01-04'] === nuvem.registros['2026-01-04'], '10: união das datas');
      ok(m.subir.registros === true, '10: registros sobem quando o local vence');
      ok(m.ajustes._t === 2 && m.ajustes.inicio === '2026-01-01' && m.subir.ajustes === true, '10: ajustes da nuvem com inicio = min');
      ok(nuvem.ajustes.inicio === '2026-01-05', '10: entrada não é alterada');
      var m2 = EQ.mergeEstado({ plano: nuvem.plano, registros: nuvem.registros, ajustes: nuvem.ajustes }, nuvem);
      ok(!m2.subir.plano && !m2.subir.registros && !m2.subir.ajustes, '10: estado igual não sobe nada');
      var m3 = EQ.mergeEstado({ plano: { _t: 7, x: 'L' }, registros: { '2026-01-04': { _t: 0, agua: 1 } }, ajustes: null }, nuvem);
      ok(m3.plano.x === 'N' && !m3.subir.plano, '10: empate de plano fica com a nuvem');
      ok(m3.registros['2026-01-04'] === nuvem.registros['2026-01-04'] && !m3.subir.registros, '10: empate de dia fica com a nuvem');
      ok(m3.ajustes === nuvem.ajustes && !m3.subir.ajustes, '10: ajustes local ausente');
      var m4 = EQ.mergeEstado(local, { plano: null, registros: null, ajustes: null });
      ok(m4.plano === local.plano && m4.ajustes === local.ajustes && m4.subir.plano && m4.subir.registros && m4.subir.ajustes,
         '10: nuvem vazia sobe tudo');
      var m5 = EQ.mergeEstado({ plano: { _t: 9, x: 'L' } }, nuvem);
      ok(m5.plano.x === 'L' && m5.subir.plano && !m5.subir.registros && !m5.subir.ajustes, '10: plano local mais novo sobe');
    });

    // 11. dia fechado
    caso('11', function () {
      var r = { '2026-01-01': { _t: 5, _f: 1 }, '2026-01-02': { _t: 5, agua: 1 }, '2026-01-03': { _t: 1 } };
      ok(EQ.diaFechado(r, '2026-01-01') === true, '11: _f sozinho fecha');
      ok(EQ.diaFechado(r, '2026-01-02') === true, '11: chave de hábito fecha');
      ok(EQ.diaFechado(r, '2026-01-03') === false, '11: só _t não fecha');
      ok(EQ.diaFechado(r, '2026-01-04') === false, '11: dia ausente não fecha');
    });

    // 12. sugestão
    caso('12', function () {
      var ctx = novoCtx('2026-01-01');
      ok(EQ.sugestao(ctx, '2026-01-27') === null, '12: nula com menos de 28 dias de uso');
      var c2 = novoCtx('2026-01-01'), at = EQ.habitosAtivos(c2.plano), hoje = '2026-02-15', d, j;
      for (d = '2026-01-01'; d <= hoje; d = EQ.addDias(d, 1)) for (j = 0; j < at.length; j++) marca(c2, d, at[j].id, 1);
      marcaFaixa(ctx, '2026-01-01', '2026-01-27', 'agua');
      ok(EQ.sugestao(ctx, '2026-01-27') === null, '12: nula com menos de 28 dias mesmo com registros');
      var sg = EQ.sugestao(c2, hoje);
      ok(sg && sg.tipo === 'habito' && sg.id === 'bike' && sg.pid === 'treino', '12: sugere o 1º em espera do 1º pilar estável');
      ok(sg && sg.texto === 'Treino está estável há 4 semanas. Ativar “Bike”?', '12: texto da sugestão de hábito');
      c2.ajustes.sugestao.dispensadas = { bike: '2026-02-01' };
      sg = EQ.sugestao(c2, hoje);
      ok(sg && sg.id === 'longo', '12: pula o dispensado há menos de 60 dias');
      c2.ajustes.sugestao.dispensadas = { bike: '2025-12-01' };
      sg = EQ.sugestao(c2, hoje);
      ok(sg && sg.id === 'bike', '12: dispensa antiga (60+ dias) libera');
      var esp = EQ.habitos(c2.plano, { estado: 'espera' }), disp = {};
      for (j = 0; j < esp.length; j++) disp[esp[j].id] = '2026-02-10';
      c2.ajustes.sugestao.dispensadas = disp;
      sg = EQ.sugestao(c2, hoje);
      ok(sg && sg.tipo === 'pilar' && sg.id === 'fe' && sg.pid === 'fe' &&
         sg.texto === 'Equilíbrio estável há 4 semanas. Ativar o pilar “Fé”?', '12: sugestão de pilar');
      c2.ajustes.sugestao.ultimaEm = '2026-02-01';
      ok(EQ.sugestao(c2, hoje) === null, '12: nula com sugestão há menos de 21 dias');
    });

    // 13. datas
    caso('13', function () {
      ok(EQ.addDias('2026-12-31', 1) === '2027-01-01' && EQ.addDias('2026-03-01', -1) === '2026-02-28' &&
         EQ.addDias('2028-02-28', 1) === '2028-02-29', '13: addDias em viradas de mês/ano');
      ok(EQ.addDias('2026-03-08', 1) === '2026-03-09' && EQ.addDias('2026-10-25', 1) === '2026-10-26' &&
         EQ.addDias('2026-11-01', -1) === '2026-10-31', '13: addDias em datas de horário de verão');
      ok(EQ.diffDias('2026-01-01', '2026-12-31') === 364 && EQ.diffDias('2026-10-20', '2026-10-10') === -10, '13: diffDias');
      ok(EQ.inicioSemana('2026-09-19') === '2026-09-14' && EQ.inicioSemana('2026-09-20') === '2026-09-14' &&
         EQ.inicioSemana('2026-09-14') === '2026-09-14', '13: inicioSemana = segunda');
      ok(EQ.iso(new Date(2026, 8, 5, 23, 59)) === '2026-09-05', '13: iso local');
    });

    // 14. textos
    caso('14', function () {
      var ctx = novoCtx('2026-09-14');   // segunda-feira
      marca(ctx, '2026-09-14', 'academia'); marca(ctx, '2026-09-16', 'academia');
      ok(EQ.progresso(ctx, hab(ctx, 'academia'), '2026-09-17') === '2 de 3 na semana', '14: X de n na semana');
      ok(EQ.progresso(ctx, hab(ctx, 'academia'), '2026-09-21') === '0 de 3 na semana', '14: semana nova zera');
      ok(EQ.progresso(ctx, hab(ctx, 'dormi'), '2026-09-17') === 'noite passada · 7h ou mais', '14: diário mostra a dica');
      ok(EQ.progresso(ctx, hab(ctx, 'comi'), '2026-09-17') === '', '14: diário sem dica');
      marca(ctx, '2026-09-15', 'date');
      ok(EQ.progresso(ctx, hab(ctx, 'date'), '2026-09-14') === 'nenhum ainda', '14: nenhum ainda');
      ok(EQ.progresso(ctx, hab(ctx, 'date'), '2026-09-15') === 'último hoje', '14: último hoje');
      ok(EQ.progresso(ctx, hab(ctx, 'date'), '2026-09-16') === 'último ontem', '14: último ontem');
      ok(EQ.progresso(ctx, hab(ctx, 'date'), '2026-09-18') === 'último há 3 dias', '14: último há N dias');
      marca(ctx, '2026-09-15', 'prova');
      ok(EQ.progresso(ctx, hab(ctx, 'prova'), '2026-09-18') === '1 de 1 em 30 dias', '14: X de n em 30 dias');
      ok(EQ.textoPlano(hab(ctx, 'dormi')) === 'todo dia' && EQ.textoPlano(hab(ctx, 'academia')) === '3× na semana' &&
         EQ.textoPlano(hab(ctx, 'date')) === '1× a cada 15 dias' && EQ.textoPlano(hab(ctx, 'prova')) === '1× no mês', '14: textoPlano');
      var aj = ctx.ajustes;
      ok(EQ.cor(0.9, aj) === 'verde' && EQ.cor(0.89, aj) === 'amarelo' && EQ.cor(0.6, aj) === 'amarelo' &&
         EQ.cor(0.59, aj) === 'vermelho' && EQ.cor(null, aj) === 'sem', '14: cor pelas faixas');
    });

    // 15. série rápida = cálculo direto dia a dia; pontuação e resumo coerentes
    caso('15', function () {
      var ctx = novoCtx('2026-01-01'), at = EQ.habitosAtivos(ctx.plano), sem = 12345, hoje = '2026-03-15', d, j, r;
      function rnd() { sem = (sem * 16807) % 2147483647; return sem / 2147483647; }
      for (d = '2026-01-01'; d <= hoje; d = EQ.addDias(d, 1)) for (j = 0; j < at.length; j++) {
        r = rnd();
        if (at[j].tipo === 'nota') { if (r < 0.8) marca(ctx, d, at[j].id, r < 0.3 ? 0 : (r < 0.55 ? 0.5 : 1)); }
        else if (r < EQ.taxa(at[j]) * 0.9 + 0.05) marca(ctx, d, at[j].id);
      }
      delete ctx.registros[hoje];                       // hoje em aberto: exercita a regra parcial
      ctx.ajustes.viagens = [{ de: '2026-02-01', ate: '2026-02-06' }];
      hab(ctx, 'leitura').desde = '2026-02-10';          // reativado depois: dias virtuais antes
      var E = 1, esperado = [], dif = 0;
      for (d = '2026-01-01'; d < hoje; d = EQ.addDias(d, 1)) { E += (EQ.cumprimentoGeral(ctx, d) - E) / EQ.TAU; esperado.push(E); }
      E += (EQ.cumprimentoGeral(ctx, hoje, { parcial: true }) - E) / EQ.TAU; esperado.push(E);
      var s = EQ.serie(ctx, hoje, 1000);
      ok(s.length === esperado.length, '15: tamanho da série');
      for (j = 0; j < s.length; j++) dif = Math.max(dif, Math.abs(s[j] - esperado[j]));
      ok(dif < 1e-9, '15: série rápida = cálculo direto (dif ' + dif + ')');
      var p = EQ.pontuacao(ctx, hoje);
      ok(p.valor === Math.round(100 * E), '15: valor');
      ok(p.delta7 === Math.round(100 * (E - esperado[esperado.length - 8])), '15: delta7');
      ok(p.serie.length === 56 && p.serie[55] === p.valor, '15: série de 56 termina no valor');
      ok(p.diasDeUso === 74, '15: diasDeUso');
      var menor = null;
      for (j = 0; j < p.pilares.length; j++) if (p.pilares[j].cor !== 'pausado' && p.pilares[j].valor !== null &&
        (menor === null || p.pilares[j].valor < menor)) menor = p.pilares[j].valor;
      ok(p.fraco && p.fraco.valor === menor, '15: fraco = menor pilar');
      var rs = EQ.resumo(ctx, hoje);
      ok(rs.data === hoje && rs.geral === p.valor && rs.delta7 === p.delta7 && typeof rs.calculadoEm === 'string' &&
         rs.pilares.treino === p.pilares[0].valor && rs.fechadoHoje === false && rs.fraco.id === p.fraco.id, '15: resumo');
    });

    // 16. dias virtuais, pilares em espera, revisão mensal
    caso('16', function () {
      var ctx = novoCtx('2026-01-01'), h = hab(ctx, 'agua');
      h.desde = '2026-01-18';
      ok(EQ.inicioHabito(h, ctx.ajustes) === '2026-01-18', '16: inicioHabito = maior data');
      perto(EQ.cumprimentoHabito(ctx, h, '2026-01-20'), 4 / 7, 1e-9, '16: dias antes do desde são virtuais');
      ok(EQ.cumprimentoPilar(ctx, 'fe', '2026-01-20') === null, '16: pilar em espera sem hábito ativo = null');
      ok(!EQ.revisaoRotinaDevida(ctx, '2026-01-30') && EQ.revisaoRotinaDevida(ctx, '2026-01-31'), '16: revisão aos 30 dias');
      ctx.ajustes.rotinaRevisao = '2026-01-31';
      ok(!EQ.revisaoRotinaDevida(ctx, '2026-02-15'), '16: revisão feita zera o prazo');
    });

    return { ok: falhas.length === 0, total: total, falhas: falhas };
  };

  root.EQ = EQ;
  if (typeof module !== 'undefined' && module.exports) module.exports = EQ;
})(typeof window !== 'undefined' ? window : this);
