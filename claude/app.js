'use strict';
// 시장 기억장치 · Claude 판. 데이터는 data/*.json (tools/build.py가 만든다)
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const md = d => d ? d.slice(5).replace('-', '/') : '';
const WHO = { claude: 'Claude', gpt: 'GPT', user: '사용자' };
const KIND = { research: '리서치', followup: '팔로업', brief: '브리핑', answer: '답변', review: '검토', correction: '정정', kol: 'KOL 수집' };
const CAT = { P: '예측', S: '시나리오', W: '관찰', D: '설명', C: '복합', X: '서술' };
const RES = { H: '목표 도달', T: '조건 충족 · 목표 미도달', N: '조건 안 옴', I: '무효(지킴 조건 깨짐)', O: '유지 중', A: '이미 조건 상태', AH: '이미 조건 상태 · 목표 도달', U: '같은 봉 충돌(순서 불명)', '-': '채점 안 함', nodata: '가격 자료 없음' };
const LKIND = { low_high: '고저점', resistance: '저항', support: '지지', cost_basis: '원가', ma: '이동평균', liquidation: '청산', option: '옵션', other: '기타', thesis: 'THESIS' };
const SNAPKIND = new Set(['liquidation', 'option', 'support', 'resistance', 'cost_basis', 'other']);
const ST = s => /^(충족|충족 중|안 넘음)$/.test(s) ? 'ok' : s === '불충족' ? 'no' : /미확인/.test(s) ? 'unk' : /(걸림|근접)/.test(s) ? 'risk' : 'wait';
const ICON = { ok: '✓', no: '✕', unk: '?', risk: '!', wait: '…' };

let M, S, IT, NOW, IDX = 0, VN = 1, LIMIT = 30;
const L = id => (M.issues.find(i => i.id === id) || { label: id }).label;
const endOf = d => d + ' 23:59';
const known = (r, d) => !r.ts || r.ts <= endOf(d);
const pct = v => (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) < 10 ? 2 : 1) + '%';
const n0 = v => Math.round(v).toLocaleString('en-US');
const g = x => `<span class="g ${esc(x)}">${esc(x)}</span>`;
const srcs = a => (a || []).length ? `<span class="src" title="Discord 메시지 ID(근거)">근거 ${a.map(esc).join(' · ')}</span>` : '';

/* ---- 신선도: 손으로 쓴 문장이 실제로 언제 쓰였는지는 근거 Discord 메시지 ID(스노플레이크)에서 꺼낸다 ---- */
const HOUR = 36e5;
// ID 앞쪽 42비트가 2015-01-01부터의 밀리초다. 2^22로 나누면 되고, 숫자로 바꿀 때 생기는 오차(±256)는 1밀리초에 못 미친다
const snowT = id => { const n = Number(id); return /^\d{17,20}$/.test(String(id)) && isFinite(n) ? Math.floor(n / 4194304) + 1420070400000 : null; };
const srcT = a => { const t = (a || []).map(snowT).filter(Boolean); return t.length ? Math.max(...t) : null; };  // 근거 글 중 가장 나중 시각
const kstT = s => Date.parse(String(s).slice(0, 16).replace(' ', 'T') + ':00+09:00');
const z2 = n => String(n).padStart(2, '0');
const fmtT = t => { const d = new Date(t + 9 * HOUR); return `${d.getUTCMonth() + 1}/${d.getUTCDate()} ${z2(d.getUTCHours())}:${z2(d.getUTCMinutes())}`; };
const ago = t => { const h = (Date.now() - t) / HOUR; return h < 1 ? `${Math.max(1, Math.round(h * 60))}분 전` : h < 36 ? `${Math.round(h)}시간 전` : `${Math.round(h / 24)}일 전`; };
const STALE = { now: 24, issue: 72, focus: 72, thesis: 168 };  // 시간. 이보다 오래된 손 문장은 '오래된 문장'으로 표시한다
const isOld = (t, k) => t != null && Date.now() - t > STALE[k] * HOUR;
const age = (t, k, word = '작성') => t == null ? '' : `<span class="age${isOld(t, k) ? ' old' : ''}" title="근거 Discord 메시지가 올라온 시각(KST)에서 계산">${fmtT(t)} ${word} · ${ago(t)}${isOld(t, k) ? ' · 오래된 문장' : ''}</span>`;

