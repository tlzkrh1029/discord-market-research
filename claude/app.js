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

let M, S, IT, NOW, IDX = 0, VIEW = 'timeline', ISS = '', LIMIT = 30;
const L = id => (M.issues.find(i => i.id === id) || { label: id }).label;
const endOf = d => d + ' 23:59';
const known = (r, d) => !r.ts || r.ts <= endOf(d);
const pct = v => (v > 0 ? '+' : '') + v.toFixed(Math.abs(v) < 10 ? 2 : 1) + '%';
const n0 = v => Math.round(v).toLocaleString('en-US');
const g = x => `<span class="g ${esc(x)}">${esc(x)}</span>`;
const srcs = a => (a || []).length ? `<span class="src" title="Discord 메시지 ID(근거)">근거 ${a.map(esc).join(' · ')}</span>` : '';

async function boot() {
  const get = f => fetch('data/' + f, { cache: 'no-cache' }).then(r => { if (!r.ok) throw new Error(f); return r.json(); });
  [M, S, IT, NOW] = await Promise.all(['meta.json', 'snapshots.json', 'items.json', 'now.json'].map(get));
  const sl = $('#slider'); sl.max = S.length - 1;
  readHash(); if (!(IDX >= 0 && IDX < S.length)) IDX = S.length - 1;
  sl.value = IDX;
  sl.addEventListener('input', () => go(+sl.value));
  $('#prev').onclick = () => go(IDX - 1); $('#next').onclick = () => go(IDX + 1); $('#latest').onclick = () => go(S.length - 1);
  document.addEventListener('keydown', e => { if (e.target.closest('input,select,textarea')) return; if (e.key === 'ArrowLeft') go(IDX - 1); if (e.key === 'ArrowRight') go(IDX + 1); });
  $('#ifilter').onchange = e => { ISS = e.target.value; LIMIT = 30; renderViews(); writeHash(); };
  setupTheme(); render(); renderMtf();
}
function readHash() {
  const h = new URLSearchParams(location.hash.slice(1));
  const d = h.get('d'); IDX = d ? S.findIndex(s => s.d === d) : S.length - 1;
  if (IDX < 0) IDX = S.length - 1;
  VIEW = h.get('v') || 'timeline'; ISS = h.get('i') || '';
}
function writeHash() {
  const h = new URLSearchParams();
  if (IDX !== S.length - 1) h.set('d', S[IDX].d);
  if (VIEW !== 'timeline') h.set('v', VIEW);
  if (ISS) h.set('i', ISS);
  history.replaceState(null, '', h.toString() ? '#' + h : location.pathname);
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
  renderNow(s, latest); renderThesis(s, latest); renderCards(s, latest); renderWatch(s); renderChanges(s);
  renderMap(s); renderKol(s, latest); renderTabs(s); renderViews(); renderRules(); renderFoot();
}

/* ---- 고정 자리 1: 지금 ---- */
function renderNow(s, latest) {
  const el = $('#now');
  if (latest) {
    const c = NOW.curated.now;
    el.innerHTML = `<div class="slotlabel">지금 · ${esc(NOW.curated.asof)} KST</div>
      <p class="headline">${esc(c.headline)}</p>
      <ul class="pts">${c.points.map(p => `<li>${g(p.g)}<span>${esc(p.t)}</span></li>`).join('')}</ul>
      <div class="unv"><b>확인 못 한 것</b><ul class="pts" style="margin-top:4px">${c.unverified.map(u => `<li>${g('미확인')}<span>${esc(u)}</span></li>`).join('')}</ul></div>
      <div style="margin-top:8px">${srcs(c.src)}</div>`;
    return;
  }
  const p = IT.timeline.find(x => x.src === s.hl);
  el.innerHTML = `<div class="slotlabel">그 날 밤 기준 마지막 리서치</div>` + (p ? `
      <p class="headline">${esc(p.title)}</p>
      <ul class="pts"><li>${g(p.g)}<span>${esc(p.gist)}</span></li></ul>
      <div style="margin-top:8px"><span class="who ${p.who}">${WHO[p.who] || p.who}</span> <span class="src">${esc(p.ts)} · 근거 ${esc(p.src)}</span></div>` : '<p class="empty">이 날짜까지 리서치 글이 없습니다.</p>');
}

