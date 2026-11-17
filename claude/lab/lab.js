// 화면 시안 공통: 데이터 읽기, 색, 툴팁, 가격 차트
export const WHO = { claude: 'Claude', gpt: 'GPT', kol: 'KOL' };
export const KIND = { research: '리서치', followup: '팔로업', brief: '브리핑', answer: '답변', review: '검토', correction: '정정', kol: 'KOL 수집' };
export const CAT = { P: '예측', S: '시나리오', W: '관찰', D: '설명', C: '복합', X: '서술' };
export const RES = { H: '목표 도달', AH: '이미 조건 · 목표 도달', T: '조건 충족 · 목표 미도달', N: '조건 안 옴', I: '무효', O: '유지 중', A: '이미 조건 상태', U: '순서 불명' };
export const RESK = { H: 'good', AH: 'good', T: 'warn', N: 'mute', I: 'bad', O: 'live', A: 'mute', U: 'mute' };
export const RESI = { good: '✓', warn: '◐', mute: '·', bad: '✕', live: '…' };
export const LGROUP = { support: 'sup', low_high: 'sup', resistance: 'res', ma: 'ma', cost_basis: 'ma', thesis: 'ma', liquidation: 'liq', option: 'liq', other: 'oth' };
export const LGNAME = { sup: '지지·고저점', res: '저항', ma: '이평·원가', liq: '청산·옵션', oth: '기타' };
export const LKIND = { low_high: '고저점', resistance: '저항', support: '지지', cost_basis: '원가', ma: '이동평균', liquidation: '청산', option: '옵션', other: '기타', thesis: 'THESIS' };
export const ALIAS = { SPX6900: 'SPX', '1000PEPE': 'PEPE' };
export const DAY = 864e5;

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const kst = s => Date.parse(s.replace(' ', 'T') + (s.length <= 10 ? 'T09:00' : '') + ':00+09:00');
export const asset = a => ALIAS[a] || a;
export const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
export function fp(v) {
  if (v == null || !isFinite(v)) return '—';
  const a = Math.abs(v);
  if (a >= 1000) return Math.round(v).toLocaleString('en-US');
  if (a >= 10) return v.toFixed(1);
  if (a >= 1) return v.toFixed(3);
  if (a >= 0.01) return v.toFixed(4);
  return v.toPrecision(3);
}
export const pct = (v, d = 1) => (v > 0 ? '+' : '') + (v * 100).toFixed(d) + '%';
export const md = t => { const d = new Date(t + 9 * 36e5); return `${d.getUTCMonth() + 1}/${d.getUTCDate()}`; };
export const mdh = t => { const d = new Date(t + 9 * 36e5); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`; };

// 데이터 -------------------------------------------------------------
export async function load() {
  const get = f => fetch('../data/' + f, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(f + ' ' + r.status); return r.json(); });
  const [meta, snaps, items, now, px] = await Promise.all(['meta.json', 'snapshots.json', 'items.json', 'now.json', 'px.json'].map(get));
  const D = { meta, snaps, items, now, px, snap: snaps[snaps.length - 1] };
  D.iss = Object.fromEntries(meta.issues.map(i => [i.id, i]));
  D.built = kst(meta.built);
  for (const a in px) { const p = px[a]; p.t = p.c.map((_, i) => (p.t0 + i * p.s) * 1000); }
  for (const r of items.timeline) r.t = kst(r.ts);
  for (const r of items.ledger) { r.t = kst(r.ts); r.a = asset(r.asset); r.ta = r.at ? kst(r.at) : null; r.scored = r.res && RESK[r.res] && ['P', 'S', 'W'].includes(r.cat); }
  for (const r of items.ladder) { r.t = kst(r.ts); r.a = asset(r.asset); r.gp = LGROUP[r.kind] || 'oth'; }
  for (const r of items.radar) r.t = kst(r.ts);
  const seen = new Set();
  D.cats = items.catalysts.filter(c => c.date).map(c => ({ ...c, t: kst(c.date + ' ' + (c.time || '09:00')) }))
    .filter(c => { const k = c.date + (c.time || '') + c.ev.replace(/^(미|美)\s*/, '').replace(/\d+월/g, '').replace(/[^가-힣A-Za-z]/g, '').slice(0, 4); if (seen.has(k)) return false; seen.add(k); return true; })
    .sort((a, b) => a.t - b.t);
  return D;
}
export const last = (D, a) => { const p = D.px[a]; return p ? p.c[p.c.length - 1] : null; };
export function priceAt(D, a, t) {
  const p = D.px[a]; if (!p) return null;
  const i = Math.min(p.c.length - 1, Math.max(0, Math.floor((t / 1000 - p.t0) / p.s)));
  return p.c[i];
}
export function chg(D, a, days) {
  const p = D.px[a]; if (!p) return null;
  const n = p.c.length - 1, k = Math.max(0, n - Math.round(days * 6));
  return p.c[n] / p.c[k] - 1;
}
// 가까운 레벨: 언급 시점이 지금보다 앞이고, 지금 가격 ±rng 안. 0.4% 안은 하나로 묶는다
export function clusters(D, a, opt = {}) {
  const now = opt.now ?? last(D, a), rng = opt.rng ?? 0.25, iss = opt.iss;
  const lv = D.items.ladder.filter(r => r.a === a && r.price > 0 && Math.abs(r.price / now - 1) <= rng && (!iss || r.iss.includes(iss)))
    .sort((x, y) => x.price - y.price);
  const out = [];
  for (const r of lv) {
    const c = out[out.length - 1];
    if (c && r.price / c.lo - 1 <= 0.004) { c.items.push(r); c.hi = r.price; }
    else out.push({ lo: r.price, hi: r.price, items: [r] });
  }
  for (const c of out) {
    c.p = c.items.reduce((s, r) => s + r.price, 0) / c.items.length;
    c.n = c.items.length; c.d = c.p / now - 1;
    const g = {}; for (const r of c.items) g[r.gp] = (g[r.gp] || 0) + 1;
    c.gp = Object.entries(g).sort((x, y) => y[1] - x[1])[0][0];
    c.first = Math.min(...c.items.map(r => r.t)); c.lastT = Math.max(...c.items.map(r => r.t));
    c.label = [...new Set(c.items.map(r => r.label))].slice(0, 3).join(' · ');
  }
  return out;
}

// 툴팁 ---------------------------------------------------------------
let TIP;
export function tip() {
  if (TIP) return TIP;
  TIP = document.createElement('div'); TIP.className = 'tip'; TIP.setAttribute('role', 'tooltip'); document.body.append(TIP);
  const show = (html, x, y) => {
    TIP.innerHTML = html; TIP.style.display = 'block';
    const w = TIP.offsetWidth, h = TIP.offsetHeight, vw = innerWidth;
    TIP.style.left = Math.max(8, Math.min(vw - w - 8, x + 14)) + 'px';
    TIP.style.top = (y + h + 24 > innerHeight ? y - h - 12 : y + 16) + scrollY + 'px';
  };
  document.addEventListener('pointerover', e => { const el = e.target.closest('[data-tip]'); if (el) show(el.dataset.tip, e.clientX, e.clientY); });
  document.addEventListener('pointermove', e => { const el = e.target.closest('[data-tip]'); if (el && TIP.style.display === 'block') show(el.dataset.tip, e.clientX, e.clientY); });
  document.addEventListener('pointerout', e => { if (e.target.closest('[data-tip]')) TIP.style.display = 'none'; });
  addEventListener('scroll', () => { TIP.style.display = 'none'; }, { passive: true });
  return TIP;
}
// data-tip 안은 HTML 조각이라 한 번 더 이스케이프된 문자열을 넣는다
export const tt = (title, ...lines) => `data-tip="${esc(`<b>${esc(title)}</b>` + lines.filter(Boolean).map(l => '<br>' + esc(l)).join(''))}"`;

// 가격 차트 -----------------------------------------------------------
// opt: {h, from, to, layers:{lv,calls,posts,cats,fix}, iss, future (ms), compact}
export function priceChart(el, D, a, opt = {}) {
  const p = D.px[a];
  if (!p) { el.innerHTML = `<div class="empty">${esc(a)} 가격 자료가 아직 없습니다.</div>`; return; }
  const W = Math.max(300, el.clientWidth || 600), H = opt.h || (W < 560 ? 300 : 420);
  const mL = 8, mR = W < 560 ? 54 : 70, mT = 22, mB = 30;
  const from = opt.from ?? p.t[0], end = p.t[p.t.length - 1] + p.s * 1000, to = opt.to ?? end + (opt.future ?? 0);
  const idx = p.t.map((t, i) => i).filter(i => p.t[i] >= from && p.t[i] <= to);
  const L = opt.layers || { lv: 1, calls: 1, posts: 1, cats: 1, fix: 1 };
  const iss = opt.iss, inIss = r => !iss || (r.iss || []).includes(iss);
  let lo = Math.min(...idx.map(i => p.l[i])), hi = Math.max(...idx.map(i => p.h[i]));
  const calls = L.calls ? D.items.ledger.filter(r => r.a === a && r.trg && r.t >= from - 2 * DAY && r.t <= to && inIss(r)) : [];
  for (const c of calls) { if (c.trg / lo > 0.9 && c.trg / hi < 1.1) { lo = Math.min(lo, c.trg); hi = Math.max(hi, c.trg); } }
  const pad = (hi - lo) * 0.06; lo -= pad; hi += pad;
  const X = t => mL + (t - from) / (to - from) * (W - mL - mR), Y = v => mT + (hi - v) / (hi - lo) * (H - mT - mB);
  const s = [];
  s.push(`<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="pc" role="img" aria-label="${esc(a)} 4시간봉 가격과 채널 기록">`);
  // 미래 구간
  if (to > end) s.push(`<rect x="${X(end)}" y="${mT}" width="${X(to) - X(end)}" height="${H - mT - mB}" class="fut"/><text x="${X(end) + 6}" y="${mT + 12}" class="ax">앞으로</text>`);
  // 가로 눈금
  const step = niceStep((hi - lo) / 5);
  for (let v = Math.ceil(lo / step) * step; v < hi; v += step) s.push(`<line x1="${mL}" x2="${W - mR}" y1="${Y(v)}" y2="${Y(v)}" class="grid"/><text x="${W - mR + 6}" y="${Y(v) + 4}" class="ax">${fp(v)}</text>`);
  // 날짜 눈금
  const days = Math.ceil((to - from) / DAY), every = days > 40 ? 7 : days > 20 ? 4 : days > 9 ? 2 : 1;
  const d0 = Math.ceil((from + 9 * 36e5) / DAY) * DAY - 9 * 36e5;
  for (let t = d0, k = 0; t <= to; t += DAY, k++) if (k % every === 0) s.push(`<line x1="${X(t)}" x2="${X(t)}" y1="${mT}" y2="${H - mB}" class="grid v"/><text x="${X(t)}" y="${H - 10}" class="ax" text-anchor="middle">${md(t)}</text>`);
  // 레벨: 언급한 때부터 오른쪽 끝까지
  if (L.lv) {
    const lv = D.items.ladder.filter(r => r.a === a && r.price > lo && r.price < hi && r.t <= to && inIss(r));
    const nowP = p.c[p.c.length - 1], cap = opt.maxLv ?? (W < 560 ? 8 : 14);
    const cl = clustersFrom(lv).sort((x, y) => y.n - x.n || Math.abs(x.p / nowP - 1) - Math.abs(y.p / nowP - 1)).slice(0, cap);
    cl.forEach((c, k) => {
      const x1 = X(Math.max(from, c.first)), y = Y(c.p), lab = k < (W < 560 ? 3 : 6);
      s.push(`<g class="lv ${c.gp}" ${tt(`${fp(c.p)} · ${LGNAME[c.gp]} · 언급 ${c.n}번`, c.label, `처음 ${mdh(c.first)}`)}><line x1="${x1}" x2="${W - mR}" y1="${y}" y2="${y}" style="stroke-width:${Math.min(4, 1 + c.n * 0.5)}"/><rect x="${x1}" y="${y - 6}" width="${W - mR - x1}" height="12" class="hit"/>${lab ? `<text x="${W - mR - 4}" y="${y - 4}" text-anchor="end" class="lvt">${esc(c.label.slice(0, 18))}</text>` : ''}</g>`);
    });
  }
  // 고저 띠와 종가선
  let band = '', line = '';
  idx.forEach((i, k) => { band += `${k ? 'L' : 'M'}${X(p.t[i] + p.s * 500).toFixed(1)},${Y(p.h[i]).toFixed(1)}`; });
  [...idx].reverse().forEach(i => { band += `L${X(p.t[i] + p.s * 500).toFixed(1)},${Y(p.l[i]).toFixed(1)}`; });
  idx.forEach((i, k) => { line += `${k ? 'L' : 'M'}${X(p.t[i] + p.s * 1000).toFixed(1)},${Y(p.c[i]).toFixed(1)}`; });
  s.push(`<path d="${band}Z" class="band"/><path d="${line}" class="px"/>`);
  // 지금 가격
  const cN = p.c[p.c.length - 1];
  s.push(`<line x1="${mL}" x2="${W - mR}" y1="${Y(cN)}" y2="${Y(cN)}" class="nowl"/><rect x="${W - mR + 2}" y="${Y(cN) - 9}" width="${mR - 4}" height="18" rx="4" class="nowb"/><text x="${W - mR + 6}" y="${Y(cN) + 4}" class="nowt">${fp(cN)}</text>`);
  // 일정
  if (L.cats) for (const c of D.cats.filter(c => c.t >= from && c.t <= to && inIss(c))) {
    const x = X(c.t), past = c.t <= D.built;
    s.push(`<g class="cat ${past ? 'past' : 'next'}" ${tt(`${c.date}${c.time ? ' ' + c.time : ''} · ${c.ev}`, c.exp ? '예상: ' + c.exp : '', c.out ? '결과: ' + c.out : '')}><line x1="${x}" x2="${x}" y1="${mT}" y2="${H - mB}"/><rect x="${x - 5}" y="${H - mB - 12}" width="10" height="10" rx="2"/><rect x="${x - 6}" y="${mT}" width="12" height="${H - mT - mB}" class="hit"/></g>`);
  }
  // 판정: 조건선(언급 → 결과 시각), 목표점
  if (L.calls) for (const c of calls) {
    const k = RESK[c.res] || 'mute', x1 = X(Math.max(from, c.t)), x2 = X(Math.min(to, c.ta || end)), y = Y(c.trg);
    if (y < mT || y > H - mB) continue;
    const dirS = c.dir === 'below' ? '▼' : '▲';
    const tip = tt(`${mdh(c.t)} ${WHO[c.who] || c.who} · ${CAT[c.cat] || '판정'}`, c.st, `조건 ${c.dir === 'below' ? '아래' : '위'} ${fp(c.trg)}${c.tgt ? ' → 목표 ' + fp(c.tgt) : ''}`, `결과: ${RES[c.res] || '채점 안 함'}${c.at ? ' (' + c.at.slice(5) + ')' : ''}`);
    s.push(`<g class="call ${k}" ${tip}><line x1="${x1}" x2="${x2}" y1="${y}" y2="${y}"/><text x="${x1}" y="${y + (c.dir === 'below' ? 12 : -4)}" text-anchor="middle" class="sym">${dirS}</text>`);
    if (c.tgt && c.tgt > lo && c.tgt < hi) s.push(`<line x1="${x2}" x2="${x2}" y1="${y}" y2="${Y(c.tgt)}" class="tl"/><circle cx="${x2}" cy="${Y(c.tgt)}" r="4.5" class="tgt"/>`);
    s.push(`<rect x="${x1 - 6}" y="${y - 8}" width="${Math.max(12, x2 - x1 + 12)}" height="16" class="hit"/></g>`);
  }
  // 리서치 줄(위), 정정 줄(아래)
  if (L.posts) for (const r of D.items.timeline.filter(r => r.t >= from && r.t <= to && (r.assets || []).map(asset).includes(a) && inIss(r))) {
    s.push(`<circle cx="${X(r.t)}" cy="${mT - 10}" r="4" class="post ${r.who}" ${tt(`${mdh(r.t)} ${WHO[r.who] || r.who} ${KIND[r.kind] || ''}`, r.title, r.gist.slice(0, 140))}/>`);
  }
  if (L.fix) for (const r of D.items.radar.filter(r => r.t >= from && r.t <= to && inIss(r) && (r.a + r.b).includes(a))) {
    s.push(`<text x="${X(r.t)}" y="${H - mB + 2}" text-anchor="middle" class="fix" ${tt(`${mdh(r.t)} ${r.type}`, '원래: ' + r.a, '고침: ' + r.b)}>✕</text>`);
  }
  // 십자선
  s.push(`<line class="xh" x1="0" x2="0" y1="${mT}" y2="${H - mB}" visibility="hidden"/><rect class="ov" x="${mL}" y="${mT}" width="${X(end) - mL}" height="${H - mT - mB}" fill="transparent"/></svg>`);
  el.innerHTML = s.join('');
  const svg = el.querySelector('svg'), xh = svg.querySelector('.xh'), ov = svg.querySelector('.ov'), TP = tip();
  const move = e => {
    const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width;
    const t = from + (x - mL) / (W - mL - mR) * (to - from);
    const i = Math.max(0, Math.min(p.c.length - 1, Math.floor((t / 1000 - p.t0) / p.s)));
    xh.setAttribute('x1', x); xh.setAttribute('x2', x); xh.setAttribute('visibility', 'visible');
    const prev = p.c[Math.max(0, i - 6)];
    TP.innerHTML = `<b>${mdh(p.t[i])}~ 4시간</b><br>종가 ${fp(p.c[i])} · 고 ${fp(p.h[i])} · 저 ${fp(p.l[i])}<br>24시간 ${pct(p.c[i] / prev - 1)}`;
    TP.style.display = 'block'; TP.style.left = Math.min(innerWidth - TP.offsetWidth - 8, e.clientX + 14) + 'px'; TP.style.top = e.clientY + scrollY + 16 + 'px';
    if (opt.onTime) opt.onTime(p.t[i]);
  };
  ov.addEventListener('pointermove', move);
  ov.addEventListener('pointerleave', () => { xh.setAttribute('visibility', 'hidden'); TP.style.display = 'none'; });
  if (opt.onPick) ov.addEventListener('click', e => { move(e); const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width; opt.onPick(from + (x - mL) / (W - mL - mR) * (to - from)); });
}
function clustersFrom(lv) {
  lv = [...lv].sort((x, y) => x.price - y.price);
  const out = [];
  for (const r of lv) {
    const c = out[out.length - 1];
    if (c && r.price / c.lo - 1 <= 0.004) c.items.push(r); else out.push({ lo: r.price, items: [r] });
  }
  for (const c of out) {
    c.p = c.items.reduce((s, r) => s + r.price, 0) / c.items.length; c.n = c.items.length;
    const g = {}; for (const r of c.items) g[r.gp] = (g[r.gp] || 0) + 1;
    c.gp = Object.entries(g).sort((x, y) => y[1] - x[1])[0][0];
    c.first = Math.min(...c.items.map(r => r.t));
    c.label = [...new Set(c.items.map(r => r.label))].slice(0, 3).join(' · ');
  }
  return out;
}
export function niceStep(x) { const e = Math.pow(10, Math.floor(Math.log10(x))), f = x / e; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * e; }

// 스파크라인 (종가, 최근 days일)
export function spark(D, a, w = 120, h = 32, days = 30) {
  const p = D.px[a]; if (!p) return '<span class="mute">—</span>';
  const n = p.c.length, k = Math.max(0, n - days * 6), c = p.c.slice(k);
  const lo = Math.min(...c), hi = Math.max(...c);
  const d = c.map((v, i) => `${i ? 'L' : 'M'}${(i / (c.length - 1) * (w - 2) + 1).toFixed(1)},${((hi - v) / (hi - lo || 1) * (h - 4) + 2).toFixed(1)}`).join('');
  const up = c[c.length - 1] >= c[0];
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spk ${up ? 'up' : 'dn'}" aria-hidden="true"><path d="${d}"/><circle cx="${w - 1}" cy="${((hi - c[c.length - 1]) / (hi - lo || 1) * (h - 4) + 2).toFixed(1)}" r="2.5"/></svg>`;
}

