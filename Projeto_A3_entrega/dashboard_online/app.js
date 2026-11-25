(function () {
  "use strict";

  const LINHAS = (window.DADOS && window.DADOS.linhas) || [];
  const MENSAL = (window.DADOS && window.DADOS.mensal) || [];
  const $ = (sel) => document.querySelector(sel);
  if (!LINHAS.length) {
    $("#conteudo").textContent = "Não encontrei os dados (dados.js). Rode gerar_dados_site.py e recarregue a página.";
    return;
  }
  const MODO_ARTIFACT = !!window.MODO_ARTIFACT;

  const nfs = {};
  const nf = (nd) => nfs[nd] || (nfs[nd] = new Intl.NumberFormat("pt-BR", { minimumFractionDigits: nd, maximumFractionDigits: nd }));
  function num(v, nd = 1, sinal = false) {
    if (v == null || !isFinite(v)) return "–";
    const corpo = nf(nd).format(Math.abs(v));
    const zero = /^[0,.]+$/.test(corpo);
    return (zero ? "" : v < 0 ? "−" : sinal ? "+" : "") + corpo;
  }

  const VAR = {
    desocupacao:            { rotulo: "Desocupação", curto: "Desocupação", unid: "%", nd: 1 },
    rendimento_real:        { rotulo: "Rendimento real", curto: "Rendimento", unid: "R$", nd: 0 },
    endividamento_familias: { rotulo: "Endividamento", curto: "Endividamento", unid: "% da renda", nd: 1 },
    ipca_12m_trim:          { rotulo: "IPCA 12 meses", curto: "IPCA 12m", unid: "%", nd: 2 },
    rend_var_ano_pct:       { rotulo: "Var. anual da renda", curto: "Var. renda (ano)", unid: "%", nd: 1, sinal: true },
    desocup_var_pp_ano:     { rotulo: "Var. da desocupação em 12 meses", curto: "Δ desocup. (12m)", unid: "p.p.", nd: 1, sinal: true },
    endiv_var_pp_ano:       { rotulo: "Var. do endividamento em 12 meses", curto: "Δ endivid. (12m)", unid: "p.p.", nd: 2, sinal: true },
  };
  function fv(col, v) {
    const c = VAR[col];
    if (v == null || !isFinite(v)) return "–";
    if (c.unid === "R$") return "R$ " + num(v, c.nd);
    if (c.unid === "p.p.") return num(v, c.nd, true) + " p.p.";
    return num(v, c.nd, !!c.sinal) + "%";
  }
  const rotuloEixo = (col) => `${VAR[col].rotulo} (${VAR[col].unid})`;
  const faseCurta = (p) => p.replace(/^\d+\.\s*/, "").replace(/\s*\(.*\)$/, "");
  const tempo = (r) => r.ano + (r.tri - 1) / 4;

  const pares = (rows, a, b) => rows.filter((r) => r[a] != null && r[b] != null).map((r) => [r[a], r[b], r]);
  function medias(ps) {
    let mx = 0, my = 0;
    for (const [x, y] of ps) { mx += x; my += y; }
    return [mx / ps.length, my / ps.length];
  }
  function pearson(ps) {
    if (ps.length < 3) return NaN;
    const [mx, my] = medias(ps);
    let sxy = 0, sxx = 0, syy = 0;
    for (const [x, y] of ps) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; syy += (y - my) ** 2; }
    return sxy / Math.sqrt(sxx * syy);
  }
  function ols(ps) {
    const [mx, my] = medias(ps);
    let sxy = 0, sxx = 0;
    for (const [x, y] of ps) { sxy += (x - mx) * (y - my); sxx += (x - mx) ** 2; }
    const b = sxy / sxx;
    return { b, a: my - b * mx };
  }
  function forca(r) {
    const a = Math.round(Math.abs(r) * 100) / 100;
    const f = a >= 0.7 ? "forte" : a >= 0.4 ? "moderada" : a >= 0.2 ? "fraca" : "muito fraca";
    return `associação ${f}${a >= 0.2 ? (r < 0 ? " e negativa" : " e positiva") : ""}`;
  }

  LINHAS.forEach((r, i) => {
    const a = LINHAS[i - 4];
    r.ipca_12m_var_pp_ano = a && r.ipca_12m_trim != null && a.ipca_12m_trim != null && tempo(r) - tempo(a) === 1
      ? r.ipca_12m_trim - a.ipca_12m_trim : null;
  });
  const T_MIN = tempo(LINHAS[0]), T_MAX = tempo(LINHAS[LINHAS.length - 1]);
  const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
  const tempoMes = (r) => r.ano + (r.mes - 1) / 12;
  const rotMes = (r) => `${MESES[r.mes - 1]}/${r.ano}`;
  const TM_MIN = tempoMes(MENSAL[0]), TM_MAX = tempoMes(MENSAL[MENSAL.length - 1]);
  const ANO_MIN = LINHAS[0].ano, ANO_MAX = LINHAS[LINHAS.length - 1].ano;

  function passos(min, max, n) {
    if (min === max) { min -= 1; max += 1; }
    const bruto = (max - min) / n, mag = Math.pow(10, Math.floor(Math.log10(bruto))), e = bruto / mag;
    const passo = (e >= 7.5 ? 10 : e >= 3.5 ? 5 : e >= 1.5 ? 2 : 1) * mag;
    const out = [];
    for (let v = Math.ceil(min / passo - 1e-9) * passo; v <= max + passo * 1e-9; v += passo) out.push(+v.toFixed(10));
    return { ticks: out, passo };
  }
  function dominio(min, max, n = 4) {
    const { passo } = passos(min, max, n);
    return [Math.floor(min / passo + 1e-9) * passo, Math.ceil(max / passo - 1e-9) * passo];
  }
  const casas = (passo) => (passo >= 1 ? 0 : passo >= 0.1 ? 1 : 2);
  function lin(d0, d1, r0, r1) {
    const k = (r1 - r0) / ((d1 - d0) || 1);
    const f = (v) => r0 + (v - d0) * k;
    f.inv = (p) => d0 + (p - r0) / k;
    return f;
  }
  const NS = "http://www.w3.org/2000/svg";
  function s(tag, attrs, pai) {
    const e = document.createElementNS(NS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]);
    if (pai) pai.appendChild(e);
    return e;
  }
  function texto(pai, x, y, conteudo, attrs) {
    const e = s("text", Object.assign({ x, y }, attrs), pai);
    e.textContent = conteudo;
    return e;
  }
  function novoSvg(box, w, h, rotulo) {
    box.textContent = "";
    const svg = s("svg", { viewBox: `0 0 ${w} ${h}`, width: w, height: h, role: "img", "aria-label": rotulo });
    box.appendChild(svg);
    return svg;
  }
  function vazio(box, msg) {
    box.textContent = "";
    const p = document.createElement("p");
    p.className = "vazio";
    p.textContent = msg;
    box.appendChild(p);
  }
  function ponteiro(svg, ev) {
    const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    return [(ev.clientX - r.left) * (vb.width / r.width), (ev.clientY - r.top) * (vb.height / r.height)];
  }
  function barraPath(x, y0, y1, w) {
    const sobe = y1 < y0, h = Math.abs(y1 - y0), r = Math.min(4, w / 2, h);
    if (h < 0.5) return `M${x},${y0}h${w}`;
    if (sobe) return `M${x},${y0}V${y1 + r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 + r}V${y0}Z`;
    return `M${x},${y0}V${y1 - r}Q${x},${y1} ${x + r},${y1}H${x + w - r}Q${x + w},${y1} ${x + w},${y1 - r}V${y0}Z`;
  }

  const tip = $("#tooltip");
  function dica(titulo, itens, x, y) {
    const sob = document.elementFromPoint(x, y);
    if (!(sob && sob.closest(".grafico"))) { semDica(); return; }
    tip.textContent = "";
    const t = document.createElement("div");
    t.className = "tip-tit";
    t.textContent = titulo;
    tip.appendChild(t);
    for (const it of itens) {
      const linha = document.createElement("div");
      linha.className = "tip-linha";
      if (it.cor) {
        const k = document.createElement("span");
        k.className = "tip-chave";
        k.style.background = it.cor;
        linha.appendChild(k);
      }
      const v = document.createElement("strong");
      v.textContent = it.valor;
      linha.appendChild(v);
      if (it.rotulo) {
        const l = document.createElement("span");
        l.textContent = it.rotulo;
        linha.appendChild(l);
      }
      tip.appendChild(linha);
    }
    tip.hidden = false;
    const w = tip.offsetWidth, h = tip.offsetHeight, m = 14;
    let L = x + m, T = y + m;
    if (L + w > innerWidth - 8) L = x - w - m;
    if (T + h > innerHeight - 8) T = y - h - m;
    tip.style.left = Math.max(8, L) + scrollX + "px";
    tip.style.top = Math.max(8, T) + scrollY + "px";
  }
  const limpezas = {};
  function semDica() {
    tip.hidden = true;
    for (const f of Object.values(limpezas)) f();
  }
  const centro = (el) => { const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  let rolandoAte = 0;
  const rolou = () => { rolandoAte = performance.now() + 400; semDica(); };
  for (const ev of ["scroll", "wheel", "touchmove"]) document.addEventListener(ev, rolou, { capture: true, passive: true });
  document.addEventListener("pointermove", (ev) => {
    const falso = ev.pointerType === "mouse" && ev.movementX === 0 && ev.movementY === 0;
    if (falso || performance.now() < rolandoAte) {
      ev.stopImmediatePropagation();
      return;
    }
    if (!tip.hidden && !(ev.target instanceof Element && ev.target.closest(".grafico"))) semDica();
  }, { capture: true, passive: true });
  document.documentElement.addEventListener("pointerleave", semDica);
  window.addEventListener("blur", semDica);
  let porTeclado = false;
  document.addEventListener("keydown", () => { porTeclado = true; }, true);
  document.addEventListener("pointerdown", () => { porTeclado = false; }, true);
  document.addEventListener("mousedown", (ev) => {
    if (ev.target instanceof Element && ev.target.closest(".grafico")) ev.preventDefault();
  });
  const focoTeclado = () => porTeclado;

  const graficos = {};
  function registrar(nome, box, desenhar) {
    const g = { box, desenhar, w: 0 };
    graficos[nome] = g;
    new ResizeObserver(() => {
      const w = Math.floor(box.clientWidth);
      if (w > 0 && w !== g.w) { g.w = w; desenhar(w); }
    }).observe(box);
  }
  function redesenhar(...nomes) {
    for (const n of nomes) {
      const g = graficos[n], w = Math.floor(g.box.clientWidth);
      if (w > 0) { g.w = w; g.desenhar(w); }
    }
  }

  const estado = {
    ini: ANO_MIN, fim: ANO_MAX,
    paineis: ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_12m_trim"],
    x: "ipca_12m_trim", y: "rend_var_ano_pct", fase: "todas",
  };
  const filtradas = () => LINHAS.filter((r) => r.ano >= estado.ini && r.ano <= estado.fim);
  const filtradasMes = () => MENSAL.filter((r) => r.ano >= estado.ini && r.ano <= estado.fim);

  const ULT = LINHAS[LINHAS.length - 1], ANT = LINHAS[LINHAS.length - 5];
  $("#base-periodo").textContent = `${LINHAS[0].trimestre} a ${ULT.trimestre}`;
  $("#base-n").textContent = LINHAS.length;
  $("#tri-atual").textContent = ULT.trimestre;
  $("#tri-anterior").textContent = ANT.trimestre;
  $("#sem-tri").textContent = ULT.trimestre;

  const KPIS = [
    { col: "desocupacao", rot: "Desocupação", val: num(ULT.desocupacao, 1) + "%", d: ULT.desocup_var_pp_ano, df: (v) => num(v, 1, true) + " p.p.", melhoraSeCai: true },
    { col: "rendimento_real", rot: "Rendimento médio real", val: "R$ " + num(ULT.rendimento_real, 0), d: ULT.rend_var_ano_pct, df: (v) => num(v, 1, true) + "%", melhoraSeCai: false },
    { col: "endividamento_familias", rot: "Endividamento / renda", val: num(ULT.endividamento_familias, 1) + "%", d: ULT.endiv_var_pp_ano, df: (v) => num(v, 2, true) + " p.p.", melhoraSeCai: true },
    { col: "ipca_12m_trim", rot: "Inflação (IPCA 12 meses)", val: num(ULT.ipca_12m_trim, 2) + "%", d: ULT.ipca_12m_var_pp_ano, df: (v) => num(v, 2, true) + " p.p.", melhoraSeCai: true },
  ];
  const kpiBox = $("#kpis");
  for (const k of KPIS) {
    const card = document.createElement("div");
    card.className = "kpi";
    const rot = document.createElement("p"); rot.className = "kpi-rot"; rot.textContent = k.rot;
    const val = document.createElement("p"); val.className = "kpi-val"; val.textContent = k.val;
    card.append(rot, val);
    if (k.d != null) {
      const melhorou = k.melhoraSeCai ? k.d < 0 : k.d > 0;
      const d = document.createElement("p");
      d.className = "delta " + (k.d === 0 ? "" : melhorou ? "bom" : "ruim");
      const seta = document.createElement("span"); seta.setAttribute("aria-hidden", "true"); seta.textContent = k.d > 0 ? "▲" : k.d < 0 ? "▼" : "●";
      const v = document.createElement("span"); v.textContent = k.df(k.d);
      const ref = document.createElement("span"); ref.className = "ref"; ref.textContent = `vs. ${ANT.trimestre}` + (k.d === 0 ? "" : melhorou ? " · melhora" : " · piora");
      d.append(seta, v, ref);
      card.appendChild(d);
    }
    const sp = document.createElement("div"); sp.className = "spark";
    card.appendChild(sp);
    kpiBox.appendChild(card);
    registrar("spark-" + k.col, sp, (w) => desenharSpark(sp, w, k.col, k.rot));
  }
  function desenharSpark(box, w, col, rot) {
    const h = 34, ps = LINHAS.filter((r) => r[col] != null);
    const vals = ps.map((r) => r[col]), lo = Math.min(...vals), hi = Math.max(...vals);
    const X = lin(T_MIN, T_MAX, 2, w - 5), Y = lin(lo, hi, h - 4, 4);
    const svg = novoSvg(box, w, h, `${rot}: evolução de ${ps[0].trimestre} a ${ps[ps.length - 1].trimestre}`);
    s("path", { d: ps.map((r, i) => `${i ? "L" : "M"}${X(tempo(r)).toFixed(1)},${Y(r[col]).toFixed(1)}`).join(""), class: "g-linha", style: "stroke: var(--ink-2); stroke-width: 1.5" }, svg);
    const u = ps[ps.length - 1];
    s("circle", { cx: X(tempo(u)), cy: Y(u[col]), r: 3, class: "g-fim" }, svg);
  }

  const selIni = $("#ano-ini"), selFim = $("#ano-fim");
  for (let a = ANO_MIN; a <= ANO_MAX; a++) {
    selIni.add(new Option(a, a));
    selFim.add(new Option(a, a));
  }
  function aplicarPeriodo(ini, fim) {
    estado.ini = Math.min(ini, fim);
    estado.fim = Math.max(ini, fim);
    selIni.value = estado.ini;
    selFim.value = estado.fim;
    for (const b of document.querySelectorAll("#atalhos button")) {
      b.setAttribute("aria-pressed", String(+b.dataset.ini === estado.ini && +b.dataset.fim === estado.fim));
    }
    redesenhar("series", "dispersao", "matriz");
    montarTabela();
  }
  selIni.addEventListener("change", () => aplicarPeriodo(+selIni.value, +selFim.value));
  selFim.addEventListener("change", () => aplicarPeriodo(+selIni.value, +selFim.value));
  for (const b of document.querySelectorAll("#atalhos button")) {
    b.addEventListener("click", () => aplicarPeriodo(+b.dataset.ini, +b.dataset.fim));
  }

  const toggles = $("#toggles");
  for (const col of ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_12m_trim"]) {
    const lab = document.createElement("label");
    const cb = document.createElement("input");
    cb.type = "checkbox"; cb.id = "mostrar-" + col; cb.checked = true; cb.value = col;
    cb.addEventListener("change", () => {
      estado.paineis = [...toggles.querySelectorAll("input:checked")].map((i) => i.value);
      redesenhar("series");
    });
    lab.append(cb, document.createTextNode(VAR[col].curto));
    toggles.appendChild(lab);
  }

  const FAIXAS = [
    { de: 2014.25, ate: 2017, cls: "g-faixa-rec", rot: "Recessão" },
    { de: 2020, ate: 2022, cls: "g-faixa-pan", rot: "Pandemia" },
  ];
  registrar("series", $("#g-series"), function (w) {
    const box = $("#g-series"), rows = filtradas(), cols = estado.paineis;
    const leitura = $("#leitura-series");
    if (!cols.length) { leitura.textContent = ""; return vazio(box, "Marque ao menos um indicador acima."); }
    function mostrarLeitura(r, ehUltimo) {
      leitura.textContent = "";
      const quando = document.createElement("span");
      quando.className = "quando";
      quando.textContent = `${r.trimestre} · ${faseCurta(r.periodo)}${ehUltimo ? " (último trimestre do período)" : ""}`;
      leitura.appendChild(quando);
      for (const col of cols) {
        const item = document.createElement("span");
        const v = document.createElement("strong");
        v.textContent = fv(col, r[col]);
        item.append(v, document.createTextNode(" " + VAR[col].rotulo));
        leitura.appendChild(item);
      }
    }
    mostrarLeitura(rows[rows.length - 1], true);
    const estreito = w < 560;
    const m = { l: estreito ? 46 : 56, r: 14, t: 46, b: 28 }, hP = estreito ? 112 : 138, gap = 42;
    const H = m.t + cols.length * hP + (cols.length - 1) * gap + m.b;
    const svg = novoSvg(box, w, H, "Séries trimestrais de " + cols.map((c) => VAR[c].rotulo).join(", ") + `, ${rows[0].trimestre} a ${rows[rows.length - 1].trimestre}`);
    const t0 = tempo(rows[0]), t1 = tempo(rows[rows.length - 1]);
    const X = lin(t0, t1 > t0 ? t1 : t0 + 0.25, m.l, w - m.r);
    const escalas = [];

    cols.forEach((col, i) => {
      const y0 = m.t + i * (hP + gap), y1 = y0 + hP;
      const vals = rows.map((r) => r[col]).filter((v) => v != null);
      for (const f of FAIXAS) {
        const a = Math.max(X(f.de), m.l), b = Math.min(X(f.ate), w - m.r);
        if (b - a > 1) {
          s("rect", { x: a, y: y0, width: b - a, height: hP, class: f.cls }, svg);
          if (i === 0 && b - a > 54) texto(svg, (a + b) / 2, y0 - 5, f.rot, { class: "g-faixa-rot", "text-anchor": "middle" });
        }
      }
      const u = [...rows].reverse().find((r) => r[col] != null);
      const unid = estreito && VAR[col].unid === "% da renda" ? "%" : VAR[col].unid;
      const tit = texto(svg, m.l, i === 0 ? y0 - 24 : y0 - 10, `${VAR[col].rotulo} (${unid})`, { class: "g-titulo" });
      if (u) { const v = s("tspan", { class: "v", dx: 8 }, tit); v.textContent = `${fv(col, u[col])} em ${u.trimestre}`; }
      if (!vals.length) { texto(svg, (m.l + w - m.r) / 2, y0 + hP / 2, "sem dados no período", { class: "g-tick", "text-anchor": "middle" }); escalas.push(null); return; }
      const [lo, hi] = dominio(Math.min(...vals), Math.max(...vals), 3);
      const Y = lin(lo, hi, y1, y0);
      const { ticks, passo } = passos(lo, hi, 3);
      for (const tk of ticks) {
        s("line", { x1: m.l, x2: w - m.r, y1: Y(tk), y2: Y(tk), class: "g-grade" }, svg);
        texto(svg, m.l - 8, Y(tk) + 4, col === "rendimento_real" ? num(tk, 0) : num(tk, casas(passo)), { class: "g-tick", "text-anchor": "end" });
      }
      let d = "", aberto = false;
      for (const r of rows) {
        if (r[col] == null) { aberto = false; continue; }
        d += `${aberto ? "L" : "M"}${X(tempo(r)).toFixed(1)},${Y(r[col]).toFixed(1)}`;
        aberto = true;
      }
      s("path", { d, class: "g-linha" }, svg);
      if (u) s("circle", { cx: X(tempo(u)), cy: Y(u[col]), r: 3.5, class: "g-fim" }, svg);
      escalas.push(Y);
    });

    const anos = [];
    const salto = (t1 - t0) > 9 ? 2 : 1;
    for (let a = Math.ceil(t0); a <= t1; a++) if ((a - ANO_MIN) % salto === 0 || salto === 1) anos.push(a);
    for (const a of anos) texto(svg, X(a), H - 8, String(a), { class: "g-tick", "text-anchor": "middle" });
    if (!anos.length) texto(svg, X(t0), H - 8, rows[0].trimestre, { class: "g-tick", "text-anchor": "middle" });

    const mira = s("g", { visibility: "hidden" }, svg);
    const linhaMira = s("line", { y1: m.t - 4, y2: H - m.b, class: "g-mira" }, mira);
    const pontos = cols.map(() => s("circle", { r: 4.5, class: "g-mira-ponto" }, mira));
    const alvo = s("rect", { x: m.l, y: m.t - 20, width: w - m.l - m.r, height: H - m.t - m.b + 20, class: "g-alvo" }, svg);
    let atual = rows.length - 1;
    function marcar(i, cx, cy) {
      atual = i;
      const r = rows[i], x = X(tempo(r));
      mira.setAttribute("visibility", "visible");
      linhaMira.setAttribute("x1", x); linhaMira.setAttribute("x2", x);
      cols.forEach((col, k) => {
        const Y = escalas[k];
        if (Y && r[col] != null) { pontos[k].setAttribute("cx", x); pontos[k].setAttribute("cy", Y(r[col])); pontos[k].setAttribute("visibility", "visible"); }
        else pontos[k].setAttribute("visibility", "hidden");
      });
      mostrarLeitura(r, i === rows.length - 1);
    }
    limpezas.series = () => { mira.setAttribute("visibility", "hidden"); mostrarLeitura(rows[rows.length - 1], true); };
    const limpar = semDica;
    const mover = (ev) => {
      const [px] = ponteiro(svg, ev), tt = X.inv(px);
      let best = 0;
      rows.forEach((r, i) => { if (Math.abs(tempo(r) - tt) < Math.abs(tempo(rows[best]) - tt)) best = i; });
      marcar(best, ev.clientX, ev.clientY);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerdown", mover);
    alvo.addEventListener("pointerleave", limpar);
    svg.setAttribute("tabindex", "0");
    svg.addEventListener("focus", () => { if (!focoTeclado(svg)) return; const [cx, cy] = centro(svg); marcar(atual, cx, cy - 60); });
    svg.addEventListener("blur", limpar);
    svg.addEventListener("keydown", (ev) => {
      if (ev.key !== "ArrowLeft" && ev.key !== "ArrowRight") return;
      ev.preventDefault();
      const i = Math.max(0, Math.min(rows.length - 1, atual + (ev.key === "ArrowRight" ? 1 : -1)));
      const b = svg.getBoundingClientRect();
      marcar(i, b.left + (X(tempo(rows[i])) * b.width) / w, b.top + 20);
    });
  });

  const OPCOES = Object.keys(VAR);
  const selX = $("#eixo-x"), selY = $("#eixo-y"), selFase = $("#fase");
  for (const c of OPCOES) { selX.add(new Option(rotuloEixo(c), c)); selY.add(new Option(rotuloEixo(c), c)); }
  selX.value = estado.x; selY.value = estado.y;
  const FASES = [...new Set(LINHAS.map((r) => r.periodo))].sort();
  selFase.add(new Option("Nenhuma (todas iguais)", "todas"));
  for (const f of FASES) selFase.add(new Option(f.replace(/^\d+\.\s*/, ""), f));
  selX.addEventListener("change", () => { estado.x = selX.value; redesenhar("dispersao"); });
  selY.addEventListener("change", () => { estado.y = selY.value; redesenhar("dispersao"); });
  selFase.addEventListener("change", () => { estado.fase = selFase.value; redesenhar("dispersao"); });

  registrar("dispersao", $("#g-dispersao"), function (w) {
    const box = $("#g-dispersao"), rows = filtradasMes(), xc = estado.x, yc = estado.y, nota = $("#nota-dispersao");
    $("#leg-ini").textContent = rotMes(MENSAL[0]);
    $("#leg-fim").textContent = rotMes(MENSAL[MENSAL.length - 1]);
    nota.textContent = "";
    if (xc === yc) return vazio(box, "Escolha indicadores diferentes nos dois eixos.");
    const ps = pares(rows, xc, yc);
    if (ps.length < 3) return vazio(box, "Poucos meses com dados no período. Amplie o filtro de anos.");
    const estreito = w < 560;
    const m = { l: estreito ? 50 : 62, r: 16, t: 12, b: 50 };
    const H = Math.round(Math.min(460, Math.max(300, w * 0.52)));
    const svg = novoSvg(box, w, H, `Dispersão: ${VAR[xc].rotulo} no eixo X e ${VAR[yc].rotulo} no eixo Y`);
    const xs = ps.map((p) => p[0]), ys = ps.map((p) => p[1]);
    const [x0, x1] = dominio(Math.min(...xs), Math.max(...xs), estreito ? 4 : 6);
    const [y0, y1] = dominio(Math.min(...ys), Math.max(...ys), 5);
    const X = lin(x0, x1, m.l, w - m.r), Y = lin(y0, y1, H - m.b, m.t);
    const tx = passos(x0, x1, estreito ? 4 : 6), ty = passos(y0, y1, 5);
    for (const v of ty.ticks) {
      s("line", { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), class: v === 0 ? "g-zero" : "g-grade" }, svg);
      texto(svg, m.l - 8, Y(v) + 4, num(v, yc === "rendimento_real" ? 0 : casas(ty.passo)), { class: "g-tick", "text-anchor": "end" });
    }
    for (const v of tx.ticks) {
      s("line", { x1: X(v), x2: X(v), y1: m.t, y2: H - m.b, class: v === 0 ? "g-zero" : "g-grade" }, svg);
      texto(svg, X(v), H - m.b + 17, num(v, xc === "rendimento_real" ? 0 : casas(tx.passo)), { class: "g-tick", "text-anchor": "middle" });
    }
    texto(svg, (m.l + w - m.r) / 2, H - 6, rotuloEixo(xc), { class: "g-eixo-tit", "text-anchor": "middle" });
    texto(svg, 0, 0, rotuloEixo(yc), { class: "g-eixo-tit", "text-anchor": "middle", transform: `translate(12 ${(m.t + H - m.b) / 2}) rotate(-90)` });

    const clipId = "corte-disp";
    const cp = s("clipPath", { id: clipId }, s("defs", null, svg));
    s("rect", { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b }, cp);
    const { a, b } = ols(ps);
    s("line", { x1: X(x0), y1: Y(a + b * x0), x2: X(x1), y2: Y(a + b * x1), class: "g-tend", "clip-path": `url(#${clipId})` }, svg);

    const destaque = estado.fase !== "todas";
    const ordem = [...ps].sort((p, q) => (destaque ? (p[2].periodo === estado.fase) - (q[2].periodo === estado.fase) : 0) || tempoMes(p[2]) - tempoMes(q[2]));
    for (const [x, y, r] of ordem) {
      const f = ((tempoMes(r) - TM_MIN) / (TM_MAX - TM_MIN)) * 100;
      const cls = "g-ponto" + (destaque ? (r.periodo === estado.fase ? " destaque" : " apagado") : "");
      s("circle", { cx: X(x).toFixed(1), cy: Y(y).toFixed(1), r: 5.5, class: cls, style: `fill: color-mix(in oklab, var(--seq-hi) ${f.toFixed(0)}%, var(--seq-lo))` }, svg);
    }

    const anel = s("circle", { r: 8.5, class: "g-anel", visibility: "hidden" }, svg);
    limpezas.dispersao = () => anel.setAttribute("visibility", "hidden");
    const alvo = s("rect", { x: m.l, y: m.t, width: w - m.l - m.r, height: H - m.t - m.b, class: "g-alvo" }, svg);
    function mostrar(p, cx, cy) {
      const [x, y, r] = p;
      anel.setAttribute("cx", X(x)); anel.setAttribute("cy", Y(y)); anel.setAttribute("visibility", "visible");
      dica(`${rotMes(r)} (${r.trimestre}) · ${faseCurta(r.periodo)}`, [{ valor: fv(yc, y), rotulo: VAR[yc].rotulo }, { valor: fv(xc, x), rotulo: VAR[xc].rotulo }], cx, cy);
    }
    const mover = (ev) => {
      const [px, py] = ponteiro(svg, ev);
      let best = null, dist = 28 * 28;
      for (const p of ps) {
        const d = (X(p[0]) - px) ** 2 + (Y(p[1]) - py) ** 2;
        if (d < dist) { dist = d; best = p; }
      }
      if (best) mostrar(best, ev.clientX, ev.clientY);
      else { anel.setAttribute("visibility", "hidden"); semDica(); }
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerdown", mover);
    alvo.addEventListener("pointerleave", () => { anel.setAttribute("visibility", "hidden"); semDica(); });

    const r = pearson(ps);
    const forte = document.createElement("strong");
    forte.textContent = `r = ${num(r, 2)}`;
    nota.append(forte, document.createTextNode(` · ${forca(r)} em ${ps.length} meses (${rotMes(ps[0][2])} a ${rotMes(ps[ps.length - 1][2])}). A linha tracejada é a tendência linear. Correlação não indica causalidade.`));
  });

  const MATRIZ = ["desocupacao", "rendimento_real", "endividamento_familias", "ipca_12m_trim", "rend_var_ano_pct", "desocup_var_pp_ano", "endiv_var_pp_ano"];
  registrar("matriz", $("#g-matriz"), function (w) {
    const box = $("#g-matriz"), rows = filtradasMes();
    const n = MATRIZ.length - 1;
    const estreito = w < 560;
    const mL = estreito ? 104 : 136, mB = estreito ? 92 : 100;
    const cel = Math.max(30, Math.min(84, Math.floor((w - mL - 8) / n)));
    const W = mL + cel * n + 8, H = cel * n + mB;
    const svg = novoSvg(box, W, H, "Matriz de correlação entre os indicadores no período selecionado");
    const celulas = [];
    limpezas.matriz = () => celulas.forEach((c) => c.classList.remove("ativo"));
    for (let i = 1; i <= n; i++) {
      const lin_ = MATRIZ[i], y = (i - 1) * cel;
      texto(svg, mL - 10, y + cel / 2 + 4, VAR[lin_].curto, { class: "g-tick", "text-anchor": "end", style: "fill: var(--ink-2)" });
      for (let j = 0; j < i; j++) {
        const col = MATRIZ[j], x = mL + j * cel;
        const ps = pares(rows, lin_, col), r = pearson(ps);
        const ok = isFinite(r);
        const p = ok ? Math.round(Math.abs(r) * 100) : 0;
        const g = s("g", { tabindex: "0", role: "img", "aria-label": `${VAR[lin_].rotulo} e ${VAR[col].rotulo}: r = ${ok ? num(r, 2) : "sem dados"}` }, svg);
        const rect = s("rect", { x: x + 1, y: y + 1, width: cel - 2, height: cel - 2, rx: 3, class: "g-cel",
          style: `fill: color-mix(in oklab, ${r < 0 ? "var(--div-neg)" : "var(--div-pos)"} ${p}%, var(--div-mid))` }, g);
        texto(g, x + cel / 2, y + cel / 2, ok ? num(r, 2) : "–", { class: "g-cel-txt", style: cel < 40 ? "font-size: 10.5px" : null });
        const info = () => [`${VAR[lin_].curto} × ${VAR[col].curto}`, [{ valor: ok ? `r = ${num(r, 2)}` : "sem dados", rotulo: ok ? `${forca(r)} · ${ps.length} meses` : "" }]];
        const on = (cx, cy) => { celulas.forEach((c) => c.classList.remove("ativo")); rect.classList.add("ativo"); const [t, it] = info(); dica(t, it, cx, cy); };
        const off = () => { rect.classList.remove("ativo"); semDica(); };
        g.addEventListener("pointermove", (ev) => on(ev.clientX, ev.clientY));
        g.addEventListener("pointerdown", (ev) => on(ev.clientX, ev.clientY));
        g.addEventListener("pointerleave", off);
        g.addEventListener("focus", () => { if (focoTeclado(g)) { const [cx, cy] = centro(rect); on(cx, cy); } });
        g.addEventListener("blur", off);
        celulas.push(rect);
      }
    }
    for (let j = 0; j < n; j++) {
      const x = mL + j * cel + cel / 2, y = n * cel + 10;
      texto(svg, 0, 0, VAR[MATRIZ[j]].curto, { class: "g-tick", "text-anchor": "end", style: "fill: var(--ink-2)", transform: `translate(${x + 4} ${y}) rotate(-40)` });
    }
  });

  const COLS_TAB = [
    ["trimestre", "Trimestre"], ["periodo", "Fase"], ["desocupacao", "Desocupação (%)"], ["rendimento_real", "Rendimento (R$)"],
    ["endividamento_familias", "Endividamento (%)"], ["ipca_12m_trim", "IPCA 12m (%)"], ["rend_var_ano_pct", "Var. anual da renda (%)"],
  ];
  function montarTabela() {
    const tab = $("#tabela");
    tab.textContent = "";
    const th = tab.createTHead().insertRow();
    for (const [c, rot] of COLS_TAB) {
      const e = document.createElement("th");
      e.textContent = rot;
      if (c !== "trimestre" && c !== "periodo") e.className = "num";
      th.appendChild(e);
    }
    const tb = tab.createTBody();
    for (const r of filtradas()) {
      const tr = tb.insertRow();
      for (const [c] of COLS_TAB) {
        const td = tr.insertCell();
        if (c === "trimestre") td.textContent = r.trimestre;
        else if (c === "periodo") td.textContent = faseCurta(r.periodo);
        else { td.className = "num"; td.textContent = r[c] == null ? "–" : c === "rendimento_real" ? num(r[c], 0) : num(r[c], c === "ipca_12m_trim" ? 2 : 1); }
      }
    }
  }
  const botaoBaixar = $("#baixar");
  if (MODO_ARTIFACT) botaoBaixar.hidden = true;
  botaoBaixar.addEventListener("click", () => {
    const cols = ["trimestre", "periodo", "desocupacao", "rendimento_real", "endividamento_familias", "ipca_trimestre", "ipca_12m_trim", "rend_var_ano_pct", "desocup_var_pp_ano", "endiv_var_pp_ano"];
    const linhas = [cols.join(";")].concat(filtradas().map((r) => cols.map((c) => (r[c] == null ? "" : typeof r[c] === "number" ? String(r[c]).replace(".", ",") : r[c])).join(";")));
    const url = URL.createObjectURL(new Blob(["﻿" + linhas.join("\r\n")], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url; a.download = `dados_${estado.ini}_${estado.fim}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  });

  const JANELAS = [
    { nome: "2013–2019", sub: "pré-pandemia", de: 2013, ate: 2019 },
    { nome: "2020–2021", sub: "pandemia", de: 2020, ate: 2021 },
    { nome: "2022–2026", sub: "pós-pandemia", de: 2022, ate: 2026 },
    { nome: "2013–2026", sub: "todo o período", de: 2013, ate: 2026 },
  ];
  const VARS_FASE = [
    { col: "ipca_12m_trim", rot: "IPCA 12 meses", cor: "var(--s1)" },
    { col: "desocup_var_pp_ano", rot: "Δ desocupação (12 meses)", cor: "var(--s2)" },
    { col: "endiv_var_pp_ano", rot: "Δ endividamento (12 meses)", cor: "var(--s3)" },
  ];
  const RES_FASE = JANELAS.map((j) => {
    const rows = MENSAL.filter((r) => r.ano >= j.de && r.ano <= j.ate);
    return { ...j, vals: VARS_FASE.map((v) => { const ps = pares(rows, v.col, "rend_var_ano_pct"); return { r: pearson(ps), n: ps.length }; }) };
  });
  (function legendaBarras() {
    const leg = $("#leg-barras");
    for (const v of VARS_FASE) {
      const sp = document.createElement("span"), i = document.createElement("i");
      i.style.background = v.cor;
      sp.append(i, document.createTextNode(v.rot));
      leg.appendChild(sp);
    }
    const tab = $("#tabela-fases"), th = tab.createTHead().insertRow();
    for (const rot of ["Fase", ...VARS_FASE.map((v) => v.rot), "Meses"]) { const e = document.createElement("th"); e.textContent = rot; if (rot !== "Fase") e.className = "num"; th.appendChild(e); }
    const tb = tab.createTBody();
    for (const f of RES_FASE) {
      const tr = tb.insertRow();
      tr.insertCell().textContent = `${f.nome} (${f.sub})`;
      for (const v of f.vals) { const td = tr.insertCell(); td.className = "num"; td.textContent = num(v.r, 2); }
      const td = tr.insertCell(); td.className = "num"; td.textContent = f.vals[0].n;
    }
  })();
  registrar("barras", $("#g-barras"), function (w) {
    const box = $("#g-barras"), estreito = w < 560;
    const m = { l: 40, r: 8, t: 22, b: 52 }, H = estreito ? 320 : 380;
    const svg = novoSvg(box, w, H, "Correlação de cada variável com a variação anual do rendimento real, por fase");
    const Y = lin(-1, 1, H - m.b, m.t);
    for (const v of [-1, -0.5, 0, 0.5, 1]) {
      s("line", { x1: m.l, x2: w - m.r, y1: Y(v), y2: Y(v), class: v === 0 ? "g-zero" : "g-grade" }, svg);
      texto(svg, m.l - 8, Y(v) + 4, num(v, v % 1 ? 1 : 0), { class: "g-tick", "text-anchor": "end" });
    }
    const gw = (w - m.l - m.r) / JANELAS.length, ocup = estreito ? 0.78 : 0.62, gapB = 2;
    const bw = (gw * ocup - gapB * (VARS_FASE.length - 1)) / VARS_FASE.length;
    const barras = [];
    limpezas.barras = () => barras.forEach((b) => b.classList.remove("ativo"));
    RES_FASE.forEach((f, gi) => {
      const gx = m.l + gi * gw + (gw * (1 - ocup)) / 2;
      const nome = !estreito ? f.nome : f.sub === "todo o período" ? "Tudo" : f.nome.replace(/^(\d{4})–\d{2}(\d{2})$/, "$1–$2");
      texto(svg, m.l + gi * gw + gw / 2, H - m.b + 20, nome, { class: "g-grupo" });
      texto(svg, m.l + gi * gw + gw / 2, H - m.b + 36, estreito ? `${f.vals[0].n} meses` : `${f.sub} · ${f.vals[0].n} meses`, { class: "g-grupo-n" });
      f.vals.forEach((v, k) => {
        if (!isFinite(v.r)) return;
        const x = gx + k * (bw + gapB);
        const p = s("path", { d: barraPath(x, Y(0), Y(v.r), bw), class: "g-barra", style: `fill: ${VARS_FASE[k].cor}`, tabindex: "0", role: "img", "aria-label": `${f.nome}, ${VARS_FASE[k].rot}: r = ${num(v.r, 2)}` }, svg);
        if (!estreito) texto(svg, x + bw / 2, v.r >= 0 ? Y(v.r) - 6 : Y(v.r) + 15, num(v.r, 2), { class: "g-rot-barra" });
        const on = (cx, cy) => { barras.forEach((b) => b.classList.remove("ativo")); p.classList.add("ativo"); dica(`${f.nome} · ${f.sub}`, [{ valor: `r = ${num(v.r, 2)}`, rotulo: VARS_FASE[k].rot, cor: VARS_FASE[k].cor }, { valor: `${v.n} meses`, rotulo: "" }], cx, cy); };
        const off = () => { p.classList.remove("ativo"); semDica(); };
        p.addEventListener("pointermove", (ev) => on(ev.clientX, ev.clientY));
        p.addEventListener("pointerdown", (ev) => on(ev.clientX, ev.clientY));
        p.addEventListener("pointerleave", off);
        p.addEventListener("focus", () => { if (focoTeclado(p)) { const [cx, cy] = centro(p); on(cx, cy); } });
        p.addEventListener("blur", off);
        barras.push(p);
      });
    });
  });

  const ST = {
    verde: { rot: "Verde", cls: "st-verde", ico: "✓", c: "c-verde", sig: "favorável" },
    amarelo: { rot: "Amarelo", cls: "st-amarelo", ico: "!", c: "c-amarelo", sig: "atenção" },
    vermelho: { rot: "Vermelho", cls: "st-vermelho", ico: "✕", c: "c-vermelho", sig: "alerta" },
  };
  const REGRAS = [
    { col: "ipca_12m_trim", nome: "Inflação", curto: "Inflação (IPCA 12m)", sub: "IPCA acumulado em 12 meses", am: 5, vm: 8, f: (v) => num(v, 2) + "%", faixas: ["abaixo de 5%", "de 5% a 8%", "8% ou mais"] },
    { col: "desocup_var_pp_ano", nome: "Desemprego", curto: "Desemprego (12m)", sub: "variação da taxa em 12 meses", am: 0, vm: 1, f: (v) => num(v, 1, true) + " p.p.", faixas: ["queda", "alta de 0 a 1 p.p.", "alta de 1 p.p. ou mais"] },
    { col: "endiv_var_pp_ano", nome: "Endividamento", curto: "Endividamento (12m)", sub: "variação em 12 meses", am: 0, vm: 3, f: (v) => num(v, 2, true) + " p.p.", faixas: ["queda", "alta de 0 a 3 p.p.", "alta de 3 p.p. ou mais"] },
    { col: "endividamento_familias", nome: "Endividamento", curto: "Endividamento (nível)", sub: "nível, % da renda de 12 meses", am: null, vm: 48, f: (v) => num(v, 1) + "%", faixas: ["abaixo de 48%", "—", "48% ou mais"] },
  ];
  function sinal(v, am, vm) {
    if (v == null) return null;
    if (v >= vm) return "vermelho";
    if (am != null && v >= am) return "amarelo";
    return "verde";
  }
  function pilula(st) {
    const p = document.createElement("span");
    p.className = "pilula " + ST[st].cls;
    const ico = document.createElement("span"); ico.className = "ico"; ico.setAttribute("aria-hidden", "true"); ico.textContent = ST[st].ico;
    p.append(ico, document.createTextNode(`${ST[st].rot} · ${ST[st].sig}`));
    return p;
  }
  (function cartoesSemaforo() {
    const box = $("#semaforo");
    for (const g of REGRAS) {
      const v = ULT[g.col], st = sinal(v, g.am, g.vm);
      const c = document.createElement("div"); c.className = "luz " + ST[st].cls;
      const nome = document.createElement("p"); nome.className = "luz-nome"; nome.textContent = g.nome;
      const sub = document.createElement("p"); sub.className = "luz-sub"; sub.textContent = g.sub;
      const val = document.createElement("p"); val.className = "luz-val"; val.textContent = g.f(v);
      const regra = document.createElement("p"); regra.className = "luz-regra"; regra.textContent = `Vermelho com ${g.faixas[2]}`;
      c.append(nome, sub, val, pilula(st), regra);
      box.appendChild(c);
    }
    const tab = $("#tabela-regras"), th = tab.createTHead().insertRow();
    for (const [rot, st] of [["Indicador"], ["Verde", "verde"], ["Amarelo", "amarelo"], ["Vermelho", "vermelho"]]) {
      const e = document.createElement("th");
      if (st) e.appendChild(pilula(st)).lastChild.textContent = ST[st].rot; else e.textContent = rot;
      th.appendChild(e);
    }
    const tb = tab.createTBody();
    for (const g of REGRAS) {
      const tr = tb.insertRow();
      tr.insertCell().textContent = g.curto;
      for (const fx of g.faixas) tr.insertCell().textContent = fx;
    }
    const leg = $("#leg-semaforo");
    for (const st of ["verde", "amarelo", "vermelho"]) leg.appendChild(pilula(st));
    const nVerm = REGRAS.map((g) => `${g.curto}: ${LINHAS.filter((r) => sinal(r[g.col], g.am, g.vm) === "vermelho").length}`);
    $("#resumo-vermelhos").textContent = `Trimestres em vermelho na base · ${nVerm.join(" · ")}.`;
  })();

  registrar("historico", $("#g-historico"), function (w) {
    const box = $("#g-historico"), estreito = w < 700;
    const mL = estreito ? 128 : 150, mR = 6, mT = 4, rh = 24, gapR = 6, mB = 26;
    const n = LINHAS.length, cw = (w - mL - mR) / n;
    const H = mT + REGRAS.length * (rh + gapR) - gapR + mB;
    const svg = novoSvg(box, w, H, "Sinal do semáforo em cada trimestre, para os quatro indicadores");
    const grade = REGRAS.map((g) => LINHAS.map((r) => sinal(r[g.col], g.am, g.vm)));
    REGRAS.forEach((g, i) => {
      const y = mT + i * (rh + gapR);
      texto(svg, mL - 10, y + rh / 2 + 4, g.curto, { class: "g-tick", "text-anchor": "end", style: "fill: var(--ink-2)" });
      grade[i].forEach((st, j) => {
        const x = mL + j * cw;
        s("rect", { x: x + 0.5, y, width: Math.max(1, cw - 1), height: rh, rx: 1.5, class: st ? ST[st].c : "c-nulo" }, svg);
      });
    });
    for (let a = ANO_MIN; a <= ANO_MAX; a += 2) {
      const j = LINHAS.findIndex((r) => r.ano === a && r.tri === 1);
      if (j >= 0) texto(svg, mL + j * cw + cw / 2, H - 8, String(a), { class: "g-tick", "text-anchor": "middle" });
    }
    const anel = s("rect", { width: cw + 2, height: rh + 2, rx: 3, class: "g-hist-ativo", visibility: "hidden" }, svg);
    limpezas.historico = () => anel.setAttribute("visibility", "hidden");
    const alvo = s("rect", { x: mL, y: mT, width: w - mL - mR, height: REGRAS.length * (rh + gapR), class: "g-alvo" }, svg);
    const mover = (ev) => {
      const [px, py] = ponteiro(svg, ev);
      const j = Math.floor((px - mL) / cw), i = Math.floor((py - mT) / (rh + gapR));
      if (j < 0 || j >= n || i < 0 || i >= REGRAS.length) return;
      const g = REGRAS[i], r = LINHAS[j], st = grade[i][j];
      anel.setAttribute("x", mL + j * cw - 0.5); anel.setAttribute("y", mT + i * (rh + gapR) - 1); anel.setAttribute("visibility", "visible");
      dica(`${r.trimestre} · ${g.curto}`, [{ valor: st ? ST[st].rot : "sem dado", rotulo: st ? g.f(r[g.col]) : "precisa de 4 trimestres anteriores" }], ev.clientX, ev.clientY);
    };
    alvo.addEventListener("pointermove", mover);
    alvo.addEventListener("pointerdown", mover);
    alvo.addEventListener("pointerleave", () => { anel.setAttribute("visibility", "hidden"); semDica(); });
  });

  const ABAS = ["series", "correlacao", "semaforo"];
  function abrir(nome, foco) {
    if (!ABAS.includes(nome)) nome = "series";
    for (const a of ABAS) {
      const bt = $("#aba-" + a), pn = $("#painel-" + a), sel = a === nome;
      bt.setAttribute("aria-selected", String(sel));
      bt.tabIndex = sel ? 0 : -1;
      pn.hidden = !sel;
    }
    semDica();
    if (foco) $("#aba-" + nome).focus();
  }
  for (const a of ABAS) {
    $("#aba-" + a).addEventListener("click", () => { if (location.hash !== "#" + a) location.hash = a; else abrir(a); });
    $("#aba-" + a).addEventListener("keydown", (ev) => {
      const i = ABAS.indexOf(a);
      const prox = ev.key === "ArrowRight" ? ABAS[(i + 1) % 3] : ev.key === "ArrowLeft" ? ABAS[(i + 2) % 3] : null;
      if (prox) { ev.preventDefault(); location.hash = prox; abrir(prox, true); }
    });
  }
  window.addEventListener("hashchange", () => { const h = location.hash.slice(1); if (ABAS.includes(h)) abrir(h); });
  abrir(location.hash.slice(1));
  aplicarPeriodo(ANO_MIN, ANO_MAX);
})();