/* ---- 고정 자리 2: THESIS ---- */
function renderThesis(s, latest) {
  const T = NOW.thesis, C = NOW.curated.thesis, el = $('#thesis');
  const daily = T.daily.filter(r => r.bar < s.d), weekly = T.weekly.filter(r => r.bar < s.d);
  const born = '2026-11-10';
  if (s.d < born) { el.innerHTML = `<div class="slotlabel">THESIS 계기판</div><p class="empty">이 날짜에는 아직 THESIS가 없었습니다. 첫 가설은 11/10(USDT.D), 지금 판은 11/15에 나왔습니다.</p>`; return; }
  const rowsD = daily.slice(-6).map(r => `<tr><td>${md(r.bar)}</td><td>${n0(r.close)}</td><td>${n0(r.line)}</td><td class="${r.pct < 0 ? 'neg' : 'pos'}">${pct(r.pct)}</td></tr>`).join('');
  const rowsW = weekly.slice(-3).map(r => `<tr><td>${md(r.bar)} 주</td><td>${n0(r.close)}</td><td>${n0(r.line)}</td><td class="${r.pct < 0 ? 'neg' : 'pos'}">${pct(r.pct)}</td></tr>`).join('');
  const alts = T.alts.map(a => { const r = a.rows.filter(x => x.bar < s.d).slice(-1)[0]; return r ? `<tr><td>${esc(a.sym)}</td><td class="${r.pct < 0 ? 'neg' : ''}">${pct(r.pct)}</td><td>${md(r.bar)}</td></tr>` : ''; }).join('');
  const idea = s.d < '2026-11-15' ? '11/10 사용자 가설: USDT.D 같은 도미넌스 지표가 주요 지지·저항에 닿았다는 읽기. 지금의 THESIS(11/15)는 아직 나오기 전입니다.' : C.idea;
  el.innerHTML = `<div class="slotlabel">THESIS 계기판 · 사용자 판단 틀</div>
    <p class="view" style="margin:0 0 10px">${esc(idea)}</p>
    ${latest ? `<ul class="cond">${C.cond.map(c => { const k = ST(c.s); return `<li><span class="st ${k}">${ICON[k]} ${esc(c.s)}</span><span>${esc(c.t)}</span>${c.n ? `<span class="n">${esc(c.n)}</span>` : ''}</li>`; }).join('')}</ul>` : '<p class="why2" style="margin:0">조건 판정은 최신 판에만 있습니다. 아래 표는 그 날까지 닫힌 봉만 보여 줍니다.</p>'}
    <div class="tgrid">
      <div class="scrollx"><table class="tbl"><caption class="sr">BTC 4년선 대비 종가</caption><thead><tr><th>BTC 일봉</th><th>종가</th><th>4년선</th><th>대비</th></tr></thead><tbody>${rowsD || '<tr><td colspan=4>—</td></tr>'}</tbody>
        <thead><tr><th>주봉</th><th>종가</th><th>208주</th><th>대비</th></tr></thead><tbody>${rowsW}</tbody></table></div>
      <div class="scrollx"><table class="tbl"><caption class="sr">알트 7종 365일선 대비</caption><thead><tr><th>알트 7종</th><th>365선</th><th>종가일</th></tr></thead><tbody>${alts}</tbody></table>
        ${latest ? `<p class="why2" style="margin:8px 0 0">ETH 9년선 ${n0(T.eth.line)} 대비 ${pct(T.eth.pct)} (${md(T.eth.bar)} 종가 ${T.eth.close.toLocaleString('en-US')}) · BTC 48개월선 ${n0(T.m48_live)}(11월 진행 중)</p>` : ''}</div>
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
    const body = cur
      ? `<p class="view">${g(cur.g)}${esc(cur.view)}</p>${cur.cond && cur.cond.length ? `<ul class="cond">${cur.cond.map(c => { const k = ST(c.s); return `<li><span class="st ${k}">${ICON[k]} ${esc(c.s)}</span><span>${esc(c.t)}</span>${c.n ? `<span class="n">${esc(c.n)}</span>` : ''}</li>`; }).join('')}</ul>` : ''}`
      : last ? `<p class="view">${g(last.g)}<span class="w" style="color:var(--ink-3);font-size:12px">${md(last.ts.slice(0, 10))} ${WHO[last.who] || ''} · </span>${esc(last.gist)}</p>` : '<p class="view empty">근거 글 없음</p>';
    const ch = s.ch.find(c => c.i === id && (c.t === '올라옴' || c.t === '보류'));
    return `<article class="card" id="card-${id}">
      <div class="c1"><span class="rank">${n + 1}</span><h3>${esc(meta.label)} <span class="kind">${esc(meta.kind)}</span></h3>${deltaOf(id, n)}<span class="chip ${s.status[id]}">${esc(s.status[id])}</span></div>
      ${scoreBar(sc, max)}
      ${body}
      <div class="cmeta"><span>근거 글 7일 ${sc.ev}건</span><span>질문 7일 ${sc.qn}번</span>${sc.kol > 0.5 ? '<span class="weak">근거가 주장(KOL) 위주</span>' : sc.kol > 0.25 ? `<span>주장 비중 ${Math.round(sc.kol * 100)}%</span>` : ''}${ch ? `<span>오늘: ${esc(ch.why)}</span>` : ''}</div>
      ${s.suggest.includes(id) ? `<div class="sugg">같은 사안 질문이 7일 안에 ${sc.qn}번 → 고정 자리로 둘지 제안합니다</div>` : ''}
      ${drawer(id, s.d, posts)}
    </article>`;
  }).join('');
}
function drawer(id, d, posts) {
  const cnt = v => countIn(v, id, d, 7);
  return `<details class="drawer"><summary>근거 서랍 · 최근 글 ${posts.length}개</summary>
    <ul class="ev">${posts.map(p => `<li><span class="who ${p.who}">${WHO[p.who] || p.who}</span> <span class="t">${esc(p.title)}</span> ${g(p.g)}<br><span class="w">${esc(p.ts)} · ${KIND[p.kind] || p.kind} · 근거 ${esc(p.src)}</span><br>${esc(p.gist)}</li>`).join('') || '<li class="empty">없음</li>'}</ul>
    <div class="jump">${['ledger', 'ladder', 'radar', 'catalysts', 'contagion'].map(v => `<button class="btn" data-v="${v}" data-i="${id}">${M.views.find(x => x.id === v).label} ${cnt(v)}</button>`).join('')}</div>
  </details>`;
}
document.addEventListener('click', e => {
  const b = e.target.closest('.jump .btn'); if (b) { VIEW = b.dataset.v; ISS = b.dataset.i; LIMIT = 30; renderTabs(S[IDX]); renderViews(); writeHash(); $('#h-views').scrollIntoView({ behavior: 'smooth' }); return; }
  const w = e.target.closest('.wi'); if (w) { VIEW = 'timeline'; ISS = w.dataset.i; LIMIT = 30; renderTabs(S[IDX]); renderViews(); writeHash(); $('#h-views').scrollIntoView({ behavior: 'smooth' }); }
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
  let h = '<div class="lab"></div>' + S.map((x, k) => `<button class="dh ${k === IDX ? 'sel' : ''}" data-k="${k}" aria-label="${x.d} 판 보기">${(k % 4 === 0 && S.length - 1 - k >= 3) || k === S.length - 1 ? md(x.d) : ''}</button>`).join('');
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
let MTF = null, MQ = { q: '', v: 'all', idx: true, n: 50 };
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
  $('#mtfsub').textContent = `바이낸스 USDⓈ-M 무기한 ${m.n}개 · 시가총액 큰 순 · ${m.asof} 마감(UTC 0시) 기준 · 날짜를 옮겨도 최신만 보입니다`;
  const ev7 = D.rows.filter(r => r.ev), cnt = t => ev7.filter(r => r.ev.type === t).length;
  const q = MQ.q.trim().toUpperCase();
  const rows = D.rows.filter(r => (MQ.idx || r.kind !== 'index') && (!q || r.sym.includes(q) || (r.coin || '').includes(q)) &&
    (MQ.v === 'all' || (MQ.v === 'pass' && r.pass) || (MQ.v === 'near' && !r.pass && r.cushion != null && r.cushion > -0.05) || (MQ.v === 'ev' && r.ev)));
  const evName = { new: '신규', reentry: '재진입', exit: '이탈' };
  el.innerHTML = `<div class="mh"><div class="stat"><b>${m.n_pass}</b><span>통과(판정 TF 전부 SMA50 위)</span></div><div class="stat"><b>${cnt('new')}·${cnt('reentry')}·${cnt('exit')}</b><span>최근 7개 마감 신규·재진입·이탈</span></div><div class="mdpw">${mtfDaily(D.daily_pass)}<div class="mute" style="font-size:11.5px">날짜별 통과 종목 수(지금 상장된 계약만 · 1년)</div></div></div>
  <div class="filters"><label>보기 <select id="mv"><option value="all">전체</option><option value="pass">통과만</option><option value="near">통과까지 5% 안</option><option value="ev">최근 7일 변화</option></select></label>
  <input id="mq" type="search" placeholder="종목 찾기" value="${esc(MQ.q)}" aria-label="종목 찾기"><label><input type="checkbox" id="mi" ${MQ.idx ? 'checked' : ''}> 지수 계약 포함</label><span class="mute">${rows.length}개</span></div>
  <div class="mleg"><span><i class="mA"></i>판정 TF · SMA50 위</span><span><i class="mB"></i>판정 · 아래</span><span><i class="ma"></i>참고(봉 12~49개) · 위</span><span><i class="mb"></i>참고 · 아래</span><span><i class="mn"></i>봉 부족</span><span class="mute">띠 = 1D~1W | 8D~3W | 1M~12M</span></div>
  <div class="scrollx"><table class="tbl mt"><thead><tr><th>시총</th><th>종목</th><th>종가</th><th>20개 TF</th><th>위/판정</th><th title="다음 마감에 넘어야 통과하는 값">통과 기준가 K</th><th>K까지</th><th>최근 변화</th><th>7일</th><th>30일</th></tr></thead><tbody>
  ${rows.slice(0, MQ.n).map(r => `<tr class="${r.pass ? 'pass' : ''}"><td>${r.mcap_rank ?? '—'}</td><td><b>${esc(r.coin || r.sym)}</b>${r.kind === 'index' ? ' <span class="chip">지수</span>' : ''}</td><td>${fmtP(r.close)}</td><td>${mtfStrip(r, tfs)}</td><td><b>${r.na}</b>/${r.nj}${r.nr ? `<span class="mute"> · 참고 ${r.nra}/${r.nr}</span>` : ''}</td><td>${fmtP(r.K)}</td><td class="${r.cushion >= 0 ? 'pos' : 'neg'}">${r.cushion == null ? '—' : pct(r.cushion * 100)}</td><td>${r.ev ? `<span class="ev ${r.ev.type}">${evName[r.ev.type] || r.ev.type} ${md(r.ev.date)}</span>` : r.pass && r.streak ? `<span class="mute">${r.streak}일째</span>` : ''}</td><td class="${r.r7 >= 0 ? 'pos' : 'neg'}">${r.r7 == null ? '—' : pct(r.r7 * 100)}</td><td class="${r.r30 >= 0 ? 'pos' : 'neg'}">${r.r30 == null ? '—' : pct(r.r30 * 100)}</td></tr>`).join('')}
  </tbody></table></div>${rows.length > MQ.n ? `<button class="btn more" id="mmore" type="button">${Math.min(50, rows.length - MQ.n)}개 더 보기 (남은 ${rows.length - MQ.n})</button>` : ''}
  <p class="mute" style="font-size:12px;margin:10px 0 0">계산은 사용자의 스크리너 v12.1(MTF 50선 엔진)과 같은 규칙입니다: TradingView식 봉 나누기, 봉 50개 이상 = 판정 TF, 12~49개 = 참고(전체 봉 평균 대비), 판정 TF가 모두 SMA50 위면 통과. K는 다음 마감 종가가 넘어야 통과하는 값입니다. 시총: ${esc(m.mcap_source)}(못 맞춘 계약은 맨 뒤). ${esc((m.notes || []).join(' '))}</p>`;
  $('#mv').value = MQ.v;
  $('#mv').onchange = e => { MQ.v = e.target.value; MQ.n = 50; renderMtf(); };
  $('#mq').oninput = e => { MQ.q = e.target.value; MQ.n = 50; clearTimeout(renderMtf.t); renderMtf.t = setTimeout(() => { renderMtf().then(() => { const i = $('#mq'); i.focus(); i.setSelectionRange(i.value.length, i.value.length); }); }, 200); };
  $('#mi').onchange = e => { MQ.idx = e.target.checked; renderMtf(); };
  if ($('#mmore')) $('#mmore').onclick = () => { MQ.n += 50; renderMtf(); };
}

/* ---- 화면 탭 ---- */
function renderTabs(s) {
  const tabs = $('#tabs');
  tabs.innerHTML = s.views.map((v, n) => { const meta = M.views.find(x => x.id === v); return `<button class="tab" role="tab" aria-selected="${v === VIEW}" data-v="${v}"><span class="o">${n + 1}</span>${esc(meta.label)}</button>`; }).join('');
  tabs.querySelectorAll('.tab').forEach(b => b.onclick = () => { VIEW = b.dataset.v; LIMIT = 30; renderTabs(S[IDX]); renderViews(); writeHash(); });
  const sel = $('#ifilter');
  sel.innerHTML = '<option value="">전체</option>' + M.issues.map(i => `<option value="${i.id}" ${i.id === ISS ? 'selected' : ''}>${esc(i.label)}</option>`).join('');
  const meta = M.views.find(x => x.id === VIEW);
  $('#viewwhy').textContent = `${meta.label}: ${meta.what}` + (VIEW !== 'timeline' ? ` · 이 날 무게 ${(s.vs[VIEW] || 0).toFixed(2)}` : '');
}
function renderViews() {
  const s = S[IDX];
  let rows = IT[VIEW].filter(r => known(r, s.d) && (!ISS || r.iss.includes(ISS)));
  const body = $('#viewbody');
  $('#vcount').textContent = `${rows.length}건`;
  if (!rows.length) { body.innerHTML = '<p class="empty">이 조건에 맞는 항목이 없습니다.</p>'; return; }
  const tags = r => r.iss.map(i => `<span class="chip">${esc(L(i))}</span>`).join(' ');
  const more = n => n > LIMIT ? `<div class="more"><button class="btn" id="more">더 보기 (${n - LIMIT}건 남음)</button></div>` : '';
  let h = '';
  if (VIEW === 'timeline') {
    rows = rows.slice().reverse();
    h = `<div class="rows">${rows.slice(0, LIMIT).map(p => `<div class="rowi"><div class="h"><span class="who ${p.who}">${WHO[p.who] || p.who}</span><span>${esc(p.ts)}</span><span>${KIND[p.kind] || p.kind}</span>${g(p.g)}${tags(p)}</div><div class="b"><b>${esc(p.title)}</b></div><div class="x">${esc(p.gist)}</div><div class="src">근거 ${esc(p.src)}</div></div>`).join('')}</div>` + more(rows.length);
  } else if (VIEW === 'ledger') {
    rows = rows.slice().reverse();
    h = `<p class="why2">채점은 11/14까지의 4시간봉 기준(v2.1)입니다. 그 뒤 판정은 아직 채점하지 않았습니다.</p><div class="rows">${rows.slice(0, LIMIT).map(c => `<div class="rowi"><div class="h"><span class="who ${c.who}">${WHO[c.who] || c.who}</span><span>${esc(c.ts)}</span><b>${esc(c.asset)}</b>${c.cat ? `<span class="chip">${CAT[c.cat] || c.cat}</span>` : ''}${g(c.g)}${tags(c)}</div><div class="b">${esc(c.st)}</div>${c.exp ? `<div class="x">기대: ${esc(c.exp)}${c.hz ? ' · 기한 ' + esc(c.hz) : ''}</div>` : ''}${c.res ? `<div class="x">채점: <b>${esc(RES[c.res] || c.res)}</b></div>` : ''}<div class="src">근거 ${esc(c.src)}</div></div>`).join('')}</div>` + more(rows.length);
  } else if (VIEW === 'ladder') {
    const by = {}; rows.forEach(r => (by[r.asset] = by[r.asset] || []).push(r));
    const order = Object.keys(by).sort((a, b) => (a === 'BTC' ? -1 : b === 'BTC' ? 1 : a === 'ETH' ? -1 : b === 'ETH' ? 1 : by[b].length - by[a].length));
    const cutoff = new Date(new Date(s.d + 'T23:59:00+09:00').getTime() - 7 * 864e5);
    h = `<p class="why2">흐린 줄 = 7일 넘은 스냅샷 값(청산·옵션·지지·저항·원가). 지금도 유효한지 다시 봐야 합니다.</p><div class="ladder">${order.map(a => {
      const seen = new Map(); by[a].forEach(r => seen.set(Math.round(r.price * 1e6) + r.label, r));
      const lv = [...seen.values()].sort((x, y) => y.price - x.price);
      return `<div class="panel lad"><h4>${esc(a)} <span class="kind">${lv.length}개</span></h4>${lv.slice(0, a === 'BTC' ? 40 : 15).map(r => { const old = SNAPKIND.has(r.kind) && new Date(r.ts.replace(' ', 'T') + ':00+09:00') < cutoff; return `<div class="lv ${old ? 'old' : ''}"><span class="p">${r.price >= 100 ? n0(r.price) : r.price}</span><span>${esc(r.label)}</span><span class="w">${LKIND[r.kind] || r.kind} · ${esc(r.ts.slice(5, 10))} ${WHO[r.who] || ''}${old ? ' · 재확인 필요' : ''} · 근거 ${esc(r.src)}</span></div>`; }).join('')}</div>`;
    }).join('')}</div>`;
  } else if (VIEW === 'radar') {
    rows = rows.slice().reverse();
    h = `<div class="rows">${rows.slice(0, LIMIT).map(r => r.type === '정정'
      ? `<div class="rowi"><div class="h"><span class="chip">정정</span><span>${esc(r.ts)}</span><span>${WHO[r.who] || r.who} → ${WHO[r.tgt] || r.tgt}</span>${tags(r)}</div><div class="b">틀린 것: ${esc(r.a)}</div><div class="b">바로잡음: <b>${esc(r.b)}</b></div>${r.why ? `<div class="x">원인: ${esc(r.why)}</div>` : ''}<div class="src">근거 ${esc(r.src)}</div></div>`
      : `<div class="rowi"><div class="h"><span class="chip">이견</span><span>${esc(r.ts)}</span><b>${esc(r.topic)}</b>${tags(r)}</div><div class="b"><span class="who claude">Claude</span> ${esc(r.a)}</div><div class="b"><span class="who gpt">GPT</span> ${esc(r.b)}</div>${r.why ? `<div class="x">결론: ${esc(r.why)}</div>` : ''}<div class="src">근거 ${esc(r.src)}</div></div>`).join('')}</div>` + more(rows.length);
  } else if (VIEW === 'catalysts') {
    const up = rows.filter(r => r.date && r.date >= s.d).sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
    const past = rows.filter(r => !r.date || r.date < s.d).sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    const row = r => `<div class="rowi"><div class="h"><b>${esc(r.date ? md(r.date) : '날짜 미상')}${r.time ? ' ' + esc(r.time) : ''}</b>${g(r.g)}${tags(r)}</div><div class="b">${esc(r.ev)}</div>${r.exp ? `<div class="x">당시 예상: ${esc(r.exp)}</div>` : ''}${r.out ? `<div class="x">결과: ${esc(r.out)}</div>` : ''}<div class="src">근거 ${esc(r.src)}</div></div>`;
    h = `<h2 style="margin-top:0">${md(s.d)} 기준 앞으로 <span class="sub">${up.length}건</span></h2><div class="rows">${up.slice(0, LIMIT).map(row).join('') || '<p class="empty">없음</p>'}</div>
      <h2 style="margin-top:18px">지난 일정 <span class="sub">${past.length}건</span></h2><div class="rows">${past.slice(0, LIMIT).map(row).join('')}</div>`;
  } else if (VIEW === 'contagion') {
    rows = rows.slice().reverse();
    h = `<p class="why2">화살표는 우리가 말한 경로입니다. '추정'은 인과가 확인되지 않은 가설입니다.</p><div class="rows">${rows.slice(0, LIMIT).map(r => `<div class="rowi"><div class="h"><span class="chip">${esc(r.st)}</span>${r.ts ? `<span>${esc(r.ts)}</span>` : ''}${tags(r)}</div><div class="b"><b>${esc(r.a)}</b> → <b>${esc(r.b)}</b></div><div class="x">${esc(r.how)}</div><div class="src">근거 ${esc(r.src)}</div></div>`).join('')}</div>` + more(rows.length);
  }
  body.innerHTML = h;
  const mb = $('#more'); if (mb) mb.onclick = () => { LIMIT += 30; renderViews(); };
}

/* ---- 규칙 · 바닥글 ---- */
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
  </ol>
  <p><b>갱신 방식(패시브)</b>: 채널에서 리서치·팔로업을 하면 Claude가 tools/additions.json과 curated.json에 근거 ID와 함께 덧붙이고, build.py를 돌려 다시 올립니다. 사용자가 따로 할 일은 없습니다. 처음 2주는 점수를 Claude가 제안하고 사용자가 고치는 식으로 가중치를 맞춥니다.</p>
  <p style="margin-bottom:0"><b>공개 사이트라서 넣지 않는 것</b>: Discord 대화 원문, 확인 문구, KOL 글 전문(우리말 요지와 원문 링크만), TradingView 원자료. 사용자 질문은 내용 없이 사안별 횟수만 씁니다.</p>`;
}
function renderFoot() {
  $('#foot').innerHTML = `만든 시각 ${esc(M.built)} KST · 기록 ${esc(M.first)} ~ ${esc(M.last)} · 글 ${M.counts.timeline} · 판정 ${M.counts.ledger} · 레벨 ${M.counts.ladder} · 정정·이견 ${M.counts.radar} · 일정 ${M.counts.catalysts} · 전염 ${M.counts.contagion}<br>
  Discord 3자 대화방(사용자·GPT·Claude)의 시장 리서치 기록. 투자 조언이 아닙니다. · <a href="../">두 판 고르기</a> · <a href="https://github.com/tlzkrh1029/discord-market-research/tree/main/claude">원본</a>`;
}

boot().catch(e => { document.querySelector('main').innerHTML = `<p class="empty">데이터를 읽지 못했습니다: ${esc(e.message)}</p>`; });