async function boot() {
  const get = f => fetch('data/' + f, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  // "화면" 칸(lab)이 같은 파일을 다시 내려받지 않도록, 읽은 자료를 그대로 넘겨 준다
  [M, S, IT, NOW] = await (window.MM_RAW = Promise.all(['meta.json', 'snapshots.json', 'items.json', 'now.json'].map(get)));
  const sl = $('#slider'); sl.max = S.length - 1;
  readHash(); if (!(IDX >= 0 && IDX < S.length)) IDX = S.length - 1;
  sl.value = IDX;
  sl.addEventListener('input', () => go(+sl.value));
  $('#prev').onclick = () => go(IDX - 1); $('#next').onclick = () => go(IDX + 1); $('#latest').onclick = () => go(S.length - 1);
  document.addEventListener('keydown', e => { if (e.target.closest('input,select,textarea')) return; if (e.key === 'ArrowLeft') go(IDX - 1); if (e.key === 'ArrowRight') go(IDX + 1); });
  setupTheme(); setupNav(); render(); renderMtf();
}
/* ---- 구역 이동 띠: 긴 페이지에서 원하는 칸으로 바로 가고, 지금 보고 있는 칸을 표시한다 ---- */
function setupNav() {
  const nav = $('#secnav'); if (!nav) return;
  const links = [...nav.querySelectorAll('a[data-go]')], top = document.querySelector('.top'), row = nav.querySelector('.wrap');
  const headH = () => getComputedStyle(top).position === 'sticky' ? top.offsetHeight : 0;  // 좁은 화면에서는 머리가 고정되지 않는다
  const sync = () => document.documentElement.style.setProperty('--toph', headH() + 'px');
  sync(); addEventListener('resize', sync);
  if (window.ResizeObserver) new ResizeObserver(sync).observe(top);
  // 주소의 # 뒤는 날짜·화면 상태를 담는 데 쓰므로, 구역 이동은 주소를 바꾸지 않고 스크롤만 한다
  nav.addEventListener('click', e => {
    const a = e.target.closest('a[data-go]'); if (!a) return;
    e.preventDefault();
    const h = document.getElementById(a.dataset.go); if (!h) return;
    // 먼 칸은 바로 옮기고(긴 페이지를 훑으며 지나가지 않게), 가까운 칸만 부드럽게 옮긴다
    const jump = Math.abs(h.getBoundingClientRect().top) > innerHeight * 2 || matchMedia('(prefers-reduced-motion: reduce)').matches;
    h.scrollIntoView({ behavior: jump ? 'auto' : 'smooth', block: 'start' });
  });
  $('#pchip').onclick = () => go(S.length - 1);
  let tick = false;
  const mark = () => {
    tick = false;
    const y = headH() + nav.offsetHeight + 28; let on = links[0];
    for (const a of links) { const h = document.getElementById(a.dataset.go); if (h && h.getBoundingClientRect().top <= y) on = a; }
    links.forEach(a => { const v = a === on; a.classList.toggle('on', v); if (v) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });
    if (row.scrollWidth > row.clientWidth && (on.offsetLeft < row.scrollLeft || on.offsetLeft + on.offsetWidth > row.scrollLeft + row.clientWidth)) row.scrollTo({ left: Math.max(0, on.offsetLeft - 16), behavior: 'smooth' });
  };
  addEventListener('scroll', () => { if (!tick) { tick = true; requestAnimationFrame(mark); } }, { passive: true });
  mark();
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const d = h.get('d'); IDX = d ? S.findIndex(s => s.d === d) : S.length - 1;
  if (IDX < 0) IDX = S.length - 1;
  VN = Math.min(5, Math.max(1, parseInt(h.get('v'), 10) || 1));
}
function writeHash() {
  const h = new URLSearchParams();
  if (IDX !== S.length - 1) h.set('d', S[IDX].d);
  if (VN !== 1) h.set('v', VN);
  try { history.replaceState(null, '', h.toString() ? '#' + h : location.pathname); } catch (e) {}  // 주소를 못 바꾸는 환경에서도 화면은 그대로 움직인다
}
function go(i) { i = Math.max(0, Math.min(S.length - 1, i)); if (i === IDX) return; IDX = i; $('#slider').value = i; LIMIT = 30; render(); writeHash(); }
function setupTheme() {
  const root = document.documentElement; let t = null;
  try { t = localStorage.getItem('mm-theme'); } catch (e) {}
  if (t) root.dataset.theme = t;
  $('#theme').onclick = () => {
    const cur = root.dataset.theme || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    const nx = cur === 'dark' ? 'light' : 'dark'; root.dataset.theme = nx;
    try { localStorage.setItem('mm-theme', nx); } catch (e) {}
  };
}

function render() {
  const s = S[IDX], latest = IDX === S.length - 1;
  $('#dlabel').textContent = md(s.d) + (latest ? ' 최신' : '');
  $('#past').classList.toggle('on', !latest);
  $('#prev').disabled = IDX === 0; $('#next').disabled = latest;
  const pc = $('#pchip'); if (pc) { pc.hidden = latest; pc.textContent = `과거 판 ${md(s.d)} · 최신으로`; }
  renderFocus(s, latest); renderNow(s, latest); renderThesis(s, latest); renderCards(s, latest); renderWatch(s); renderChanges(s);
  renderMap(s); renderKol(s, latest); renderTabs(); renderViews(); renderRules(); renderFoot();
}

/* ---- 주목 3선 (사용자 지정 11/21) ---- */
const FOCUS_BORN = '2026-11-21';
function fState(f) {  // 지지선: 진행 중 봉의 지금 값 기준
  if (f.pct < 0) return ['no', '아래', '이번 봉이 지금 선 아래에 있습니다. 마감 전이라 판정은 아직입니다'];
  if (f.pct_low < 0) return ['risk', '장중 이탈', '장중엔 선 아래로 내려갔고, 지금은 위입니다'];
  if (f.pct < 3) return ['risk', '시험 중', '선 위 3% 안에서 버티고 있습니다'];
  return ['ok', '위', '선 위에 있습니다'];
}
function fChart(f, opt) {
  const W = 320, H = 132, P = { l: 4, r: 4, t: 10, b: 16 }, ser = f.series, n = ser.length;
  const lgs = opt.log, vals = ser.flatMap(r => [r[1], r[3]]).concat(opt.extra || []);
  const tf = v => lgs ? Math.log(v) : v;
  let lo = Math.min(...vals.map(tf)), hi = Math.max(...vals.map(tf)); const pad = (hi - lo) * .06; lo -= pad; hi += pad;
  const x = i => P.l + (W - P.l - P.r) * (n === 1 ? .5 : i / (n - 1)), y = v => P.t + (H - P.t - P.b) * (1 - (tf(v) - lo) / (hi - lo));
  const path = k => ser.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[k]).toFixed(1)}`).join('');
  const marks = (opt.marks || []).map(m => { const i = ser.findIndex(r => r[0] === m.d); return i < 0 ? '' : `<circle cx="${x(i).toFixed(1)}" cy="${y(m.v).toFixed(1)}" r="4" class="fk"><title>${esc(m.t)}</title></circle>`; }).join('');
  const yrs = []; ser.forEach((r, i) => { if (i && r[0].slice(0, 4) !== ser[i - 1][0].slice(0, 4)) yrs.push(`<line x1="${x(i)}" x2="${x(i)}" y1="${P.t}" y2="${H - P.b}" class="fy"/><text x="${x(i) + 3}" y="${H - 4}" class="ft">${r[0].slice(0, 4)}</text>`); });
  const last = ser[n - 1];
  return `<svg class="fchart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="${esc(opt.label)}">${yrs.join('')}
    <path d="${path(3)}" class="fl"/><path d="${path(1)}" class="fp"/>${marks}
    <circle cx="${x(n - 1).toFixed(1)}" cy="${y(last[1]).toFixed(1)}" r="4" class="fn"/>
    <line class="fx" x1="0" x2="0" y1="${P.t}" y2="${H - P.b}" style="display:none"/>
    <rect class="fhit" x="0" y="0" width="${W}" height="${H}" data-n="${n}"/></svg>`;
}
function fHover(box, f, unit) {
  const svg = box.querySelector('svg'); if (!svg) return; const hit = svg.querySelector('.fhit'), cx = svg.querySelector('.fx'), tip = $('#tip'), ser = f.series;
  const show = e => {
    const r = svg.getBoundingClientRect(), px = ((e.touches ? e.touches[0].clientX : e.clientX) - r.left) / r.width;
    const i = Math.max(0, Math.min(ser.length - 1, Math.round(px * (ser.length - 1)))), s = ser[i], X = 4 + 312 * (ser.length === 1 ? .5 : i / (ser.length - 1));
    cx.setAttribute('x1', X); cx.setAttribute('x2', X); cx.style.display = '';
    const d = (s[1] / s[3] - 1) * 100;
    tip.innerHTML = `${esc(s[0].slice(2).replace(/-/g, '/'))} 봉 시작<br>종가 ${fmtF(s[1], unit)} · 저가 ${fmtF(s[2], unit)}<br>선 ${fmtF(s[3], unit)} · 종가 대비 <b class="${d < 0 ? 'neg' : 'pos'}">${pct(d)}</b>`;
    tip.style.display = 'block'; tip.style.left = Math.max(8, Math.min(innerWidth - 270, r.left + px * r.width - 120)) + 'px'; tip.style.top = (r.bottom + 6) + 'px';
  };
  const hide = () => { tip.style.display = 'none'; cx.style.display = 'none'; };
  hit.addEventListener('mousemove', show); hit.addEventListener('touchstart', show, { passive: true }); hit.addEventListener('mouseleave', hide);
}
const fmtF = (v, u) => u === 'btc' ? n0(v) : v.toLocaleString('en-US', { maximumFractionDigits: 1 });
function fTable(f, unit) {
  return `<details class="drawer"><summary>숫자로 보기 · 최근 6봉</summary><div class="scrollx"><table class="tbl"><thead><tr><th>봉 시작</th><th>종가</th><th>선</th><th>대비</th></tr></thead><tbody>${f.series.slice(-6).map(r => { const d = (r[1] / r[3] - 1) * 100; return `<tr><td>${md(r[0])}</td><td>${fmtF(r[1], unit)}</td><td>${fmtF(r[3], unit)}</td><td class="${d < 0 ? 'neg' : 'pos'}">${pct(d)}</td></tr>`; }).join('')}</tbody></table></div></details>`;
}
// 본문 안에서 다른 칸을 가리키는 링크(data-jump): 주소는 그대로 두고 그 칸으로 스크롤만 한다
document.addEventListener('click', e => {
  const a = e.target.closest('a[data-jump]'); if (!a) return;
  e.preventDefault();
  const t = document.getElementById(a.dataset.jump); if (t) t.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
});
// 손으로 적은 메모 묶음: 언제 쓴 것인지 붙이고, 오래됐으면 흐리게 한다
function handBox(title, ageHtml, old, inner) {
  return `<div class="hand${old ? ' old' : ''}"><div class="handh">${esc(title)} ${ageHtml}</div>${inner}</div>`;
}
function fCard(no, f, C, unit, opt) {
  const [k, lab, why] = fState(f), tst = f.tests.map(x => `${md(x.d)} 저가 ${pct(x.dl)} · 종가 ${pct(x.dc)}`).join(' / ');
  const held = f.prev.pct >= 0;  // 수성 = 닫힌 봉의 종가가 선 위
  return `<article class="fcard"><div class="fh"><span class="fno">${no}</span><h3>${esc(C.name)}</h3><span class="st ${k}">${ICON[k]} ${esc(lab)}</span></div>
    <p class="fdef">${esc(C.def)}</p>
    <div class="fnum"><div><span>선</span><b class="num">${fmtF(f.line, unit)}</b></div><div><span>지금</span><b class="num">${fmtF(f.price, unit)}</b></div><div><span>대비</span><b class="num ${f.pct < 0 ? 'neg' : 'pos'}">${pct(f.pct)}</b></div></div>
    <p class="fprev"><span class="st ${held ? 'ok' : 'no'}">${held ? '✓ 직전 봉 수성' : '✕ 직전 봉 이탈'}</span><span>직전 ${esc(f.tf)}(${md(f.prev.d)} 시작)은 ${md(f.bar)} 09:00 KST에 종가 ${fmtF(f.prev.close, unit)}, 선 ${held ? '위' : '아래'} ${pct(f.prev.pct)}에서 닫혔습니다.</span></p>
    <p class="fwhy">${esc(why)}. 이번 ${esc(f.tf)}(${md(f.bar)} 시작, ${f.days}일째)은 <b>${esc(md(f.closes_at.slice(0, 10)))} 09:00 KST</b>에 닫힙니다. 장중 저가 ${fmtF(f.low, unit)}(${pct(f.pct_low)}).</p>
    ${fChart(f, opt)}
    <div class="fleg"><span class="lp">종가</span><span class="ll">선</span>${opt.marks ? '<span class="lk">기준 고가</span>' : ''}</div>
    <ul class="fmeta"><li>앞선 시험: ${esc(tst || '없음')}</li>${(C.notes || []).map(x => `<li>${esc(x)}</li>`).join('')}</ul>
    ${(C.hand || []).length ? handBox('손 메모', C.age, C.old, `<ul class="fmeta">${C.hand.map(x => `<li>${esc(x)}</li>`).join('')}</ul>`) : ''}
    ${fTable(f, unit)}</article>`;
}
function renderFocus(s, latest) {
  const el = $('#focus'), F = NOW.focus, C = NOW.curated.focus;
  if (!F || !C) { el.innerHTML = ''; return; }
  if (s.d < FOCUS_BORN) { el.innerHTML = `<p class="empty">이 칸은 ${md(FOCUS_BORN)}에 생겼습니다. 최신 판에서 보세요.</p>`; return; }
  if (!latest) { el.innerHTML = `<p class="empty">주목 3선은 최신 판에만 있습니다(봉이 아직 진행 중인 값이라).</p>`; return; }
  const b = F.btc, e = F.eth, u = C.usdt;
  const yy = d => d.slice(2).replace(/-/g, '/');
  // 숫자(선·지금·대비·시험 이력)는 사이트를 갱신할 때마다 다시 계산하고, 손 메모는 쓴 시각을 따로 붙인다
  const tF = srcT(C.src), hand = { age: age(tF, 'focus'), old: isOld(tF, 'focus') };
  // 세 선에 대한 더 나중 기록이 고정 사안 'thesis'에 쌓여 있으면 그쪽을 가리킨다
  const TI = (NOW.curated.issues || {}).thesis, tI = TI ? srcT(TI.src) : null;
  const later = tI && tF && tI > tF ? `<p class="fwhy">이 메모보다 나중에 쓴 기록이 아래 <a href="#thesis" data-jump="thesis">THESIS 사안 기록(${esc(fmtT(tI))})</a>에 있습니다.</p>` : '';
  const bNotes = [`${yy(b.a.d)} 봉 고가 ${n0(b.a.h)} → ${yy(b.b.d)} 봉 고가 ${n0(b.b.h)}, ${b.scale} 눈금으로 이은 선. 한 봉마다 ${b.step}%씩 내려갑니다`,
    `선형 눈금이면 지금 약 ${n0(b.line_lin)} · ${b.line_alt.name} 기준 ${n0(b.line_alt.v)}`];
  const eNotes = [`선은 한 봉마다 약 +${e.step}씩 올라갑니다 · ${e.line_alt.name} 기준 ${e.line_alt.v.toLocaleString('en-US')}`,
    `${md(e.first)} 이후 닫힌 10일봉 ${e.series.length - 1}개 중 선 아래 종가 ${e.below_closes}개`];
  el.innerHTML = `<p class="fintro">${esc(C.why)}</p><div class="focus3">
    ${fCard('①', b, Object.assign({}, C.btc, hand, { notes: bNotes, hand: C.btc.notes }), 'btc', { log: true, label: `BTCUSD 3일봉 종가와 사선(로그). 지금 ${n0(b.price)}, 선 ${n0(b.line)}`, marks: [{ d: b.a.d, v: b.a.h, t: '2024-03-13 봉 고가' }, { d: b.b.d, v: b.b.h, t: '2024-06-05 봉 고가' }], extra: [b.a.h, b.b.h] })}
    ${fCard('②', e, Object.assign({}, C.eth, hand, { notes: eNotes, hand: C.eth.notes }), 'eth', { log: false, label: `ETHUSD 10일봉 종가와 365SMA. 지금 ${e.price}, 선 ${e.line}` })}
    <article class="fcard"><div class="fh"><span class="fno">③</span><h3>${esc(u.name)}</h3><span class="st unk">${ICON.unk} ${esc(u.status)}</span></div>
      <p class="fdef">${esc(u.def)}</p>
      ${handBox('손으로 적은 관측', hand.age, hand.old, `<ul class="fmeta">${u.obs.map(x => `<li>${g(x.g)} ${esc(x.t)}</li>`).join('')}</ul>`)}
      ${later}
      <p class="fwhy">${esc(u.note)}</p></article>
  </div><div class="src" style="margin-top:8px">${esc(b.src)} · ${esc(e.src)} · ${esc(F.asof)} KST 계산 · ${srcs(C.src)}</div>`;
  fHover(el.querySelectorAll('.fcard')[0], b, 'btc'); fHover(el.querySelectorAll('.fcard')[1], e, 'eth');
}

/* ---- 고정 자리 1: 지금 ---- */
// 리서치 글을 20분 안쪽으로 이어진 묶음으로 나눈다(나중 묶음이 앞). 한 번의 질문에 이어진 답들이 한 묶음이 된다.
// 간격을 길게 잡으면(처음엔 45분) 질문이 연달아 나온 날에 여러 질문이 한 묶음으로 이어져, 맨 위에 가장 오래된 글이 나온다.
// 20분이면 GPT 답과 Claude 답 사이의 간격(보통 15분 안쪽)은 한 묶음으로 남고, 다음 질문은 대부분 새 묶음이 된다
const BUNDLE_GAP_MIN = 20;
function bundles(d) {
  const ps = IT.timeline.filter(p => p.kind !== 'kol' && known(p, d)).map(p => ({ p, t: kstT(p.ts) })).sort((a, b) => a.t - b.t);
  const out = []; let cur = null;
  for (const x of ps) {
    if (!cur || x.t - cur.t1 > BUNDLE_GAP_MIN * 6e4) { cur = { t0: x.t, t1: x.t, posts: [] }; out.push(cur); }
    cur.posts.push(x.p); cur.t1 = x.t;
  }
  return out.reverse();
}
// more: 접어 두는 앞선 묶음 목록(제목만, 첫 줄을 크게 하지 않는다)
function feedHtml(bs, more) {
  return `<ul class="feed${more ? ' more' : ''}">${bs.map((b, k0) => {
    const k = more ? 1 : k0;
    const lead = b.posts.find(p => p.who === 'claude' && /^(research|followup|brief)$/.test(p.kind)) || b.posts[0], tail = b.posts[b.posts.length - 1];
    const cnt = {}; b.posts.forEach(p => p.iss.forEach(i => { cnt[i] = (cnt[i] || 0) + 1; }));
    const top = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x]).slice(0, 2);
    const t0 = fmtT(b.t0), t1 = fmtT(b.t1), span = b.t1 - b.t0 < 6e4 ? t0 : t0.split(' ')[0] === t1.split(' ')[0] ? t0 + '~' + t1.split(' ')[1] : t0 + ' ~ ' + t1;
    return `<li><div class="fm"><b class="num">${span}</b><span>글 ${b.posts.length}개</span>${top.map(i => `<span class="chip">${esc(L(i))}</span>`).join('')}</div>
      <div class="ft1">${esc(lead.title)}</div>
      ${k === 0 ? `<div class="fg">${g(lead.g)}${esc(lead.gist)}</div>` : ''}
      ${k === 0 && tail !== lead ? `<div class="fl2"><span class="w">이 묶음의 마지막 글 ${t1.split(' ')[1]}</span> ${esc(tail.title)}</div>` : ''}
      <div class="src">근거 ${esc(lead.src)}</div></li>`;
  }).join('')}</ul>`;
}
function renderNow(s, latest) {
  const el = $('#now'), bs = bundles(s.d);
  const ref = latest ? Date.now() : Date.parse(s.d + 'T23:59:00+09:00');
  // 앞의 네 묶음을 펼치고, 48시간 안의 나머지 묶음은 접어 둔다
  const recent = bs.filter(b => ref - b.t1 < 48 * HOUR), all = recent.length ? recent : bs.slice(0, 1);
  const feed = all.slice(0, 4), rest = all.slice(4, 16);
  const feedBox = feedHtml(feed) + (rest.length ? `<details class="drawer fold" style="margin-top:10px"><summary>앞선 묶음 ${rest.length}개</summary>${feedHtml(rest, true)}</details>` : '');
  if (!latest) {
    el.innerHTML = `<div class="slotlabel">그 날 밤 기준 최근 리서치 · 묶음 ${feed.length + rest.length}개</div>` + (feed.length ? feedBox : '<p class="empty">이 날짜까지 리서치 글이 없습니다.</p>');
    return;
  }
  const c = NOW.curated.now, tN = srcT(c.src), old = isOld(tN, 'now');
  const hand = `<p class="headline${c.headline.length > 110 ? ' long' : ''}">${esc(c.headline)}</p>
      <ul class="pts">${c.points.map(p => `<li>${g(p.g)}<span>${esc(p.t)}</span></li>`).join('')}</ul>
      <div class="unv"><b>확인 못 한 것</b><ul class="pts" style="margin-top:4px">${c.unverified.map(u => `<li>${g('미확인')}<span>${esc(u)}</span></li>`).join('')}</ul></div>
      <div style="margin-top:8px">${srcs(c.src)}</div>`;
  const newer = tN == null ? [] : bs.filter(b => b.t0 > tN + 30 * 6e4);
  if (old || tN == null) {
    // 손 문장이 하루 넘게 그대로면, 이 칸은 최근 리서치 묶음을 앞에 세우고 손 문장은 날짜를 붙여 접어 둔다
    el.innerHTML = `<div class="slotlabel">지금 · 최근 48시간 리서치에서 자동으로 뽑음 · 사이트 갱신 ${esc(M.built)} KST</div>
      ${feed.length ? feedBox : '<p class="empty">리서치 글이 없습니다.</p>'}
      <details class="drawer stale"><summary>손으로 쓴 '지금' 문장 ${age(tN, 'now')}</summary>
        <p class="why2" style="margin:8px 0">이 문장은 ${tN == null ? '쓴 시각을 알 수 없는' : esc(fmtT(tN)) + ' KST 기준의'} 기록입니다. 그 뒤로 리서치 묶음 ${newer.length}개가 더 들어왔습니다.</p>${hand}</details>`;
    return;
  }
  el.innerHTML = `<div class="slotlabel">지금 ${age(tN, 'now')} · 사이트 갱신 ${esc(M.built)} KST</div>${hand}
    ${newer.length ? `<div class="unv"><b>이 문장 뒤에 들어온 리서치</b>${feedHtml(newer.slice(0, 3))}</div>` : ''}`;
}

/* ---- 손 문장 공통: 이어 붙인 해석을 날짜별 항목으로 나누고, 조건은 앞의 몇 개만 먼저 보인다 ---- */
function splitView(text) {
  return String(text || '').split(' / ').filter(x => x.trim()).map(p => {
    const m = p.match(/^(\d{1,2}\/\d{1,2}(?:~\d{1,2}\/\d{1,2})?(?: (?:\d{1,2}:\d{2}|새벽|아침|오전|낮|오후|저녁|밤))?)[:\s]\s*/);
    return m ? { d: m[1], t: p.slice(m[0].length) } : { d: '', t: p };
  });
}
function viewHtml(cur, keep = 2) {
  const es = splitView(cur.view);
  if (es.length <= 1) return `<p class="view">${g(cur.g)}${esc(cur.view)}</p>`;
  const li = e => `<li><b class="vd num">${esc(e.d || '앞선 기록')}</b><span>${esc(e.t)}</span></li>`;
  return `<div class="viewl">${g(cur.g)}<ul class="vlist">${es.slice(0, keep).map(li).join('')}</ul></div>
    ${es.length > keep ? `<details class="drawer fold"><summary>앞선 기록 ${es.length - keep}개</summary><ul class="vlist">${es.slice(keep).map(li).join('')}</ul></details>` : ''}`;
}
const DONE = /^(지남|없어짐)$/;  // 끝난 조건은 접힌 쪽으로 보낸다
function condHtml(list, keep = 4) {
  // 형식이 틀린 항목(글자만 적힌 조건)도 버리지 않고 '대기' 조건으로 보인다
  const cs = (list || []).map(c => typeof c === 'string' ? { t: c, s: '대기' } : c).filter(c => c && (c.t || c.s));
  if (!cs.length) return '';
  const li = c => { const k = ST(c.s); return `<li><span class="st ${k}">${ICON[k]} ${esc(c.s || '대기')}</span><span>${esc(c.t)}</span>${c.n ? `<span class="n">${esc(c.n)}</span>` : ''}</li>`; };
  const live = cs.filter(c => !DONE.test(c.s)), done = cs.filter(c => DONE.test(c.s));
  const head = live.slice(0, keep), rest = live.slice(keep).concat(done);
  return `${head.length ? `<ul class="cond">${head.map(li).join('')}</ul>` : ''}
    ${rest.length ? `<details class="drawer fold"><summary>조건 ${rest.length}개 더${done.length ? ` (지난 것 ${done.length}개 포함)` : ''}</summary><ul class="cond">${rest.map(li).join('')}</ul></details>` : ''}`;
}

/* ---- 고정 자리 2: THESIS ---- */
// 기준선 대비 위치를 가격 원자료에서 다시 계산한다(손으로 쓴 조건 문장이 낡아도 이 숫자는 갱신 때마다 새로 나온다)
function thGauges(T) {
  const run = rows => { const neg = rows[rows.length - 1].pct < 0; let n = 0; for (let i = rows.length - 1; i >= 0 && (rows[i].pct < 0) === neg; i--) n++; return n; };
  const d = T.daily, w = T.weekly; if (!d.length || !w.length) return '';
  const dl = d[d.length - 1], wl = w[w.length - 1], dn = run(d), wn = run(w);
  const m = (T.btc_live / T.m48_live - 1) * 100, side = v => v < 0 ? '아래' : '위';
  const cnt = (n, all, unit) => n >= all ? `최근 ${n}${unit} 모두` : `${n}${unit}째`;
  const tile = (name, v, sub) => `<div><span>${name}</span><b class="num ${v < 0 ? 'neg' : 'pos'}">${pct(v)}</b><small>${sub}</small></div>`;
  return `<div class="gauges" role="group" aria-label="가격 원자료로 다시 계산한 기준선 대비 위치">
    ${tile('BTC 일봉 · 4년선', dl.pct, `${cnt(dn, d.length, '봉')} ${side(dl.pct)} · ${md(dl.bar)} 종가`)}
    ${tile('BTC 주봉 · 208주선', wl.pct, `${cnt(wn, w.length, '주')} ${side(wl.pct)} 마감 · ${md(wl.bar)} 주`)}
    ${tile('BTC 월봉 · 48개월선', m, `이번 달 진행 중 · 선 ${n0(T.m48_live)}`)}
    ${tile('ETH 종가 · 9년선', T.eth.pct, `${md(T.eth.bar)} 종가 · 선 ${n0(T.eth.line)}`)}</div>
    <p class="why2" style="margin:6px 0 10px">위 네 칸은 가격 원자료로 다시 계산한 값입니다(${esc(T.asof)} KST). 아래 조건 문장과 다르면 이 숫자가 더 새로운 값입니다.</p>`;
}
function renderThesis(s, latest) {
  const T = NOW.thesis, C = NOW.curated.thesis, el = $('#thesis');
  // 주봉은 시작일에서 7일 뒤(월요일 09:00 KST)에 닫히므로, 그 날까지 실제로 닫힌 주만 보인다
  const closed7 = r => new Date(Date.parse(r.bar + 'T00:00:00Z') + 7 * 864e5).toISOString().slice(0, 10) <= s.d;
  const daily = T.daily.filter(r => r.bar < s.d), weekly = T.weekly.filter(closed7);
  const born = '2026-11-10';
  if (s.d < born) { el.innerHTML = `<div class="slotlabel">THESIS 계기판</div><p class="empty">이 날짜에는 아직 THESIS가 없었습니다. 첫 가설은 11/10(USDT.D), 지금 판은 11/15에 나왔습니다.</p>`; return; }
  const rowsD = daily.slice(-6).map(r => `<tr><td>${md(r.bar)}</td><td>${n0(r.close)}</td><td>${n0(r.line)}</td><td class="${r.pct < 0 ? 'neg' : 'pos'}">${pct(r.pct)}</td></tr>`).join('');
  const rowsW = weekly.slice(-3).map(r => `<tr><td>${md(r.bar)} 주</td><td>${n0(r.close)}</td><td>${n0(r.line)}</td><td class="${r.pct < 0 ? 'neg' : 'pos'}">${pct(r.pct)}</td></tr>`).join('');
  const alts = T.alts.map(a => { const r = a.rows.filter(x => x.bar < s.d).slice(-1)[0]; return r ? `<tr><td>${esc(a.sym)}</td><td class="${r.pct < 0 ? 'neg' : ''}">${pct(r.pct)}</td><td>${md(r.bar)}</td></tr>` : ''; }).join('');
  const idea = s.d < '2026-11-15' ? '11/10 사용자 가설: USDT.D 같은 도미넌스 지표가 주요 지지·저항에 닿았다는 읽기. 지금의 THESIS(11/15)는 아직 나오기 전입니다.' : C.idea;
  // 고정 사안 'thesis'에 쌓인 손 기록(사용자 갱신 등)은 주요 자리에 오르지 않으므로 이 칸에서 보인다
  const TI = (NOW.curated.issues || {}).thesis, tC = srcT(C.src);
  const rec = latest && TI && TI.view ? handBox('THESIS 사안 기록', age(srcT(TI.src), 'issue'), false,
    viewHtml(TI, 1) + ((TI.cond || []).length ? `<details class="drawer fold"><summary>이 기록에 딸린 조건 ${TI.cond.length}개</summary>${condHtml(TI.cond, 99)}</details>` : '')) : '';
  el.innerHTML = `<div class="slotlabel">THESIS 계기판 · 사용자 판단 틀</div>
    <p class="view" style="margin:0 0 10px">${esc(idea)}</p>
    ${latest ? thGauges(T) + handBox('조건 판정 · 손으로 쓴 문장', age(tC, 'thesis'), isOld(tC, 'thesis'), condHtml(C.cond, 99)) + rec
      : '<p class="why2" style="margin:0">조건 판정은 최신 판에만 있습니다. 아래 표는 그 날까지 닫힌 봉만 보여 줍니다.</p>'}
    <div class="tgrid">
      <div class="scrollx"><table class="tbl"><caption class="sr">BTC 4년선 대비 종가</caption><thead><tr><th>BTC 일봉</th><th>종가</th><th>4년선</th><th>대비</th></tr></thead><tbody>${rowsD || '<tr><td colspan=4>—</td></tr>'}</tbody>
        <thead><tr><th>주봉</th><th>종가</th><th>208주</th><th>대비</th></tr></thead><tbody>${rowsW}</tbody></table></div>
      <div class="scrollx"><table class="tbl"><caption class="sr">알트 7종 365일선 대비</caption><thead><tr><th>알트 7종</th><th>365선</th><th>종가일</th></tr></thead><tbody>${alts}</tbody></table></div>
    </div>
    ${latest ? `<details class="drawer" style="margin-top:10px"><summary>반대 근거 ${C.against.length}개</summary><ul class="against">${C.against.map(a => `<li>${esc(a)}</li>`).join('')}</ul></details>` : ''}
    <div class="src" style="margin-top:8px">${esc(T.src)} · ${esc(T.asof)} KST · USDT.D는 TradingView 값이라 이 사이트가 받지 않습니다</div>`;
}

/* ---- 주요 자리 ---- */
function prevOrder(i) { const p = S[i - 1]; return p ? p.major.concat(p.rest) : null; }
function scoreBar(sc, max) {
  const w = v => Math.max(0, v / max * 100).toFixed(1) + '%';
  return `<div class="barrow" title="언급 ${sc.m.toFixed(2)} · 질문 ${sc.q.toFixed(2)} · 가격 ${sc.p.toFixed(2)} · 미결 ${sc.o.toFixed(2)}"><div class="bar" role="img" aria-label="점수 ${sc.s.toFixed(1)}: 언급 ${sc.m.toFixed(1)}, 질문 ${sc.q.toFixed(1)}, 가격 ${sc.p.toFixed(1)}, 미결 ${sc.o.toFixed(1)}"><i class="m" style="width:${w(sc.m)}"></i><i class="q" style="width:${w(sc.q)}"></i><i class="p" style="width:${w(sc.p)}"></i><i class="o" style="width:${w(sc.o)}"></i></div><span class="sc num">${sc.s.toFixed(1)}</span></div>`;
}
function deltaOf(id, pos) {
  const po = prevOrder(IDX); if (!po) return '';
  const k = po.indexOf(id); if (k < 0) return '<span class="delta new">새</span>';
  const d = k - pos; return d > 0 ? `<span class="delta up">▲${d}</span>` : d < 0 ? `<span class="delta down">▼${-d}</span>` : '';
}
function linkedPosts(id, d) {
  // 그 사안이 제목·요지에 직접 나온 글을 앞에, 태그만 걸린 글을 뒤에
  const all = IT.timeline.filter(p => p.iss.includes(id) && known(p, d));
  const direct = all.filter(p => (p.rel || []).includes(id)).slice(-5);
  const rest = 5 - direct.length > 0 ? all.filter(p => !direct.includes(p)).slice(-(5 - direct.length)) : [];
  return direct.concat(rest).sort((a, b) => b.ts.localeCompare(a.ts));
}
function bestPost(id, posts) { return posts.find(p => (p.rel || []).includes(id)) || posts[0]; }
function countIn(view, id, d, days) {
  const lo = new Date(new Date(d + 'T23:59:00+09:00').getTime() - days * 864e5);
  return IT[view].filter(r => r.iss.includes(id) && known(r, d) && (!r.ts || new Date(r.ts.replace(' ', 'T') + ':00+09:00') > lo)).length;
}
function renderCards(s, latest) {
  const all = s.major.concat(s.rest), max = Math.max(...all.map(i => s.sc[i].s), 1);
  $('#majsub').textContent = `${s.major.length}자리 · 이틀 연속 ${M.kmaj}위 안에 들어야 올라오고, 이틀 연속 밖이면 내려갑니다`;
  $('#cards').innerHTML = s.major.map((id, n) => {
    const sc = s.sc[id], meta = M.issues.find(i => i.id === id), cur = latest && NOW.curated.issues[id];
    const posts = linkedPosts(id, s.d), last = posts.length ? bestPost(id, posts) : null;
    // 해석은 가장 새로운 두 항목만 펼치고, 앞선 기록과 남은 조건은 접어 둔다
    const body = cur
      ? viewHtml(cur) + condHtml(cur.cond)
      : last ? `<p class="view">${g(last.g)}<span class="w" style="color:var(--ink-3);font-size:12px">${md(last.ts.slice(0, 10))} ${WHO[last.who] || ''} · </span>${esc(last.gist)}</p>` : '<p class="view empty">근거 글 없음</p>';
    const ch = s.ch.find(c => c.i === id && (c.t === '올라옴' || c.t === '보류'));
    return `<article class="card" id="card-${id}">
      <div class="c1"><span class="rank">${n + 1}</span><h3>${esc(meta.label)} <span class="kind">${esc(meta.kind)}</span></h3>${deltaOf(id, n)}<span class="chip ${s.status[id]}">${esc(s.status[id])}</span></div>
      ${scoreBar(sc, max)}
      ${body}
      <div class="cmeta">${cur ? `<span>해석 ${age(srcT(cur.src), 'issue')}</span>` : ''}<span>근거 글 7일 ${sc.ev}건</span><span>질문 7일 ${sc.qn}번</span>${sc.kol > 0.5 ? '<span class="weak">근거가 주장(KOL) 위주</span>' : sc.kol > 0.25 ? `<span>주장 비중 ${Math.round(sc.kol * 100)}%</span>` : ''}${ch ? `<span>오늘: ${esc(ch.why)}</span>` : ''}</div>
      ${s.suggest.includes(id) ? `<div class="sugg">같은 사안 질문이 7일 안에 ${sc.qn}번 → 고정 자리로 둘지 제안합니다</div>` : ''}
      ${drawer(id, s.d, posts)}
    </article>`;
  }).join('');
}
function drawer(id, d, posts) {
  const cnt = v => countIn(v, id, d, 7);
  return `<details class="drawer"><summary>근거 서랍 · 최근 글 ${posts.length}개</summary>
    <ul class="ev">${posts.map(p => `<li><span class="who ${p.who}">${WHO[p.who] || p.who}</span> <span class="t">${esc(p.title)}</span> ${g(p.g)}<br><span class="w">${esc(p.ts)} · ${KIND[p.kind] || p.kind} · 근거 ${esc(p.src)}</span><br>${esc(p.gist)}</li>`).join('') || '<li class="empty">없음</li>'}</ul>
    <div class="jump"><button class="btn" data-i="${id}">이 사안 이야기 보기 (판정 ${cnt('ledger')} · 가격선 ${cnt('ladder')} · 정정 ${cnt('radar')} · 일정 ${cnt('catalysts')})</button></div>
  </details>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.jump .btn, .wi'); if (!b) return;
  if (window.MMV) window.MMV.pick(b.dataset.i);
  setView(3); $('#h-views').scrollIntoView({ behavior: 'smooth' });
});

