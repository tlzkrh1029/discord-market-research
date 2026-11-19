// 공포 검색 시안 다섯 개 — 데이터는 fear.json 하나 (구글 트렌드 + 비트스탬프 BTC)
export const RK = ['ww', 'us', 'kr'];
export const RC = { ww: 'var(--ww)', us: 'var(--us)', kr: 'var(--kr)' };
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const NAMES = ['연도별 막대', '가격과 공포 위아래', '바닥에 맞춰 겹치기', '달력 열지도', '키워드와 신뢰도'];
export const n1 = v => v == null ? '–' : (Math.round(v * 10) / 10).toLocaleString('ko-KR');
export const n0 = v => v == null ? '–' : Math.round(v).toLocaleString('ko-KR');
export const usd = v => v == null ? '–' : '$' + (v >= 1000 ? Math.round(v).toLocaleString('en-US') : v >= 10 ? v.toFixed(1) : v.toFixed(2));
export const pc = v => v == null ? '–' : (v > 0 ? '+' : '') + Math.round(v) + '%';
export const ymk = m => m.slice(2, 4) + '/' + +m.slice(5, 7);
export const ymf = m => m.slice(0, 4) + '년 ' + +m.slice(5, 7) + '월';

export async function load() { const r = await fetch('fear.json?v=1119a'); return r.json(); }
export function head(n, title, q) {
  return `<header class="lh"><div class="wrap"><a class="back" href="./">← 시안 목록</a><nav class="sw" aria-label="시안">${NAMES.map((x, i) => `<a href="./${i + 1}.html" ${i + 1 === n ? 'aria-current="page"' : ''}>${i + 1}. ${x}</a>`).join('')}</nav><button class="btn" id="theme" type="button" aria-label="밝게/어둡게">◐</button></div></header>
  <div class="wrap"><div class="lt"><span class="no">공포 검색 시안 ${n}</span><h1>${esc(title)}</h1><p class="q">${esc(q)}</p></div></div>`;
}
export function foot(D) {
  return `<footer class="lf wrap">조회 ${esc(D.meta.fetched)} · ${esc(D.meta.source)} · ${esc(D.meta.partial)} · 구글 트렌드는 검색 횟수가 아니라 0~100 상대 지수입니다 · 투자 조언이 아닙니다.</footer>`;
}
export function theme() {
  const b = document.getElementById('theme'); if (!b) return;
  try { const t = localStorage.getItem('mm-theme'); if (t) document.documentElement.dataset.theme = t; } catch { }
  b.onclick = () => {
    const dark = document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.dataset.theme = dark ? 'light' : 'dark';
    try { localStorage.setItem('mm-theme', document.documentElement.dataset.theme); } catch { }
    dispatchEvent(new Event('resize'));
  };
}
// 말풍선
let TT;
export function tip(html, ev) {
  if (!TT) { TT = document.createElement('div'); TT.className = 'ltip'; document.body.appendChild(TT); }
  TT.innerHTML = html; TT.style.display = 'block';
  const x = (ev.touches ? ev.touches[0].pageX : ev.pageX), y = (ev.touches ? ev.touches[0].pageY : ev.pageY);
  const w = TT.offsetWidth, vw = document.documentElement.clientWidth;
  TT.style.left = Math.max(8, Math.min(vw - w - 8, x + 14)) + 'px'; TT.style.top = (y + 16) + 'px';
}
export function untip() { if (TT) TT.style.display = 'none'; }
// 버튼 묶음
export function seg(name, opts, val) {
  return `<span class="seg" data-seg="${name}">${opts.map(([k, t]) => `<button class="btn" type="button" data-v="${k}" aria-pressed="${k === val}">${esc(t)}</button>`).join('')}</span>`;
}
export function onseg(root, name, fn) {
  const s = root.querySelector(`[data-seg="${name}"]`);
  s.addEventListener('click', e => { const b = e.target.closest('button'); if (!b) return; s.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); fn(b.dataset.v); });
}
export function legend(items, toggle) {
  return `<div class="leg">${items.map(it => toggle ? `<button type="button" data-k="${it.k}" aria-pressed="${it.on !== false}"><i class="${it.sq ? 'sq' : ''}" style="background:${it.c}"></i>${esc(it.t)}</button>` : `<span><i class="${it.sq ? 'sq' : ''}" style="background:${it.c}"></i>${esc(it.t)}</span>`).join('')}</div>`;
}
export function redraw(fn) { let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); }); fn(); }
export function nice(v) { if (v <= 0) return 1; const p = Math.pow(10, Math.floor(Math.log10(v))); const f = v / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
const path = pts => { let d = '', pen = false; for (const p of pts) { if (!p) { pen = false; continue; } d += (pen ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1); pen = true; } return d; };
const yrs = D => [...new Set(D.months.map(m => m.slice(0, 4)))];
const midx = (D) => Object.fromEntries(D.months.map((m, i) => [m, i]));
const pxClose = (D, m) => D.px[m] ? D.px[m][3] : null;
function fwd(D, m, k) {
  const i = D.months.indexOf(m), j = i + k; if (j >= D.months.length) return null;
  const a = pxClose(D, m), b = pxClose(D, D.months[j]); if (!a || !b) return null; return 100 * (b / a - 1);
}
function athDraw(D) { let mx = 0; const o = {}; for (const m of Object.keys(D.px).sort()) { mx = Math.max(mx, D.px[m][1]); o[m] = 100 * (D.px[m][3] / mx - 1); } return o; }

/* ───────── 시안 1: 연도별 막대 ───────── */
export function p1(D, root) {
  const Y = yrs(D);
  const top2 = r => D.regions[r].years.filter(y => y.rr != null).sort((a, b) => b.rr - a.rr).slice(0, 2);
  const sumTxt = RK.map(r => { const t = top2(r); return `<b>${D.regions[r].name}</b> ${t[0].y}년(${n1(t[0].rr)})·${t[1].y}년(${n1(t[1].rr)})`; }).join(' / ');
  root.innerHTML = `<div class="fx wrap">
  <p class="sum">'bitcoin' 검색 가운데 공포 검색이 차지한 몫(가장 높은 해 = 100)을 해마다 비교했습니다. 몫이 가장 컸던 두 해는 ${sumTxt}입니다. 2009~2012년은 검색이 너무 적어 몫을 계산하지 않았습니다.</p>
  <div class="ctl"><span class="lab">지표</span>${seg('m', [['rr', '공포 비율(÷비트코인)'], ['fear', '공포 지수'], ['btc', '비트코인 지수']], 'rr')}</div>
  ${legend([{ c: 'var(--ww)', t: '전 세계', sq: 1 }, { c: 'var(--us)', t: '미국', sq: 1 }, { c: 'var(--kr)', t: '한국(한국어 키워드)', sq: 1 }, { c: 'var(--surface-2)', t: '자료 부족', sq: 1 }])}
  <div class="grid3" id="g"></div>
  <div class="box"><h3>표로 보기 <span class="sub">비율 = 공포 묶음 ÷ 비트코인 검색, 지역별 가장 높은 해 = 100 · 최고 달은 공포 지수 기준</span></h3><div class="tw" id="t"></div></div>
  <ul class="note"><li>공포 지수는 지역마다 2009/01~2026/11 전체를 한 번에 조회해 가장 높은 달을 100으로 둔 값의 연평균입니다(GPT 방식과 같음). 해마다 따로 조회하지 않아 연도끼리 같은 잣대입니다.</li><li>2026년은 11/19까지라 11개월 평균입니다(옅은 막대).</li><li>구글은 2022년 1월 수집 방식을 바꿨고, 그 뒤 값이 높게 나오는 경향이 보고됐습니다. 2022년 앞뒤의 높낮이는 조심해서 보셔야 합니다.</li><li>한국은 '비트코인 폭락' 등 한국어 다섯 개를 '비트코인' 검색으로 나눴습니다. 영어 묶음을 한국에서 본 값은 시안 5에 있습니다.</li></ul></div>`;
  let metric = 'rr';
  const g = root.querySelector('#g');
  function draw() {
    g.innerHTML = RK.map(r => `<div class="box"><h3><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${RC[r]}"></i>${esc(D.regions[r].name)}</h3><div data-r="${r}"></div></div>`).join('');
    RK.forEach(r => {
      const el = g.querySelector(`[data-r="${r}"]`), W = Math.max(260, el.clientWidth), H = 190, L = 30, R = 6, T = 16, B = 22;
      const ys = D.regions[r].years, vals = ys.map(y => y[metric]);
      const ymax = metric === 'rr' ? 100 : nice(Math.max(...vals.filter(v => v != null)));
      const bw = (W - L - R) / Y.length, x = i => L + i * bw, y = v => T + (H - T - B) * (1 - v / ymax);
      let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(D.regions[r].name)} 연도별 막대">`;
      [0, .5, 1].forEach(f => { const v = ymax * f; s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 4}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`; });
      const mxi = vals.indexOf(Math.max(...vals.filter(v => v != null)));
      ys.forEach((yr, i) => {
        const v = yr[metric], bx = x(i) + 1, w = Math.max(2, Math.min(18, bw - 2)), cx = x(i) + bw / 2;
        if (v == null) s += `<rect class="nd" x="${cx - w / 2}" y="${y(0) - 3}" width="${w}" height="3" rx="1"/>`;
        else { const h = Math.max(1, y(0) - y(v)), op = yr.n < 12 ? .45 : 1; s += h < 5 ? `<rect x="${cx - w / 2}" y="${y(0) - h}" width="${w}" height="${h}" style="fill:${RC[r]};opacity:${op}"/>` : `<path d="M${cx - w / 2},${y(0)}V${y(0) - h + 4}q0,-4 4,-4h${w - 8}q4,0 4,4V${y(0)}Z" style="fill:${RC[r]};opacity:${op}"/>`; if (i === mxi || i === ys.length - 1) s += `<text class="dl ${i === mxi ? 'b' : ''}" x="${cx}" y="${y(v) - 4}" text-anchor="middle">${n0(v)}</text>`; }
        if ([0, 4, 8, 12, 17].includes(i)) s += `<text class="ax" x="${cx}" y="${H - 6}" text-anchor="middle">${i === 17 ? '26*' : "'" + yr.y.slice(2)}</text>`;
        s += `<rect class="hit" x="${x(i)}" y="${T}" width="${bw}" height="${H - T - B}" data-i="${i}"/>`;
      });
      s += `<line class="axd" x1="${L}" x2="${W - R}" y1="${y(0)}" y2="${y(0)}"/></svg>`;
      el.innerHTML = s;
      el.querySelectorAll('.hit').forEach(h => { const f = ev => { const yr = ys[+h.dataset.i]; tip(`<b>${yr.y}년 · ${esc(D.regions[r].name)}</b>${yr.n < 12 ? ' (11/19까지)' : ''}<br>공포 비율 ${n1(yr.rr)}${yr.rr == null ? ' (비트코인 검색이 너무 적음)' : ''}<br>평균 공포 지수 ${n1(yr.fear)} · 비트코인 ${n1(yr.btc)}<br>공포 최고 달 ${yr.pk ? ymf(yr.pk) + ' (' + yr.pkv + ')' : '없음(모두 0)'}`, ev); }; h.addEventListener('mousemove', f); h.addEventListener('touchstart', f, { passive: true }); h.addEventListener('mouseleave', untip); });
    });
  }
  function table() {
    let t = `<table><thead><tr><th>연도</th>${RK.map(r => `<th>${esc(D.regions[r].name)} 비율</th><th>공포</th><th>최고 달</th>`).join('')}</tr></thead><tbody>`;
    Y.forEach((yy, i) => { t += `<tr><td>${yy}${i === Y.length - 1 ? '*' : ''}</td>${RK.map(r => { const yr = D.regions[r].years[i]; return `<td class="${yr.rr == null ? 'mu' : ''}">${n1(yr.rr)}</td><td>${n1(yr.fear)}</td><td class="mu">${yr.pk ? ymk(yr.pk) + ' ' + yr.pkv : '–'}</td>`; }).join('')}</tr>`; });
    root.querySelector('#t').innerHTML = t + '</tbody></table>';
  }
  onseg(root, 'm', v => { metric = v; draw(); });
  table(); redraw(draw);
}

/* ───────── 시안 2: 가격과 공포 위아래 ───────── */
export function p2(D, root) {
  const on = { ww: true, us: true, kr: true }; let from = '2011-08', sm = '3';
  const avg3 = a => a.map((v, i) => { const w = [a[i - 1], v, a[i + 1]].filter(x => x != null); return w.length >= 2 ? w.reduce((p, q) => p + q, 0) / w.length : null; });
  const RS = Object.fromEntries(RK.map(r => [r, { '1': D.regions[r].ratio, '3': avg3(D.regions[r].ratio) }]));
  const dd = athDraw(D);
  root.innerHTML = `<div class="fx wrap">
  <p class="sum">위는 BTC 월 종가(로그 눈금), 아래는 같은 달의 공포 비율입니다. 축을 둘로 겹치지 않고 위아래로 나눴습니다. 점선은 지난 바닥, 맨 오른쪽은 지금(11/19)입니다. 공포 비율이 치솟은 달은 바닥보다 <b>폭락이 시작된 달</b>(2017/12, 2022/5, 2025/10)과 더 자주 겹칩니다.</p>
  <div class="ctl"><span class="lab">기간</span>${seg('r', [['2011-08', '전체'], ['2017-01', '2017~'], ['2021-01', '2021~']], from)}<span class="lab">선</span>${seg('s', [['3', '3달 평균'], ['1', '달마다 원값']], sm)}</div>
  <div class="box"><div id="lg"></div><div id="c"></div></div>
  <ul class="note"><li>공포 비율 = 공포 묶음 ÷ 비트코인 검색, 지역마다 가장 높은 달 = 100. 비트코인 지수가 3 미만인 달(대략 2013년 이전)은 비워 뒀습니다.</li><li>가격은 비트스탬프 BTC/USD 월봉입니다(2011/08부터). 고점 대비 하락폭은 그때까지의 최고가 기준입니다.</li><li>기본은 앞뒤 달과의 3달 평균입니다. 한국어 키워드는 0인 달이 많아 원값이 크게 출렁입니다. 말풍선에는 원값이 나옵니다.</li></ul></div>`;
  const lg = root.querySelector('#lg'), c = root.querySelector('#c');
  const drawLeg = () => { lg.innerHTML = legend(RK.map(r => ({ k: r, c: RC[r], t: D.regions[r].name + ' 공포 비율', on: on[r] })), true); lg.querySelectorAll('button').forEach(b => b.onclick = () => { on[b.dataset.k] = !on[b.dataset.k]; drawLeg(); draw(); }); };
  function draw() {
    const M = D.months.filter(m => m >= from), W = Math.max(320, c.clientWidth), L = 46, R = 12, T = 22, H1 = 220, G = 30, H2 = 170, B = 22, H = T + H1 + G + H2 + B;
    const x = i => L + (W - L - R) * i / (M.length - 1);
    const pr = M.map(m => D.px[m] ? D.px[m][3] : null), lo = Math.log10(Math.min(...pr.filter(v => v))), hi = Math.log10(Math.max(...M.filter(m => D.px[m]).map(m => D.px[m][1])));
    const y1 = v => T + H1 * (1 - (Math.log10(v) - lo) / (hi - lo));
    const rs = RK.map(r => M.map(m => RS[r][sm][D.months.indexOf(m)]));
    const rmax = 100, y2 = v => T + H1 + G + H2 * (1 - v / rmax);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="BTC 가격과 공포 비율">`;
    for (let e = Math.ceil(lo); e <= Math.floor(hi); e++) s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y1(10 ** e)}" y2="${y1(10 ** e)}"/><text class="ax" x="${L - 5}" y="${y1(10 ** e) + 4}" text-anchor="end">${10 ** e >= 1000 ? '$' + (10 ** e / 1000) + 'k' : '$' + 10 ** e}</text>`;
    [0, 50, 100].forEach(v => s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y2(v)}" y2="${y2(v)}"/><text class="ax" x="${L - 5}" y="${y2(v) + 4}" text-anchor="end">${v}</text>`);
    s += `<text class="ax" x="${L}" y="${T - 8}">BTC 월 종가 (로그)</text><text class="ax" x="${L}" y="${T + H1 + G - 8}">공포 비율 (최고 달 = 100)</text>`;
    M.forEach((m, i) => { if (m.endsWith('-01') && (+m.slice(0, 4)) % (M.length > 100 ? 2 : 1) === 0) s += `<line class="gl v" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${T + H1 + G + H2}"/><text class="ax" x="${x(i)}" y="${H - 6}" text-anchor="middle">${m.slice(0, 4)}</text>`; });
    D.bottoms.forEach(b => { const i = M.indexOf(b.m); if (i < 0) return; s += `<line class="ev" x1="${x(i)}" x2="${x(i)}" y1="${T}" y2="${T + H1 + G + H2}"/>`; if (b.low && D.px[b.m]) s += `<circle cx="${x(i)}" cy="${y1(b.low)}" r="4" style="fill:var(--surface);stroke:var(--ink);stroke-width:1.5"/><text class="evt" x="${x(i) + (b.now ? 6 : b.m === '2026-07' ? -6 : 0)}" y="${y1(b.low) + (b.now ? -8 : 16)}" text-anchor="${b.now ? 'end' : b.m === '2026-07' ? 'end' : 'middle'}">${b.now ? '지금' : ymk(b.m)}</text>`; });
    s += `<path class="px" d="${path(pr.map((v, i) => v ? [x(i), y1(v)] : null))}"/>`;
    RK.forEach((r, k) => { if (on[r]) s += `<path class="ln" style="stroke:${RC[r]}" d="${path(rs[k].map((v, i) => v != null ? [x(i), y2(v)] : null))}"/>`; });
    s += `<line class="cross" id="cx" x1="0" x2="0" y1="${T}" y2="${T + H1 + G + H2}" style="display:none"/><rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H1 + G + H2}"/></svg>`;
    c.innerHTML = s;
    const hit = c.querySelector('.hit'), cx = c.querySelector('#cx'), sv = c.querySelector('svg');
    const mv = ev => { const p = sv.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - p.left) * W / p.width; const i = Math.max(0, Math.min(M.length - 1, Math.round((px - L) / (W - L - R) * (M.length - 1)))); const m = M[i], j = D.months.indexOf(m); cx.setAttribute('x1', x(i)); cx.setAttribute('x2', x(i)); cx.style.display = '';
      const P = D.px[m]; tip(`<b>${ymf(m)}</b>${m === '2026-11' ? ' (11/19까지)' : ''}<br>BTC 종가 ${usd(P && P[3])} · 저가 ${usd(P && P[2])}${dd[m] != null ? ' · 고점 대비 ' + pc(dd[m]) : ''}<br>${RK.map(r => `${D.regions[r].name} 비율 ${n1(D.regions[r].ratio[j])} · 공포 ${D.regions[r].fear[j]}`).join('<br>')}`, ev); };
    hit.addEventListener('mousemove', mv); hit.addEventListener('touchmove', mv, { passive: true }); hit.addEventListener('touchstart', mv, { passive: true }); hit.addEventListener('mouseleave', () => { untip(); cx.style.display = 'none'; });
  }
  onseg(root, 'r', v => { from = v; draw(); });
  onseg(root, 's', v => { sm = v; draw(); });
  drawLeg(); redraw(draw);
}

/* ───────── 시안 3: 바닥에 맞춰 겹치기 (주별) ───────── */
export function p3(D, root) {
  const EC = ['var(--s1)', 'var(--s2)', 'var(--s3)', 'var(--s4)', 'var(--ink)'];
  const EP = D.bottoms.filter(b => b.w && b.wn).map((b, k) => ({ ...b, c: EC[k] }));
  const on = Object.fromEntries(EP.map(e => [e.m, true])); let reg = 'ww', met = 'ratio';
  const K0 = -26, K1 = 8;
  root.innerHTML = `<div class="fx wrap">
  <p class="sum" id="s"></p>
  <div class="ctl"><span class="lab">지역</span>${seg('g', RK.map(r => [r, D.regions[r].name]), reg)}<span class="lab">지표</span>${seg('m', [['ratio', '공포 비율'], ['fear', '공포 지수']], met)}</div>
  <div class="box"><div id="lg"></div><div id="c"></div></div>
  <div class="box"><h3>바닥 주 전후 26주 <span class="sub">최고 = 바닥 주 앞 26주~뒤 8주 안에서 가장 높았던 주</span></h3><div class="tw" id="t"></div></div>
  <ul class="note"><li>x축 0 = 그 바닥의 BTC 최저가가 나온 주(일요일 시작). '지금'은 11/15 주이고, 아직 바닥으로 확인된 것은 아닙니다.</li><li>주별 값은 구간(2017/11~2019/12, 최근 5년)마다 따로 조회한 뒤 월별 값에 맞춰 눈금을 옮겼습니다. 그래서 주별 최고가 100을 넘을 수 있습니다.</li><li id="krn"></li></ul></div>`;
  const lg = root.querySelector('#lg'), c = root.querySelector('#c');
  const ser = e => { const W = D.weekly[e.wn][reg], i = W.dates.indexOf(e.w); const out = []; for (let k = K0; k <= K1; k++) { const j = i + k; out.push(j >= 0 && j < W.dates.length ? { k, d: W.dates[j], v: W[met][j], p: D.weekly[e.wn].px[j] } : { k, v: null }); } return out; };
  const drawLeg = () => { lg.innerHTML = legend(EP.map(e => ({ k: e.m, c: e.c, t: e.label, on: on[e.m] })), true); lg.querySelectorAll('button').forEach(b => b.onclick = () => { on[b.dataset.k] = !on[b.dataset.k]; drawLeg(); draw(); }); };
  function table() {
    let t = `<table><thead><tr><th>바닥</th><th>바닥 주</th><th>그 주 저가</th><th>그 주 값</th><th>최고 주</th><th>최고 값</th><th>시차</th><th>바닥 주 ÷ 최고</th></tr></thead><tbody>`;
    const sm = [];
    EP.forEach(e => { const s = ser(e), z = s.find(p => p.k === 0), vv = s.filter(p => p.v != null); if (!vv.length) return; const pk = vv.reduce((a, b) => b.v > a.v ? b : a); const sh = pk.v ? 100 * (z.v || 0) / pk.v : null; sm.push({ e, pk, z, sh });
      t += `<tr class="${e.now ? 'hl' : ''}"><td>${esc(e.label)}</td><td>${z.d}</td><td>${usd(z.p && z.p[1])}</td><td>${n1(z.v)}</td><td>${pk.d}</td><td>${n1(pk.v)}</td><td>${pk.k === 0 ? '같은 주' : Math.abs(pk.k) + '주 ' + (pk.k < 0 ? '앞' : '뒤')}</td><td>${sh == null ? '–' : Math.round(sh) + '%'}</td></tr>`; });
    root.querySelector('#t').innerHTML = t + '</tbody></table>';
    const past = sm.filter(x => !x.e.now && x.e.m !== '2026-07'), now = sm.find(x => x.e.now);
    root.querySelector('#s').innerHTML = `${esc(D.regions[reg].name)} 기준으로 지난 바닥(2018/12·2022/6·2022/11) 주의 ${met === 'ratio' ? '공포 비율' : '공포 지수'}는 앞서 나온 최고치의 <b>${past.map(x => Math.round(x.sh) + '%').join('·')}</b>였습니다. 최고치는 바닥보다 <b>${past.map(x => x.pk.k === 0 ? '같은 주' : Math.abs(x.pk.k) + '주 앞').join('·')}</b>에 나왔습니다. 지금 주는 최고치의 <b>${now ? Math.round(now.sh) + '%' : '–'}</b>입니다. 사례가 세 번뿐이라 신호로 쓰기엔 이릅니다.`;
    root.querySelector('#krn').textContent = reg === 'kr' ? '한국어 키워드는 주별로 0인 주가 많습니다. 2018년 구간은 눈금을 맞출 달이 4개뿐이라 특히 들쭉날쭉합니다.' : '한국을 고르면 한국어 키워드(비트코인 폭락 등)로 바뀝니다.';
  }
  function draw() {
    const W = Math.max(320, c.clientWidth), H = 300, L = 40, R = 12, T = 14, B = 26;
    const S = EP.map(e => ({ e, s: ser(e) }));
    const ymax = Math.ceil(Math.max(10, ...S.filter(o => on[o.e.m]).flatMap(o => o.s.map(p => p.v || 0))) / 25) * 25;
    const x = k => L + (W - L - R) * (k - K0) / (K1 - K0), y = v => T + (H - T - B) * (1 - v / ymax);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="바닥 주에 맞춘 공포 검색">`;
    for (let v = 0; v <= ymax; v += ymax > 150 ? 50 : 25) { s += `<line class="gl" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="ax" x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${n0(v)}</text>`; }
    for (let k = -24; k <= K1; k += 4) s += `<text class="ax" x="${x(k)}" y="${H - 8}" text-anchor="middle">${k === 0 ? '바닥 주' : (k > 0 ? '+' : '') + k + '주'}</text>`;
    s += `<line class="ev" x1="${x(0)}" x2="${x(0)}" y1="${T}" y2="${H - B}" style="stroke:var(--ink);opacity:.6"/>`;
    S.forEach(o => { if (!on[o.e.m]) return; s += `<path class="ln ${o.e.now ? 'now' : ''}" style="stroke:${o.e.c}" d="${path(o.s.map(p => p.v != null ? [x(p.k), y(p.v)] : null))}"/>`; });
    s += `<line class="cross" id="cx" x1="0" x2="0" y1="${T}" y2="${H - B}" style="display:none"/><rect class="hit" x="${L}" y="${T}" width="${W - L - R}" height="${H - T - B}"/></svg>`;
    c.innerHTML = s;
    const hit = c.querySelector('.hit'), cx = c.querySelector('#cx'), sv = c.querySelector('svg');
    const mv = ev => { const p = sv.getBoundingClientRect(), px = ((ev.touches ? ev.touches[0].clientX : ev.clientX) - p.left) * W / p.width; const k = Math.max(K0, Math.min(K1, Math.round(K0 + (px - L) / (W - L - R) * (K1 - K0)))); cx.setAttribute('x1', x(k)); cx.setAttribute('x2', x(k)); cx.style.display = '';
      tip(`<b>${k === 0 ? '바닥 주' : (k > 0 ? '바닥 ' + k + '주 뒤' : '바닥 ' + (-k) + '주 앞')}</b><br>${S.filter(o => on[o.e.m]).map(o => { const q = o.s.find(z => z.k === k); return `${esc(o.e.label)}: ${q && q.d ? q.d + ' · ' + n1(q.v) + ' · BTC ' + usd(q.p && q.p[0]) : '자료 없음'}`; }).join('<br>')}`, ev); };
    hit.addEventListener('mousemove', mv); hit.addEventListener('touchmove', mv, { passive: true }); hit.addEventListener('touchstart', mv, { passive: true }); hit.addEventListener('mouseleave', () => { untip(); cx.style.display = 'none'; });
  }
  onseg(root, 'g', v => { reg = v; table(); draw(); });
  onseg(root, 'm', v => { met = v; table(); draw(); });
  drawLeg(); table(); redraw(draw);
}

/* ───────── 시안 4: 달력 열지도 ───────── */
export function p4(D, root) {
  let met = 'ratio', reg = 'ww';
  const BINS = [[0, 'var(--h0)', '0'], [10, 'var(--h1)', '~10'], [20, 'var(--h2)', '~20'], [35, 'var(--h3)', '~35'], [50, 'var(--h4)', '~50'], [70, 'var(--h5)', '~70'], [1e9, 'var(--h6)', '70+']];
  const col = v => v == null ? 'var(--surface)' : v === 0 ? BINS[0][1] : BINS.find(b => v <= b[0])[1];
  const BM = new Set(D.bottoms.filter(b => !b.now).map(b => b.m));
  const vals = (r) => met === 'ratio' ? D.regions[r].ratio : D.regions[r].fear;
  root.innerHTML = `<div class="fx wrap">
  <p class="sum" id="s"></p>
  <div class="tiles" id="tl"></div>
  <div class="ctl"><span class="lab">지표</span>${seg('m', [['ratio', '공포 비율'], ['fear', '공포 지수']], met)}</div>
  <div class="ramp">${BINS.map(b => `<span class="c" style="background:${b[1]}"></span><span>${b[2]}</span>`).join(' ')}<span class="c" style="background:var(--surface);border:1px solid var(--line);margin-left:10px"></span><span>자료 부족(비트코인 검색이 너무 적은 달)</span><span style="margin-left:10px">● 지난 바닥 달 · 점선 칸 = 11/19까지</span></div>
  <div class="grid3" id="g" style="margin-top:10px"></div>
  <div class="box"><h3>공포 비율이 가장 높았던 달 10개와 그 뒤 BTC <span class="sub">그 달 종가 기준 · 지난 일이 앞으로를 보장하지 않습니다</span></h3><div class="ctl">${seg('g', RK.map(r => [r, D.regions[r].name]), reg)}</div><div class="tw" id="t"></div></div>
  </div>`;
  const g = root.querySelector('#g');
  function tiles() {
    root.querySelector('#tl').innerHTML = RK.map(r => { const v = D.regions[r].ratio, now = v[v.length - 1], all = v.filter(x => x != null), rank = all.filter(x => x > now).length + 1; return `<div class="tile"><div class="k">${esc(D.regions[r].name)} · 11월(19일까지) 공포 비율</div><div class="v">${n1(now)}</div><div class="d">${all.length}개 달 중 ${rank}위 · 공포 지수 ${D.regions[r].fear[v.length - 1]}</div></div>`; }).join('');
    const w = D.regions.ww.ratio, i6 = D.months.indexOf('2026-06'), i2 = D.months.indexOf('2026-02');
    root.querySelector('#s').innerHTML = `한 칸 = 한 달입니다. 색이 짙을수록(어두운 화면에서는 밝을수록) 공포 검색 몫이 큽니다. 2025년 8월부터 칸이 짙어지기 시작해, 전 세계는 2025/10(100)·2026/6(${n1(w[i6])})·2026/2(${n1(w[i2])})가 가장 짙습니다. 가격이 다시 6만 달러대로 내려온 11월은 <b>${n1(w[w.length - 1])}</b>로 옅습니다.`;
  }
  function draw() {
    const Y = yrs(D);
    g.innerHTML = RK.map(r => `<div class="box"><h3><i style="display:inline-block;width:10px;height:10px;border-radius:3px;background:${RC[r]}"></i>${esc(D.regions[r].name)}</h3><div data-r="${r}"></div></div>`).join('');
    RK.forEach(r => {
      const el = g.querySelector(`[data-r="${r}"]`), W = Math.max(260, el.clientWidth), L = 30, T = 14, cw = (W - L) / 12, ch = 15, H = T + Y.length * ch + 4, v = vals(r);
      let s = `<svg class="hm" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(D.regions[r].name)} 달력 열지도">`;
      ['1', '4', '7', '10'].forEach(mm => s += `<text x="${L + (+mm - 1) * cw + cw / 2}" y="10" text-anchor="middle">${mm}월</text>`);
      Y.forEach((yy, yi) => { s += `<text x="${L - 4}" y="${T + yi * ch + 11}" text-anchor="end">${yy.slice(2)}</text>`;
        for (let k = 0; k < 12; k++) { const m = yy + '-' + String(k + 1).padStart(2, '0'), i = D.months.indexOf(m); if (i < 0) continue; const val = v[i];
          s += `<rect class="c ${m === '2026-11' ? 'pt' : ''}" x="${L + k * cw}" y="${T + yi * ch}" width="${cw}" height="${ch}" style="fill:${col(val)}${val == null ? ';stroke:var(--line);stroke-width:1' : ''}" data-i="${i}"/>`;
          if (BM.has(m)) s += `<circle cx="${L + k * cw + cw / 2}" cy="${T + yi * ch + ch / 2}" r="2.6" style="fill:var(--ink);stroke:var(--surface);stroke-width:1;pointer-events:none"/>`; } });
      el.innerHTML = s + '</svg>';
      el.querySelectorAll('rect.c').forEach(h => { const f = ev => { const i = +h.dataset.i, m = D.months[i], P = D.px[m], prev = D.px[D.months[i - 1]]; tip(`<b>${ymf(m)} · ${esc(D.regions[r].name)}</b><br>공포 비율 ${n1(D.regions[r].ratio[i])} · 공포 지수 ${D.regions[r].fear[i]}<br>BTC 종가 ${usd(P && P[3])}${P && prev ? ' (그 달 ' + pc(100 * (P[3] / prev[3] - 1)) + ')' : ''}${BM.has(m) ? '<br>지난 바닥 달' : ''}`, ev); }; h.addEventListener('mousemove', f); h.addEventListener('touchstart', f, { passive: true }); h.addEventListener('mouseleave', untip); });
    });
  }
  function table() {
    const R = D.regions[reg], top = R.ratio.map((v, i) => [v, D.months[i]]).filter(x => x[0] != null).sort((a, b) => b[0] - a[0]).slice(0, 10);
    let t = `<table><thead><tr><th>달</th><th>공포 비율</th><th>그 달 종가</th><th>3달 뒤</th><th>6달 뒤</th><th>12달 뒤</th></tr></thead><tbody>`;
    top.forEach(([v, m]) => t += `<tr><td>${ymk(m)}</td><td>${n1(v)}</td><td>${usd(pxClose(D, m))}</td><td>${pc(fwd(D, m, 3))}</td><td>${pc(fwd(D, m, 6))}</td><td>${pc(fwd(D, m, 12))}</td></tr>`);
    root.querySelector('#t').innerHTML = t + '</tbody></table><p class="note">– 는 아직 그 기간이 지나지 않은 달입니다. 공포가 가장 컸던 달 뒤에 오히려 더 빠진 경우(2025/10·11, 2018/2, 2022/5)가 적지 않습니다.</p>';
  }
  onseg(root, 'm', v => { met = v; draw(); });
  onseg(root, 'g', v => { reg = v; table(); });
  tiles(); table(); redraw(draw);
}