// 공통 머리(시안 이동)
export function head(n, title, q) {
  const names = ['차트 한 장', '질문 여섯 개', '사안별 이야기', '하루씩 흐름', '종목 한 줄씩'];
  return `<header class="lh"><div class="wrap"><a class="back" href="./">← 시안 목록</a><nav class="sw" aria-label="시안">${names.map((x, i) => `<a href="./${i + 1}.html" ${i + 1 === n ? 'aria-current="page"' : ''}>${i + 1}. ${x}</a>`).join('')}</nav><button class="btn" id="theme" type="button" aria-label="밝게/어둡게">◐</button></div></header>
  <div class="wrap"><div class="lt"><span class="no">시안 ${n}</span><h1>${esc(title)}</h1><p class="q">${esc(q)}</p></div></div>`;
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
export function foot(D) {
  return `<footer class="lf wrap">기준 ${esc(D.meta.built)} KST · 가격: 바이낸스·크라켄 4시간봉(공개 API) · 기록: 채널 리서치에서 뽑은 레벨 ${D.items.ladder.length}·판정 ${D.items.ledger.length}·일정 ${D.items.catalysts.length}·정정/이견 ${D.items.radar.length} · 투자 조언이 아닙니다.</footer>`;
}
export function onResize(fn) { let t; addEventListener('resize', () => { clearTimeout(t); t = setTimeout(fn, 120); }); }