/* ---- 관찰 ---- */
function renderWatch(s) {
  const max = Math.max(...s.major.concat(s.rest).map(i => s.sc[i].s), 1);
  $('#watch').innerHTML = s.rest.map((id, n) => {
    const sc = s.sc[id];
    return `<button class="wi" data-i="${id}"><span class="num" style="color:var(--ink-3);min-width:18px">${n + s.major.length + 1}</span><span class="nm">${esc(L(id))}</span>${deltaOf(id, n + s.major.length)}<span class="chip ${s.status[id].split(' ')[0]}">${esc(s.status[id])}</span><span class="bar" aria-hidden="true"><i class="m" style="width:${(sc.s / max * 100).toFixed(0)}%;background:var(--ink-3)"></i></span></button>`;
  }).join('') || '<p class="empty">없음</p>';
}

/* ---- 변경 기록 ---- */
function chgLine(c) { return `<li><span class="k ${c.t}">${c.t}</span><span>${esc(L(c.i))}</span><span class="why">${esc(c.why)}</span></li>`; }
function renderChanges(s) {
  const big = s.ch.filter(c => c.t !== '상태'), small = s.ch.filter(c => c.t === '상태');
  const older = S.slice(Math.max(0, IDX - 7), IDX).reverse().map(x => ({ d: x.d, ch: x.ch.filter(c => c.t === '올라옴' || c.t === '내려감') })).filter(x => x.ch.length);
  $('#changes').innerHTML = `${big.length ? `<ul class="chg">${big.map(chgLine).join('')}</ul>` : '<p class="empty" style="padding:0">주요 자리 변동 없음. 순서만 점수대로 움직였습니다.</p>'}
    ${small.length ? `<ul class="chg" style="margin-top:8px">${small.map(chgLine).join('')}</ul>` : ''}
    ${older.length ? `<details class="older"><summary>앞선 7일의 자리 변동</summary><ul class="chg" style="margin-top:6px">${older.map(x => x.ch.map(c => `<li><span class="num" style="color:var(--ink-3);min-width:40px">${md(x.d)}</span><span class="k ${c.t}">${c.t}</span><span>${esc(L(c.i))}</span><span class="why">${esc(c.why)}</span></li>`).join('')).join('')}</ul></details>` : ''}`;
}