/* ───────── 시안 5: 키워드와 신뢰도 ───────── */
export function p5(D, root) {
  let reg = 'ww';
  root.innerHTML = `<div class="fx wrap">
  <p class="sum">묶음 안에서 실제로 신호를 내는 키워드가 무엇인지, 원래 요청한 'bitcoin worst scenario'가 왜 못 쓰는지, GPT 결과에서 무엇을 가져오고 무엇을 버렸는지를 한 화면에 모았습니다.</p>
  <div class="box"><h3>1. 키워드 다섯 개 나눠 보기 <span class="sub">다섯 개를 한 번에 조회해 같은 잣대 · 연평균</span></h3><div class="ctl">${seg('g', [['ww', '전 세계'], ['us', '미국'], ['kr', '한국(한국어)']], reg)}</div><div id="tm"></div></div>
  <div class="box"><h3>2. 원문 'bitcoin worst scenario' <span class="sub">월별 · 0이 아닌 달만 표시</span></h3><div id="og"></div><p class="note" style="margin-top:8px">지역마다 <b>딱 한 달만 100</b>이고 그 달이 제각각입니다(전 세계 2025/11, 따옴표 구절 2009/06, 미국 2018/04, 한국 2011/12). 비트코인 시세와 아무 관계가 없는 달도 있어(2009/06은 거래소도 없던 때) 검색이 거의 없을 때 생기는 표본 잡음으로 봅니다. GPT가 전 세계로 확인한 두 숫자와 같고, 미국·한국에서도 같은 현상이 나옵니다.</p></div>
  <div class="two">
  <div class="box"><h3>3. GPT 결과 검증</h3><ul class="kv">
   <li><span class="tag keep">가져옴</span><b>같은 기간을 한 번에 조회</b> — 해마다 따로 조회하면 해마다 최고점이 100이 되어 비교가 안 된다는 지적. 모든 시안이 이 방식입니다.</li>
   <li><span class="tag keep">가져옴</span><b>연평균과 함께 최고 달</b> — 시안 1의 표와 말풍선에 넣었습니다.</li>
   <li><span class="tag keep">가져옴</span><b>2026년은 미완료로 표시</b> — 옅은 막대·점선 칸으로 구분했습니다.</li>
   <li><span class="tag keep">가져옴</span><b>검색이 급락을 뒤따를 수 있다</b> — 시안 3에서 바닥 주와 공포 최고 주의 앞뒤를 직접 쟀습니다. 공포 최고는 바닥보다 0~23주 앞에 왔습니다.</li>
   <li><span class="tag drop">버림</span><b>원문 연평균(2025년 8.3)</b> — 한 달짜리 잡음이 평균을 만든 값이라 통계로 쓰지 않습니다. 시안에서는 '잡음 사례'로만 보여 줍니다.</li>
   <li><span class="tag drop">버림</span><b>원문만 따로 추적</b> — 네 지역 모두 한 달짜리 값이라 따로 추적할 정보가 없습니다.</li>
   <li><span class="tag add">더함</span><b>'bitcoin' 전체 검색으로 나눈 비율</b> — 관심 자체가 커진 효과를 빼야 '겁이 늘었다'고 말할 수 있습니다.</li>
   <li><span class="tag add">더함</span><b>지역 셋·주별·가격 대조</b> — 전 세계·미국·한국, 바닥 앞뒤 주별, 비트스탬프 가격.</li></ul></div>
  <div class="box"><h3>4. 방법과 한계</h3><ul class="kv">
   <li><b>숫자의 뜻</b>: 구글 트렌드는 검색 횟수가 아니라 전체 검색 대비 몫을 0~100으로 바꾼 값입니다.</li>
   <li><b>묶음</b>: 영어 ${esc(D.meta.fear_en.join(' · '))}를 '+'(또는)로 묶은 한 검색어. 한국은 ${esc(D.meta.fear_ko.join(' · '))}.</li>
   <li><b>비율</b>: 같은 기간 공포 묶음 지수 ÷ 비트코인 지수. 두 지수를 따로 조회해 해상도를 살렸고, 지역마다 가장 높은 달을 100으로 맞췄습니다. 비트코인 지수 3 미만인 달은 계산하지 않았습니다.</li>
   <li><b>쏠림</b>: 묶음의 대부분은 'bitcoin crash'(한국은 '비트코인 폭락') 한 단어입니다. 사실상 '폭락 검색'에 가깝습니다.</li>
   <li><b>수집 방식 변화</b>: 구글 트렌드는 2011·2016·2022년에 지역 배정과 수집 방식을 바꿨습니다. 2022년 1월 이후 값이 그 전보다 높게 나온다는 연구가 있습니다. 그래서 '2025~2026년 공포 몫이 역대 최고'라는 결과도 일부는 이 변화 때문일 수 있습니다.</li>
   <li><b>표본 잡음</b>: 검색이 적은 달·주는 조회할 때마다 값이 조금씩 달라질 수 있습니다. 한국어 주별 값이 특히 그렇습니다.</li></ul></div>
  </div></div>`;
  function terms() {
    const el = root.querySelector('#tm'), R = D.regions[reg], Y = yrs(D), names = R.termnames, rows = names.map((_, k) => R.years.map(y => y.terms[k]));
    const tot = rows.map(r => r.reduce((a, b) => a + b, 0)), all = tot.reduce((a, b) => a + b, 0) || 1, ymax = nice(Math.max(...rows.flat()));
    const W = Math.max(300, el.clientWidth), L = 150, R0 = 50, rh = 46, H = names.length * rh + 18, bw = (W - L - R0) / Y.length;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="키워드별 연평균">`;
    rows.forEach((row, k) => { const y0 = k * rh + rh - 6; s += `<text class="ax" x="0" y="${y0 - 6}" style="fill:var(--ink-2)">${esc(names[k])}</text><text class="dl b" x="${W - 2}" y="${y0 - 6}" text-anchor="end">${Math.round(100 * tot[k] / all)}%</text><line class="gl" x1="${L}" x2="${W - R0}" y1="${y0}" y2="${y0}"/>`;
      row.forEach((v, i) => { const h = (rh - 10) * v / ymax; if (v > 0) s += `<rect x="${L + i * bw + 1}" y="${y0 - h}" width="${Math.max(1.5, bw - 2)}" height="${h}" rx="1.5" style="fill:${RC[reg]};opacity:${R.years[i].n < 12 ? .45 : 1}"/>`; s += `<rect class="hit" x="${L + i * bw}" y="${y0 - rh + 8}" width="${bw}" height="${rh - 8}" data-k="${k}" data-i="${i}"/>`; }); });
    [0, 8, 17].forEach(i => s += `<text class="ax" x="${L + i * bw + bw / 2}" y="${H - 2}" text-anchor="middle">${Y[i]}</text>`);
    el.innerHTML = s + `</svg><p class="note">오른쪽 %는 다섯 키워드 합계에서 각자가 차지한 몫입니다. 막대 높이는 다섯 줄이 같은 눈금(최고 ${n1(ymax)})입니다.</p>`;
    el.querySelectorAll('.hit').forEach(h => { const f = ev => { const k = +h.dataset.k, i = +h.dataset.i; tip(`<b>${esc(names[k])} · ${Y[i]}년</b><br>연평균 ${n1(rows[k][i])}`, ev); }; h.addEventListener('mousemove', f); h.addEventListener('touchstart', f, { passive: true }); h.addEventListener('mouseleave', untip); });
  }
  function orig() {
    const el = root.querySelector('#og'), rows = [['전 세계', D.regions.ww.orig], ['전 세계 "따옴표"', D.regions.ww.origq], ['미국', D.regions.us.orig], ['한국', D.regions.kr.orig]];
    const W = Math.max(300, el.clientWidth), L = 110, rh = 28, H = rows.length * rh + 16, n = D.months.length, x = i => L + (W - L - 8) * i / (n - 1);
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="원문 검색어 월별">`;
    rows.forEach(([t, v], k) => { const y0 = k * rh + rh - 4; s += `<text class="ax" x="0" y="${y0 - 4}" style="fill:var(--ink-2)">${esc(t)}</text><line class="gl" x1="${L}" x2="${W - 8}" y1="${y0}" y2="${y0}"/>`;
      v.forEach((val, i) => { if (val > 0) s += `<line x1="${x(i)}" x2="${x(i)}" y1="${y0}" y2="${y0 - (rh - 8) * val / 100}" style="stroke:var(--ink);stroke-width:2"/><text class="dl b" x="${Math.min(W - 40, x(i) + 4)}" y="${y0 - rh + 14}">${ymk(D.months[i])} = ${val}</text>`; }); });
    [0, 96, 192].forEach(i => s += `<text class="ax" x="${x(i)}" y="${H - 2}" text-anchor="middle">${D.months[i].slice(0, 4)}</text>`);
    el.innerHTML = s + '</svg>';
  }
  onseg(root, 'g', v => { reg = v; terms(); });
  redraw(() => { terms(); orig(); });
}