/* ---- 지형도 ---- */
function renderMap(s) {
  const ids = s.major.concat(s.rest).concat(M.issues.filter(i => !i.fixed && !s.major.includes(i.id) && !s.rest.includes(i.id)).map(i => i.id));
  const gmax = Math.max(...S.flatMap(x => Object.entries(x.sc).filter(([k]) => k !== 'thesis').map(([, v]) => v.s)), 1);
  const lvl = v => v <= 0.05 ? 0 : Math.min(6, Math.ceil(Math.sqrt(v / gmax) * 6));
  const el = $('#map'); el.style.gridTemplateColumns = `auto repeat(${S.length},22px)`;
  let h = '<div class="lab"></div>' + S.map((x, k) => `<button class="dh ${k === IDX ? 'sel' : ''}${k === S.length - 1 ? ' last' : ''}" data-k="${k}" aria-label="${x.d} 판 보기">${(k % 4 === 0 && S.length - 1 - k >= 3) || k === S.length - 1 ? md(x.d) : ''}</button>`).join('');
  for (const id of ids) {
    h += `<div class="lab">${esc(L(id))}</div>` + S.map((x, k) => {
      const v = x.sc[id] ? x.sc[id].s : 0, maj = x.major.includes(id);
      return `<button class="cell ${maj ? 'maj' : ''} ${k === IDX ? 'sel' : ''}" style="background:var(--h${lvl(v)})" data-k="${k}" data-tip="${esc(md(x.d))} · ${esc(L(id))}<br>점수 ${v.toFixed(1)}${maj ? ' · 주요 자리' : ''}" aria-label="${x.d} ${esc(L(id))} 점수 ${v.toFixed(1)}${maj ? ' 주요 자리' : ''}"></button>`;
    }).join('');
  }
  el.innerHTML = h;
  el.querySelectorAll('[data-k]').forEach(b => b.onclick = () => go(+b.dataset.k));
  $('#mapleg').innerHTML = '낮음 ' + [0, 1, 2, 3, 4, 5, 6].map(k => `<span class="cell" style="background:var(--h${k})"></span>`).join('') + ' 높음 · <span class="cell maj" style="background:var(--h0)"></span> 주요 자리';
  const tip = $('#tip');
  el.querySelectorAll('.cell').forEach(c => {
    const show = e => { tip.innerHTML = c.dataset.tip; tip.style.display = 'block'; const r = c.getBoundingClientRect(); tip.style.left = Math.min(innerWidth - 270, r.left) + 'px'; tip.style.top = (r.bottom + 6) + 'px'; };
    c.onmouseenter = show; c.onfocus = show; c.onmouseleave = c.onblur = () => tip.style.display = 'none';
  });
}

/* ---- KOL 수집 결과 ---- */
let KOL = null, KQ = { who: '', a: '', st: '', n: 30 };
const STC = { 강세: 'kup', 약세: 'kdn', 혼합: 'kmx', 중립: 'knt', 불명: 'knt' };
async function renderKol(s, latest) {
  const el = $('#kol');
  if (!KOL) { try { const r = await fetch('data/kol.json', { cache: 'no-cache' }); if (!r.ok) throw 0; KOL = await r.json(); } catch (e) { el.innerHTML = '<p class="empty">KOL 자료를 아직 만들지 못했습니다.</p>'; return; } }
  const all = KOL.items.filter(r => !r.src_ts || r.src_ts.slice(0, 10) <= s.d);
  const days = [...new Set(KOL.btc.map(b => b[0]).filter(d => d <= s.d))];
  const by = {}; for (const r of all) { const d = (r.src_ts || '').slice(0, 10); (by[d] ||= {})[r.stance] = ((by[d] || {})[r.stance] || 0) + 1; }
  const stN = k => all.filter(r => r.stance === k).length;
  // 사람별
  const who = r => r.handle || r.name || '이름 없음';
  const ppl = {}; for (const r of all) { const p = (ppl[who(r)] ||= { h: who(r), x: !!r.handle, name: r.handle ? r.name : null, n: 0, st: {}, a: {}, last: '' }); p.n++; p.st[r.stance] = (p.st[r.stance] || 0) + 1; for (const x of r.assets || []) p.a[x] = (p.a[x] || 0) + 1; if ((r.src_ts || '') > p.last) p.last = r.src_ts || ''; if (r.handle && r.name && !p.name) p.name = r.name; }
  const prof = Object.fromEntries((KOL.profiles || []).map(p => [p.handle || p.name, p]));
  const people = Object.values(ppl).sort((a, b) => b.n - a.n || b.last.localeCompare(a.last));
  const assets = Object.entries(all.reduce((m, r) => { for (const x of r.assets || []) m[x] = (m[x] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 10);
  const rows = all.filter(r => (!KQ.who || who(r) === KQ.who) && (!KQ.a || (r.assets || []).includes(KQ.a)) && (!KQ.st || r.stance === KQ.st)).sort((a, b) => (b.src_ts || '').localeCompare(a.src_ts || ''));
  $('#kolsub').textContent = `우리 리서치가 인용한 X 글 ${all.length}개 · ${people.length}명 · 요지는 우리말 요약, 원문은 링크 · 숫자는 그 사람의 주장`;
  // 날짜별 성향 막대 + BTC 종가 (두 그림, 같은 x)
  const W = 560, H1 = 92, H2 = 46, n = days.length || 1, bw = (W - 8) / n;
  const mx = Math.max(1, ...days.map(d => Object.values(by[d] || {}).reduce((a, b) => a + b, 0)));
  let bars = `<svg viewBox="0 0 ${W} ${H1}" class="kbar" role="img" aria-label="날짜별 인용된 KOL 글 성향">`;
  days.forEach((d, i) => { let y = H1 - 14; for (const k of ['강세', '혼합', '중립', '불명', '약세']) { const v = (by[d] || {})[k] || 0; if (!v) continue; const h = v / mx * (H1 - 20); y -= h; bars += `<rect class="${STC[k]}" x="${4 + i * bw}" y="${y}" width="${Math.max(1, bw - 2)}" height="${Math.max(1, h - 1)}"><title>${md(d)} ${k} ${v}</title></rect>`; } if (i % 7 === 0) bars += `<text x="${4 + i * bw}" y="${H1 - 2}">${md(d)}</text>`; });
  bars += '</svg>';
  const bv = KOL.btc.filter(b => b[0] <= s.d).map(b => b[1]), lo = Math.min(...bv), hi = Math.max(...bv);
  const line = `<svg viewBox="0 0 ${W} ${H2}" class="kbtc" role="img" aria-label="BTC 일봉 종가"><path d="${bv.map((v, i) => `${i ? 'L' : 'M'}${(4 + i * bw + bw / 2).toFixed(1)},${(4 + (hi - v) / (hi - lo || 1) * (H2 - 10)).toFixed(1)}`).join('')}"/><text x="${W - 4}" y="12" text-anchor="end">BTC ${n0(bv[bv.length - 1] || 0)}</text></svg>`;
  const stBar = st => { const t = Object.values(st).reduce((a, b) => a + b, 0) || 1; return `<span class="kst">${['강세', '혼합', '중립', '불명', '약세'].map(k => st[k] ? `<i class="${STC[k]}" style="width:${st[k] / t * 100}%" title="${k} ${st[k]}"></i>` : '').join('')}</span>`; };
  const lv = l => `${esc(l.asset || '')} ${typeof l.price === 'number' ? fmtP(l.price) : esc(l.price)}${l.role ? ' ' + esc(l.role) : ''}`;
  el.innerHTML = `<div class="kgrid"><div class="panel"><div class="kh"><b>날짜별 인용된 글의 성향</b><span class="kleg"><span><i class="kup"></i>강세 ${stN('강세')}</span><span><i class="kmx"></i>혼합 ${stN('혼합')}</span><span><i class="knt"></i>중립·불명 ${stN('중립') + stN('불명')}</span><span><i class="kdn"></i>약세 ${stN('약세')}</span></span></div>${bars}${line}
    <p class="mute" style="font-size:12px;margin:4px 0 0">위: 그날 우리 리서치가 인용한 KOL 글 수(성향별). 아래: 같은 날짜의 BTC 종가. 인용 수는 우리가 얼마나 찾아봤는지에 따라 달라지므로 시장 전체 여론이 아닙니다.</p></div>
    <div class="panel"><b style="font-size:14px">자주 인용한 사람</b><ul class="kpl">${people.slice(0, 12).map(p => `<li><button type="button" class="kp ${KQ.who === p.h ? 'on' : ''}" data-who="${esc(p.h)}"><span class="hn">${esc(p.h)}${p.name ? ` <span class="mute">${esc(p.name)}</span>` : ''}</span><span class="nn">${p.n}</span>${stBar(p.st)}<span class="fc">${esc((prof[p.h] || {}).focus || Object.keys(p.a).slice(0, 3).join(' · '))}</span></button></li>`).join('')}</ul></div></div>
    <div class="filters" style="margin-top:12px"><span>종목</span>${['', ...assets.map(a => a[0])].map(a => `<button type="button" class="fchip ${KQ.a === a ? 'on' : ''}" data-ka="${esc(a)}">${a ? esc(a) : '전체'}</button>`).join('')}
    <span style="margin-left:8px">성향</span>${['', '강세', '약세', '혼합', '중립'].map(k => `<button type="button" class="fchip ${KQ.st === k ? 'on' : ''}" data-kst="${k}">${k || '전체'}</button>`).join('')}
    ${KQ.who ? `<button type="button" class="fchip on" data-who="">${esc(KQ.who)} ✕</button>` : ''}<span class="mute">${rows.length}개</span></div>
    <ul class="kfeed">${rows.slice(0, KQ.n).map(r => `<li><div class="km"><span class="kd">${esc((r.src_ts || '').slice(5, 16))}</span>${r.handle ? `<a href="https://x.com/${esc(r.handle.replace(/^@/, ''))}" target="_blank" rel="noopener noreferrer">${esc(r.handle)}</a>${r.name ? ` <span class="mute">${esc(r.name)}</span>` : ''}` : `<b>${esc(r.name || '이름 없음')}</b>`}<span class="ks ${STC[r.stance] || 'knt'}">${esc(r.stance)}</span>${(r.assets || []).map(a => `<span class="chip">${esc(a)}</span>`).join('')}${r.likes ? `<span class="mute">♥ ${r.likes}</span>` : ''}</div>
      <div class="kc">${r.topic ? `<b>${esc(r.topic)}</b> · ` : ''}${esc(r.claim)}</div>
      ${(r.levels || []).filter(l => l.role !== '목표 주장').length ? `<div class="kl">그 사람이 든 가격(주장): ${r.levels.filter(l => l.role !== '목표 주장').map(lv).join(' · ')}</div>` : ''}
      <div class="kx">${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">X 원문</a> · ` : ''}${srcs(r.src)}</div></li>`).join('') || '<li class="empty">조건에 맞는 글이 없습니다.</li>'}</ul>
    ${rows.length > KQ.n ? `<button class="btn more" type="button" id="kmore">더 보기 (남은 ${rows.length - KQ.n})</button>` : ''}`;
  el.querySelectorAll('[data-who]').forEach(b => b.onclick = () => { KQ.who = KQ.who === b.dataset.who ? '' : b.dataset.who; KQ.n = 30; renderKol(S[IDX], IDX === S.length - 1); });
  el.querySelectorAll('[data-ka]').forEach(b => b.onclick = () => { KQ.a = b.dataset.ka; KQ.n = 30; renderKol(S[IDX], IDX === S.length - 1); });
  el.querySelectorAll('[data-kst]').forEach(b => b.onclick = () => { KQ.st = b.dataset.kst; KQ.n = 30; renderKol(S[IDX], IDX === S.length - 1); });
  if ($('#kmore')) $('#kmore').onclick = () => { KQ.n += 30; renderKol(S[IDX], IDX === S.length - 1); };
}

/* ---- MTF 50선 (v12.1 스크리너와 같은 계산, 최신만) ---- */
let MTF = null, MQ = { all: false, ref: false };
const MTFC = { A: '판정 · 위', B: '판정 · 아래', a: '참고 · 위', b: '참고 · 아래', '.': '봉 12개 미만' };
async function loadMtf() {
  if (MTF) return MTF;
  const r = await fetch('data/mtf50.json', { cache: 'no-cache' }); if (!r.ok) throw new Error('mtf50.json');
  return (MTF = await r.json());
}
function fmtP(v) { if (v == null) return '—'; const a = Math.abs(v); return a >= 1000 ? n0(v) : a >= 1 ? v.toFixed(a >= 100 ? 1 : 3) : v.toPrecision(3); }
function mtfStrip(r, tfs) {
  const cell = (c, i) => { const tf = tfs[i], v = r.dc ? r.dc[tf] : null; return `<i class="m${c === '.' ? 'n' : c}" title="${esc(tf)} · ${MTFC[c]}${v != null ? ' · ' + pct(v * 100) : ''}"></i>`; };
  const s = r.strip.split('');
  return `<span class="mst">${[[0, 7], [7, 12], [12, 20]].map(([x, y]) => `<span>${s.slice(x, y).map((c, k) => cell(c, x + k)).join('')}</span>`).join('')}</span>`;
}
function mtfDaily(dp) {
  if (!dp || dp.length < 2) return '';
  const W = 520, H = 90, v = dp.map(d => d[1]), mx = Math.max(...v, 1), med = [...v].sort((a, b) => a - b)[Math.floor(v.length / 2)];
  const X = i => 4 + i / (v.length - 1) * (W - 60), Y = x => 6 + (mx - x) / mx * (H - 22);
  const path = v.map((x, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" class="mdp" role="img" aria-label="날짜별 통과 종목 수(1년)"><line x1="4" x2="${W - 56}" y1="${Y(med)}" y2="${Y(med)}" class="med"/><text x="${W - 52}" y="${Y(med) + 4}">중앙 ${med}</text><path d="${path}"/><circle cx="${X(v.length - 1)}" cy="${Y(v[v.length - 1])}" r="3.5"/><text x="${W - 52}" y="${Y(v[v.length - 1]) - 6}" class="lastv">${v[v.length - 1]}</text><text x="4" y="${H - 2}">${md(dp[0][0])}</text><text x="${W - 56}" y="${H - 2}" text-anchor="end">${md(dp[dp.length - 1][0])}</text></svg>`;
}
async function renderMtf() {
  const el = $('#mtf');
  let D; try { D = await loadMtf(); } catch (e) { el.innerHTML = '<p class="empty">MTF 자료를 아직 만들지 못했습니다.</p>'; return; }
  const m = D.meta, tfs = m.tfs;
  const odd = r => r.kind === 'index' || !!r.peg;
  const strict = r => r.na + r.nra === r.nj + r.nr;
  const pass = D.rows.filter(r => r.pass), rows = pass.filter(r => (MQ.all || !odd(r)) && (!MQ.ref || strict(r))), hidden = pass.filter(odd);
  const out = D.rows.filter(r => r.ev && r.ev.type === 'exit' && !odd(r));
  $('#mtfsub').textContent = `모든 판정 TF에서 종가가 SMA50 위인 종목 · 시가총액 큰 순 · ${m.asof} 마감(UTC 0시) · 바이낸스 USDⓈ-M ${m.n}개 중 ${pass.length}개 · 최신만`;
  const evName = { new: '신규', reentry: '재진입', exit: '이탈' };
  el.innerHTML = `<div class="mh"><div class="stat"><b>${rows.length}</b><span>통과 종목${hidden.length && !MQ.all ? ` (스테이블·지수 ${hidden.length}개 뺌)` : ''}</span></div><div class="stat"><b>${rows.filter(r => r.ev && r.ev.type !== 'exit').length}</b><span>최근 7개 마감 안에 새로 들어옴</span></div><div class="mdpw">${mtfDaily(D.daily_pass)}<div class="mute" style="font-size:11.5px">날짜별 통과 종목 수(지금 상장된 계약만 · 1년)</div></div></div>
  <div class="filters"><label><input type="checkbox" id="mr" ${MQ.ref ? 'checked' : ''}> 참고 TF(봉 12~49개)까지 모두 위인 것만 (${pass.filter(r => strict(r) && !odd(r)).length}개)</label>${hidden.length ? `<label><input type="checkbox" id="mi" ${MQ.all ? 'checked' : ''}> 스테이블·지수 계약도 보기 (${hidden.map(r => esc(r.coin || r.sym)).join(', ')})</label>` : ''}</div>
  <div class="mleg"><span><i class="mA"></i>판정 TF(봉 50개 이상) · SMA50 위</span><span><i class="ma"></i>참고(봉 12~49개) · 위</span><span><i class="mb"></i>참고 · 아래</span><span><i class="mn"></i>봉 부족</span><span class="mute">띠 = 1D~1W | 8D~3W | 1M~12M</span></div>
  <div class="scrollx"><table class="tbl mt"><thead><tr><th>시총</th><th>종목</th><th>종가</th><th>20개 TF</th><th>판정 TF</th><th>들어온 때</th><th title="다음 마감 종가가 이 값 아래면 통과에서 빠짐">이탈 기준가 K</th><th>K까지 여유</th><th>가장 약한 TF</th><th>7일</th><th>30일</th></tr></thead><tbody>
  ${rows.map(r => `<tr class="pass"><td>${r.mcap_rank ?? '—'}</td><td><b>${esc(r.coin || r.sym)}</b>${r.kind === 'index' ? ' <span class="chip">지수</span>' : r.peg ? ' <span class="chip">스테이블·페그</span>' : ''}</td><td>${fmtP(r.close)}</td><td>${mtfStrip(r, tfs)}</td><td><b>${r.na}</b>/${r.nj}${r.nr ? `<span class="mute"> · 참고 ${r.nra}/${r.nr}</span>` : ''}</td><td>${r.ev ? `<span class="ev ${r.ev.type}">${evName[r.ev.type] || r.ev.type} ${md(r.ev.date)}</span>` : ''}<span class="mute"> ${r.streak}일째</span></td><td>${fmtP(r.K)}</td><td class="pos">${r.cushion == null ? '—' : pct(r.cushion * 100)}</td><td>${esc(r.weakest || '')} <span class="mute">${r.min_dc == null ? '' : pct(r.min_dc * 100)}</span></td><td class="${r.r7 >= 0 ? 'pos' : 'neg'}">${r.r7 == null ? '—' : pct(r.r7 * 100)}</td><td class="${r.r30 >= 0 ? 'pos' : 'neg'}">${r.r30 == null ? '—' : pct(r.r30 * 100)}</td></tr>`).join('') || '<tr><td colspan="11" class="empty">오늘은 통과 종목이 없습니다.</td></tr>'}
  </tbody></table></div>
  ${out.length ? `<p class="mute" style="font-size:12.5px;margin:10px 0 0">최근 7개 마감 안에 빠진 종목: ${out.map(r => `${esc(r.coin || r.sym)}(${md(r.ev.date)})`).join(', ')}</p>` : ''}
  <p class="mute" style="font-size:12px;margin:8px 0 0">선별 규칙은 사용자의 스크리너 v12.1(MTF 50선)과 같습니다: TradingView식으로 봉을 나눠 20개 TF를 보고, 봉이 50개 이상인 TF(판정)가 모두 SMA50 위면 통과입니다. 상장이 짧아 봉 50개가 안 되는 TF는 참고로만 표시하고 통과 판정에 넣지 않습니다. K는 다음 마감 종가가 이 값보다 낮으면 통과에서 빠지는 선입니다. 시총: ${esc(m.mcap_source)}(순위는 전체 순위, 못 맞춘 계약은 맨 뒤).</p>`;
  if ($('#mi')) $('#mi').onchange = e => { MQ.all = e.target.checked; renderMtf(); };
  $('#mr').onchange = e => { MQ.ref = e.target.checked; renderMtf(); };
}

/* ---- 화면: 시안 다섯 개 (lab/views.js가 그린다. 11/17 다섯 개 모두 채택) ---- */
const VNAMES = ['차트 한 장', '질문 여섯 개', '사안별 이야기', '하루씩 흐름', '종목 한 줄씩'];
function renderTabs() {
  const tabs = $('#tabs');
  tabs.innerHTML = VNAMES.map((v, i) => `<button class="tab" role="tab" aria-selected="${i + 1 === VN}" data-vn="${i + 1}"><span class="o">${i + 1}</span>${esc(v)}</button>`).join('');
  tabs.querySelectorAll('.tab').forEach(b => b.onclick = () => setView(+b.dataset.vn));
  $('#viewwhy').textContent = window.MMV ? window.MMV.WHAT[VN - 1] : '';
}
function setView(n) { VN = n; renderTabs(); renderViews(); writeHash(); }
function renderViews() {
  const el = $('#viewbody');
  if (!window.MMV) { el.innerHTML = '<p class="empty">화면을 불러오는 중…</p>'; return; }
  window.MMV.show(el, VN, S[IDX].d);
}
window.addEventListener('mmv-ready', () => { if (S) { renderTabs(); renderViews(); } });
document.addEventListener('vw-go', e => { setView(e.detail); $('#h-views').scrollIntoView({ behavior: 'smooth' }); });

function renderRules() {
  const w = M.weights;
  $('#rules').innerHTML = `<p style="margin-top:0">기본 단위는 화면이 아니라 <b>사안</b>입니다. 리서치가 쌓이면 사안마다 점수가 바뀌고, 화면은 그 무게대로 다시 짜입니다.</p>
  <ol>
    <li><b>점수</b> = ${esc(w.m)} + ${esc(w.q)} + ${esc(w.p)} + ${esc(w.o)}.</li>
    <li><b>흔들림 방지</b>: 주요 자리(${M.kmaj})는 이틀 연속 ${M.kmaj}위 안이어야 올라오고, 이틀 연속 밖이어야 내려갑니다. 점수가 ${M.kmaj}위의 1.5배를 넘으면 바로 올라옵니다.</li>
    <li><b>고정 자리</b>: '지금'과 THESIS는 점수와 무관하게 맨 위에 둡니다.</li>
    <li><b>사용자 한 표</b>: 채널에서 "📌 ○○ 고정", "○○ 내려"라고 하면 점수보다 우선합니다(tools/pins.json).</li>
    <li><b>증거 안전장치</b>: KOL 수집 글은 무게를 절반만 줍니다. 근거가 주장 위주인 사안은 1위에 두지 않습니다. 모든 항목에는 근거 메시지 ID가 붙습니다.</li>
    <li><b>내려놓기</b>: 언급이 끊긴 사안은 '휴면'이 될 뿐, 해결로 처리하지 않습니다. 종결은 사람이 정합니다.</li>
    <li><b>타임머신</b>: 과거 날짜를 고르면 그 날 밤까지 알 수 있었던 기록만 씁니다. 사람 손 문장(현재 해석·조건)은 최신 판에만 있습니다.</li>
    <li><b>신선도 표시</b>: 손으로 쓴 문장에는 근거 메시지가 올라온 시각을 붙입니다. '지금' 문장은 ${STALE.now}시간, 주목 3선 메모와 사안 해석은 ${STALE.issue / 24}일, THESIS 조건 문장은 ${STALE.thesis / 24}일이 지나면 '오래된 문장'으로 표시합니다. '지금' 칸은 손 문장이 오래되면 최근 48시간의 리서치 묶음을 앞에 세웁니다. 가격으로 계산하는 숫자(주목 3선의 선·대비, THESIS 네 칸)는 사이트를 갱신할 때마다 새로 나옵니다.</li>
  </ol>
  <p><b>갱신 방식(패시브)</b>: 채널에서 리서치·팔로업을 하면 Claude가 tools/additions.json과 curated.json에 근거 ID와 함께 덧붙이고, build.py를 돌려 다시 올립니다. 사용자가 따로 할 일은 없습니다. 처음 2주는 점수를 Claude가 제안하고 사용자가 고치는 식으로 가중치를 맞춥니다.</p>
  <p style="margin-bottom:0"><b>공개 사이트라서 넣지 않는 것</b>: Discord 대화 원문, 확인 문구, KOL 글 전문(우리말 요지와 원문 링크만), TradingView 원자료. 사용자 질문은 내용 없이 사안별 횟수만 씁니다.</p>`;
}
function renderFoot() {
  $('#foot').innerHTML = `만든 시각 ${esc(M.built)} KST · 기록 ${esc(M.first)} ~ ${esc(M.last)} · 글 ${M.counts.timeline} · 판정 ${M.counts.ledger} · 레벨 ${M.counts.ladder} · 정정·이견 ${M.counts.radar} · 일정 ${M.counts.catalysts} · 전염 ${M.counts.contagion}<br>
  Discord 3자 대화방(사용자·GPT·Claude)의 시장 리서치 기록. 투자 조언이 아닙니다. · <a href="../">두 판 고르기</a> · <a href="https://github.com/tlzkrh1029/discord-market-research/tree/main/claude">원본</a>`;
}

boot().catch(e => { document.querySelector('main').innerHTML = `<p class="empty">데이터를 읽지 못했습니다: ${esc(e.message)}</p>`; });
