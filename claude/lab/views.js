// 화면 시안 다섯 개. lab/N.html(시안 따로 보기)과 본판 "화면" 칸이 같은 함수를 쓴다.
// render(root, n, D): root에 시안 n을 그린다. D는 load() 결과(본판은 cut()으로 그날까지만 남긴 사본).
import { priceChart, clusters, last, chg, spark, fp, pct, esc, mdh, md, tt, tip, WHO, KIND, RES, RESK, RESI, CAT, LGNAME, DAY } from './lab.js';

export const NAMES = ['차트 한 장', '질문 여섯 개', '사안별 이야기', '하루씩 흐름', '종목 한 줄씩'];
export const WHAT = [
  '가격 위에 우리가 한 말(가격선·판정·리서치 글·일정·정정)을 겹쳐서, 그때 무슨 말을 했고 가격은 어떻게 갔는지 봅니다. 층은 켜고 끌 수 있고, 차트를 누르면 그 시각 앞뒤 12시간의 기록이 나옵니다.',
  '늘 궁금한 여섯 질문에 그림 하나와 한 문장으로 답합니다.',
  '사안을 고르면 그 사안의 가격·판정·가격선·일정·정정·연결·글 흐름이 한 화면에 모입니다. 순서는 그날 무게(주요 자리 → 관찰) 순입니다.',
  '날짜마다 한 줄: 그날 BTC, 대표 글, 판정·가격선·정정 수, 다룬 사안. 맨 위 띠는 날마다 기록이 얼마나 많았는지(진할수록 많음)이고, 칸을 누르면 그날로 갑니다.',
  '한 줄이 한 종목입니다. 30일 흐름, 지금 가격 가까이의 우리 선, 판정 결과, 최근 2주 언급, 다음 일정을 가로로 놓았습니다. 줄을 누르면 차트가 펼쳐집니다.',
];
const R = {};
let cur = null, rt;
const ss = (k, v) => { try { if (v === undefined) return JSON.parse(sessionStorage.getItem(k) || 'null'); sessionStorage.setItem(k, JSON.stringify(v)); } catch { return null; } };
export function render(root, n, D) {
  tip();
  cur = { root, n, D };
  root.className = 'vw v' + n;
  R[n](root, D);
}
addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => { if (cur && cur.root.isConnected) R[cur.n](cur.root, cur.D); }, 150); });
const KEYS = `<span class="sup"><i></i>지지·고저점</span><span class="res"><i></i>저항</span><span class="ma"><i></i>이평·원가</span><span class="liq"><i></i>청산·옵션</span>`;
const pastNote = D => D.past ? `<p class="mute" style="font-size:12px;margin:0 0 8px">${esc(D.past)} 밤까지 알 수 있었던 기록만 씁니다. 그 뒤에 난 판정 결과는 "결과 전"으로 보입니다.</p>` : '';

/* ---- 1. 차트 한 장 ---- */
const S1 = Object.assign({ a: 'BTC', range: 'all', L: { lv: 1, calls: 1, posts: 1, cats: 1, fix: 1 } }, ss('mm-v1') || {}), P1 = { pick: null };
R[1] = (root, D) => {
  const ASSETS = Object.keys(D.px).map(a => ({ a, n: D.items.ladder.filter(r => r.a === a).length + D.items.ledger.filter(r => r.a === a).length + D.items.timeline.filter(r => (r.assets || []).includes(a)).length })).sort((x, y) => y.n - x.n);
  if (!D.px[S1.a]) S1.a = ASSETS[0]?.a || 'BTC';
  const a = S1.a, now = last(D, a);
  const LN = { lv: '가격선', calls: '판정', posts: '리서치 글', cats: '일정', fix: '정정' }, RG = { all: '전체', w2: '2주', w1: '1주' };
  root.innerHTML = pastNote(D) + `<p class="s1sum" id="v-sum"></p>
  <div class="ltabs" role="group" aria-label="종목">${ASSETS.map(x => `<button type="button" aria-pressed="${x.a === a}" data-a="${x.a}">${x.a}<small>${x.n}</small></button>`).join('')}</div>
  <div class="ctl"><div class="tog">${Object.entries(LN).map(([k, v]) => `<label><input type="checkbox" data-l="${k}" ${S1.L[k] ? 'checked' : ''}>${v}</label>`).join('')}</div><div class="ltabs" role="group" aria-label="기간">${Object.entries(RG).map(([k, v]) => `<button type="button" aria-pressed="${S1.range === k}" data-r="${k}">${v}</button>`).join('')}</div></div>
  <div class="chartbox"><div id="v-chart"></div><div class="key">${KEYS}<span class="good"><i class="dash"></i>판정 ✓ 목표 도달</span><span class="warn"><i class="dash"></i>◐ 조건만 충족</span><span class="mute"><i class="dash"></i>· 조건 안 옴</span><span class="bad"><i class="dash"></i>✕ 무효</span><span class="claude"><i class="dot"></i>Claude 글</span><span class="gpt"><i class="dot"></i>GPT 글</span><span>▪ 일정</span><span class="bad">✕ 정정</span></div>
  <p class="mute" style="font-size:12px;margin:6px 0 0">많이 말한 가격선만 그립니다(선 굵기 = 같은 가격대 ±0.4%를 말한 횟수, 선은 처음 말한 때부터). 차트를 누르면 그 시각 앞뒤 12시간의 기록이 아래에 나옵니다.</p></div>
  <section class="when" id="v-when"></section>
  <div class="three"><div class="panel" id="v-near"></div><div class="panel" id="v-open"></div><div class="panel" id="v-next"></div></div>`;
  const q = s => root.querySelector(s);
  const end = D.px[a].t.at(-1), from = S1.range === 'w1' ? end - 7 * DAY : S1.range === 'w2' ? end - 14 * DAY : undefined;
  priceChart(q('#v-chart'), D, a, { layers: S1.L, from, future: 4 * DAY, onPick: t => { P1.pick = t; when(); } });
  const calls = D.items.ledger.filter(r => r.a === a && r.scored), cnt = k => calls.filter(r => RESK[r.res] === k).length;
  const cl = clusters(D, a), up = cl.filter(c => c.d > 0).sort((x, y) => x.d - y.d)[0], dn = cl.filter(c => c.d < 0).sort((x, y) => y.d - x.d)[0];
  const nx = D.cats.find(c => c.t > D.built);
  q('#v-sum').innerHTML = `<b>${a} ${fp(now)}</b> (7일 ${pct(chg(D, a, 7))}). ` +
    (up || dn ? `가장 가까운 우리 선은 위 <b>${up ? fp(up.p) + ' (' + pct(up.d) + ')' : '없음'}</b>, 아래 <b>${dn ? fp(dn.p) + ' (' + pct(dn.d) + ')' : '없음'}</b>. ` : '') +
    (calls.length ? `채점한 판정 ${calls.length}개 중 목표 도달 <b class="good">${cnt('good')}</b>, 조건만 충족 <b class="warn">${cnt('warn')}</b>, 조건 안 옴 <b>${cnt('mute')}</b>, 무효 <b class="bad">${cnt('bad')}</b>${cnt('live') ? `, 결과 전 <b class="live">${cnt('live')}</b>` : ''}. ` : '') +
    (nx ? `다음 일정은 <b>${nx.date.slice(5)}${nx.time ? ' ' + nx.time : ''} ${esc(nx.ev)}</b>.` : '');
  const around = [...cl.filter(c => c.d > 0).sort((x, y) => x.d - y.d).slice(0, 4).reverse(), { now: 1 }, ...cl.filter(c => c.d <= 0).sort((x, y) => y.d - x.d).slice(0, 4)];
  const COL = { sup: 's1', res: 's2', ma: 's3', liq: 's4', oth: 'ink-3' };
  q('#v-near').innerHTML = `<h3>지금 가격 가까이의 우리 선</h3><ul class="near">${around.map(c => c.now ? `<li class="now"><span class="p">${fp(now)}</span><span>지금</span><span></span></li>` :
    `<li><span class="p">${fp(c.p)}</span><span class="l" style="color:var(--${COL[c.gp]})"><i></i><span style="color:var(--ink)">${esc(c.label)}</span></span><span class="d">${pct(c.d)}</span></li>`).join('')}</ul>`;
  const open = D.items.ledger.filter(r => r.a === a && r.trg && r.scored).sort((x, y) => y.t - x.t).slice(0, 5);
  q('#v-open').innerHTML = `<h3>최근 판정과 결과</h3><ul class="ev">${open.map(r => `<li><span class="rb ${RESK[r.res]}">${RESI[RESK[r.res]]} ${RES[r.res]}</span><span>${esc(r.st)}<br><span class="w">${mdh(r.t)} ${WHO[r.who] || r.who} · 조건 ${fp(r.trg)} (지금 ${pct(now / r.trg - 1)})</span></span></li>`).join('') || '<li class="empty">이 종목의 채점 판정이 없습니다.</li>'}</ul>`;
  const nx6 = D.cats.filter(c => c.t > D.built - DAY / 2).slice(0, 6);
  q('#v-next').innerHTML = `<h3>다음 일정</h3><ul class="ev">${nx6.map(c => `<li><span class="w">${c.date.slice(5)}${c.time ? ' ' + c.time : ''}</span><span>${esc(c.ev)}${c.exp ? `<br><span class="w">${esc(c.exp)}</span>` : ''}</span></li>`).join('') || '<li class="empty">잡힌 일정이 없습니다.</li>'}</ul>`;
  function when() {
    const el = q('#v-when');
    if (!P1.pick) { el.innerHTML = ''; return; }
    const t0 = P1.pick - DAY / 2, t1 = P1.pick + DAY / 2, near = r => r.t >= t0 && r.t <= t1;
    const rows = [
      ...D.items.timeline.filter(near).map(r => [r.t, `${WHO[r.who] || r.who} ${KIND[r.kind] || ''}`, r.title + ' — ' + r.gist]),
      ...D.items.ledger.filter(r => near(r) && r.a === a).map(r => [r.t, `판정 · ${CAT[r.cat] || ''}`, r.st + (r.res && RES[r.res] ? ` → ${RES[r.res]}` : '')]),
      ...D.items.ladder.filter(r => near(r) && r.a === a).map(r => [r.t, '가격선', `${fp(r.price)} ${r.label}`]),
      ...D.items.radar.filter(near).map(r => [r.t, r.type, `${r.a} → ${r.b}`]),
    ].sort((x, y) => x[0] - y[0]);
    el.innerHTML = `<div class="panel"><h3>${mdh(P1.pick)} 앞뒤 12시간 · ${rows.length}건 <button class="btn" type="button" data-unpick="1" style="margin-left:8px">닫기</button></h3><ul class="ev">${rows.map(r => `<li><span class="w">${mdh(r[0])}<br>${esc(r[1])}</span><span>${esc(r[2])}</span></li>`).join('') || '<li class="empty">이 시간대 기록이 없습니다.</li>'}</ul></div>`;
  }
  when();
  root.onclick = e => {
    const b = e.target.closest('[data-a],[data-r],[data-unpick]'); if (!b) return;
    if (b.dataset.unpick) { P1.pick = null; when(); return; }
    if (b.dataset.a) S1.a = b.dataset.a; if (b.dataset.r) S1.range = b.dataset.r; P1.pick = null; ss('mm-v1', S1); R[1](root, D);
  };
  root.onchange = e => { const c = e.target.closest('[data-l]'); if (c) { S1.L[c.dataset.l] = c.checked ? 1 : 0; ss('mm-v1', S1); R[1](root, D); } };
};

/* ---- 2. 질문 여섯 개 ---- */
R[2] = (root, D) => {
  const card = (n, q, ans, vis, go) => `<article class="qc"><span class="qn">질문 ${n}</span><h2>${q}</h2><p class="ans">${ans}</p>${vis}${go ? `<button type="button" class="more lnk" data-go="${go[0]}">${go[1]} →</button>` : ''}</article>`;
  const COL = { sup: 's1', res: 's2', ma: 's3', liq: 's4', oth: 'ink-3' };
  function q1() {
    const a = 'BTC', now = last(D, a), W = 520, H = 300, rng = 0.08;
    if (!now) return '';
    const cl = clusters(D, a, { rng }).filter(c => Math.abs(c.d) <= rng);
    const top = [...cl].sort((x, y) => y.n - x.n).slice(0, 12);
    const Y = d => 16 + (rng - d) / (2 * rng) * (H - 32);
    const up = cl.filter(c => c.d > 0).sort((x, y) => x.d - y.d)[0], dn = cl.filter(c => c.d < 0).sort((x, y) => y.d - x.d)[0];
    const n5 = cl.filter(c => Math.abs(c.d) <= 0.05).reduce((s, c) => s + c.n, 0);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="lad" role="img" aria-label="BTC 지금 가격 ±8% 안의 우리 가격선">`;
    for (const d of [-0.08, -0.04, 0, 0.04, 0.08]) s += `<line x1="70" x2="${W - 8}" y1="${Y(d)}" y2="${Y(d)}" stroke="var(--line)" ${d ? 'stroke-dasharray="2 4"' : ''}/><text x="62" y="${Y(d) + 4}" text-anchor="end">${d ? pct(d, 0) : ''}</text>`;
    const mx = Math.max(...top.map(c => c.n), 1); let lastY = -99;
    for (const c of top.sort((x, y) => y.d - x.d)) {
      const y = Y(c.d), w = 30 + c.n / mx * 150, showL = Math.abs(y - lastY) > 13;
      s += `<g ${tt(`${fp(c.p)} (${pct(c.d)}) · 언급 ${c.n}번`, c.label, LGNAME[c.gp])}><line class="tick" x1="78" x2="${78 + w}" y1="${y}" y2="${y}" stroke="var(--${COL[c.gp]})" stroke-linecap="round"/><rect x="70" y="${y - 7}" width="${W - 78}" height="14" fill="transparent"/>${showL ? `<text x="${86 + w}" y="${y + 4}">${fp(c.p)} · ${esc(c.label.slice(0, 22))}</text>` : ''}</g>`;
      if (showL) lastY = y;
    }
    s += `<line x1="70" x2="${W - 8}" y1="${Y(0)}" y2="${Y(0)}" stroke="var(--ink)" stroke-width="2"/><rect x="${W - 112}" y="${Y(0) - 11}" width="104" height="22" rx="5" fill="var(--ink)"/><text x="${W - 60}" y="${Y(0) + 4}" text-anchor="middle" style="fill:var(--bg);font-weight:700">지금 ${fp(now)}</text></svg>`;
    return card(1, 'BTC 지금 가격 근처, 우리가 중요하다고 한 선은?',
      `위로 가장 가까운 선은 <b>${up ? fp(up.p) + ' (' + pct(up.d) + ')' : '없음'}</b>, 아래는 <b>${dn ? fp(dn.p) + ' (' + pct(dn.d) + ')' : '없음'}</b>. 지금 ±5% 안에서 우리가 말한 가격은 <b>${n5}번</b>입니다.`,
      s + `<div class="key">${KEYS}<span class="mute">막대 길이 = 말한 횟수</span></div>`, [1, '차트 한 장에서 보기']);
  }
  function q2() {
    const L = D.items.ledger.filter(r => r.scored);
    const by = w => L.filter(r => r.who === w).sort((x, y) => (RESK[x.res] > RESK[y.res]) - (RESK[x.res] < RESK[y.res]) || x.t - y.t);
    const cnt = (arr, k) => arr.filter(r => RESK[r.res] === k).length;
    const row = (name, arr) => `<div class="r"><span>${name} ${arr.length}</span><div class="sq">${arr.map(r => `<i class="${RESK[r.res]}" ${tt(`${mdh(r.t)} ${r.a} · ${CAT[r.cat]}`, r.st, '결과: ' + RES[r.res])}></i>`).join('')}</div></div>`;
    return card(2, '우리 판정은 얼마나 맞았나?',
      `가격으로 채점할 수 있는 판정 <b>${L.length}개</b> 중 목표 도달 <b class="good">${cnt(L, 'good')}</b>, 조건만 충족(목표 미도달) <b class="warn">${cnt(L, 'warn')}</b>, 조건이 오지 않음 <b>${cnt(L, 'mute')}</b>, 무효 <b class="bad">${cnt(L, 'bad')}</b>${cnt(L, 'live') ? `, 결과 전 <b class="live">${cnt(L, 'live')}</b>` : ''}. 한 칸이 판정 하나입니다.`,
      `<div class="waf">${row('Claude', by('claude'))}${row('GPT', by('gpt'))}</div><div class="key"><span class="good"><i class="dot"></i>✓ 목표 도달</span><span class="warn"><i class="dot"></i>◐ 조건만 충족</span><span class="mute"><i class="dot"></i>· 조건 안 옴</span><span class="bad"><i class="dot"></i>✕ 무효</span><span class="live"><i class="dot"></i>… 결과 전·유지 중</span></div>
      <p class="mute" style="font-size:12px;margin:0">"서술·설명"처럼 가격 조건이 없는 판정 ${D.items.ledger.length - L.length}개는 넣지 않았습니다. 적중률 하나로 합치지 않습니다.</p>`, [5, '종목별로 보기']);
  }
  function q3() {
    const t0 = Math.floor((D.built + 9 * 36e5) / DAY) * DAY - 9 * 36e5, days = [...Array(14)].map((_, i) => t0 + i * DAY);
    const ev = d => D.cats.filter(c => c.t >= d && c.t < d + DAY), nx = D.cats.filter(c => c.t >= D.built).slice(0, 6);
    const dd = c => { const k = Math.floor((c.t - t0) / DAY); return k <= 0 ? '오늘' : 'D-' + k; };
    return card(3, '앞으로 2주, 무엇을 확인해야 하나?',
      `14일 동안 잡힌 일정 <b>${D.cats.filter(c => c.t >= t0 && c.t < t0 + 14 * DAY).length}개</b>. 가장 가까운 것은 <b>${nx[0] ? esc(nx[0].ev) + ' (' + dd(nx[0]) + ')' : '없음'}</b>입니다.`,
      `<div class="cal">${days.map((d, i) => { const e = ev(d); return `<div class="d ${i ? '' : 'today'}" ${e.length ? tt(md(d) + ' 일정 ' + e.length + '개', ...e.map(c => (c.time || '') + ' ' + c.ev)) : ''}><span class="n k${Math.min(3, e.length)}">${e.length || ''}</span><span>${md(d)}</span></div>`; }).join('')}</div>
      <ul class="lst">${nx.map(c => `<li><span class="w">${dd(c)}<br>${c.date.slice(5)}${c.time ? ' ' + c.time : ''}</span><span>${esc(c.ev)}${c.exp ? `<br><span class="w">${esc(c.exp)}</span>` : ''}</span></li>`).join('')}</ul>`, [4, '하루씩 보기']);
  }
  function q4() {
    const end = D.built, a0 = end - 7 * DAY, b0 = end - 14 * DAY, all = [...D.items.timeline, ...D.items.ledger, ...D.items.ladder, ...D.items.radar];
    const rows = D.meta.issues.filter(i => !i.fixed).map(i => { const it = all.filter(r => (r.iss || []).includes(i.id)); return { i, now: it.filter(r => r.t > a0).length, pre: it.filter(r => r.t > b0 && r.t <= a0).length }; })
      .filter(r => r.now + r.pre).sort((x, y) => y.now - x.now).slice(0, 8);
    const mx = Math.max(...rows.map(r => Math.max(r.now, r.pre)), 1), W = 520, rh = 30, H = rows.length * rh + 26, x0 = 170, X = v => x0 + v / mx * (W - x0 - 40);
    let s = `<svg viewBox="0 0 ${W} ${H}" class="dd" role="img" aria-label="사안별 최근 7일과 그 전 7일 기록 수">`;
    rows.forEach((r, k) => { const y = 14 + k * rh; s += `<g ${tt(r.i.label, `최근 7일 ${r.now}건 · 그 전 7일 ${r.pre}건`)}><rect x="0" y="${y - 12}" width="${W}" height="${rh - 4}" fill="transparent"/><text x="0" y="${y + 4}">${esc(r.i.label.slice(0, 14))}</text><line class="a" x1="${X(r.pre)}" x2="${X(r.now)}" y1="${y}" y2="${y}"/><circle class="p0" cx="${X(r.pre)}" cy="${y}" r="5"/><circle class="p1" cx="${X(r.now)}" cy="${y}" r="6"/><text x="${X(Math.max(r.now, r.pre)) + 10}" y="${y + 4}" style="fill:var(--ink);font-weight:700">${r.now}</text></g>`; });
    s += `</svg>`;
    const upMost = [...rows].sort((x, y) => (y.now - y.pre) - (x.now - x.pre))[0];
    return card(4, '요즘 무엇을 가장 많이 말하나?',
      `최근 7일 가장 많이 다룬 사안은 <b>${esc(rows[0]?.i.label || '—')}</b>(${rows[0]?.now || 0}건). 그 전 주보다 가장 많이 늘어난 것은 <b>${esc(upMost?.i.label || '—')}</b>(${upMost?.pre ?? 0}→${upMost?.now ?? 0}).`,
      s + `<div class="key"><span><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" fill="var(--surface)" stroke="var(--ink-3)" stroke-width="2"/></svg>그 전 7일</span><span style="color:var(--s1)"><i class="dot"></i>최근 7일</span><span class="mute">글·판정·가격선·정정 수</span></div>`, [3, '사안별로 보기']);
  }
  function q5() {
    const R5 = D.items.radar; if (!R5.length) return '';
    const kst0 = Math.min(...R5.map(r => r.t)), wk = t => Math.floor((t - kst0) / (7 * DAY));
    const typ = r => r.type === '이견' ? 4 : r.who === 'gpt' && r.tgt === 'claude' ? 1 : r.who === 'claude' && r.tgt === 'claude' ? 3 : 2;
    const NM = { 1: 'GPT가 Claude를 정정', 2: '그 밖의 정정', 3: 'Claude 스스로 정정', 4: '이견' };
    const nW = wk(D.built) + 1, cols = [...Array(nW)].map((_, w) => [1, 2, 3, 4].map(k => R5.filter(r => wk(r.t) === w && typ(r) === k).length));
    const W = 520, H = 170, mx = Math.max(...cols.map(c => c.reduce((s, v) => s + v, 0)), 1), bw = (W - 20) / nW - 10;
    let s = `<svg viewBox="0 0 ${W} ${H}" class="cols" role="img" aria-label="주별 정정·이견 수">`;
    cols.forEach((c, w) => {
      let y = H - 22; const x = 10 + w * (bw + 10);
      c.forEach((v, k) => { if (!v) return; const h = v / mx * (H - 40); y -= h; s += `<rect class="c${k + 1}" x="${x}" y="${y}" width="${bw}" height="${Math.max(0, h - 2)}" rx="3" ${tt(`${md(kst0 + w * 7 * DAY)}~ 주`, `${NM[k + 1]} ${v}건`)}/>`; });
      s += `<text x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${md(kst0 + w * 7 * DAY)}~</text><text x="${x + bw / 2}" y="${y - 5}" text-anchor="middle" style="fill:var(--ink);font-weight:700">${c.reduce((a, b) => a + b, 0)}</text>`;
    });
    s += `</svg>`;
    const lastFix = R5.filter(r => r.type === '정정').sort((x, y) => y.t - x.t).slice(0, 3);
    return card(5, '누가 무엇을 고쳤나?',
      `정정 <b>${R5.filter(r => r.type === '정정').length}건</b>, 이견 <b>${R5.filter(r => r.type === '이견').length}건</b>. 그중 GPT가 Claude를 바로잡은 것이 <b>${R5.filter(r => typ(r) === 1).length}건</b>, Claude가 스스로 고친 것이 <b>${R5.filter(r => typ(r) === 3).length}건</b>입니다.`,
      s + `<div class="key"><span style="color:var(--s2)"><i class="dot"></i>GPT→Claude 정정</span><span style="color:var(--s1)"><i class="dot"></i>Claude 자기 정정</span><span style="color:var(--s3)"><i class="dot"></i>그 밖의 정정</span><span style="color:var(--ink-3)"><i class="dot"></i>이견</span></div>
      <ul class="arr">${lastFix.map(r => `<li><span class="mute" style="font-size:12px">${mdh(r.t)}</span><span>${esc(r.a)}</span><span class="to">→</span><b>${esc(r.b)}</b></li>`).join('')}</ul>`);
  }
  function q6() {
    const C = D.items.contagion; if (!C.length) return '';
    const ok = C.filter(c => c.st === '확인').length, recent = [...C].reverse().slice(0, 6);
    return card(6, '무엇이 무엇을 움직인다고 봤나?',
      `원인→결과로 말한 연결 <b>${C.length}개</b> 중 실제로 확인된 것은 <b>${ok}개</b>뿐이고, 나머지 ${C.length - ok}개는 추정입니다.`,
      `<svg viewBox="0 0 520 26" role="img" aria-label="확인 ${ok}, 추정 ${C.length - ok}"><rect x="0" y="4" width="${Math.max(0, ok / C.length * 520 - 2)}" height="18" rx="4" fill="var(--good)"/><rect x="${ok / C.length * 520}" y="4" width="${(1 - ok / C.length) * 520}" height="18" rx="4" fill="var(--h1)"/><text x="8" y="17" style="font-size:11.5px;fill:#fff;font-weight:700">확인 ${ok}</text><text x="${ok / C.length * 520 + 8}" y="17" style="font-size:11.5px;fill:var(--ink)">추정 ${C.length - ok}</text></svg>
      <ul class="arr">${recent.map(c => `<li><b>${esc(c.a)}</b><span class="to">→</span><b>${esc(c.b)}</b><span class="badge ${c.st === '확인' ? 'ok' : ''}">${c.st}</span><span class="why">${esc(c.how || '')}</span></li>`).join('')}</ul>`);
  }
  root.innerHTML = pastNote(D) + `<div class="qs">${q1() + q2() + q3() + q4() + q5() + q6()}</div>`;
  root.onclick = e => { const b = e.target.closest('[data-go]'); if (b) root.dispatchEvent(new CustomEvent('vw-go', { bubbles: true, detail: +b.dataset.go })); };
  root.onchange = null;
};

/* ---- 3. 사안별 이야기 ---- */
const S3 = Object.assign({ i: null, a: null }, ss('mm-v3') || {});
export function pick(id) { S3.i = id; S3.a = null; ss('mm-v3', S3); }
R[3] = (root, D) => {
  const sn = D.snap, has = (r, id) => (r.iss || []).includes(id);
  if (!S3.i || !D.iss[S3.i]) S3.i = sn.major[0];
  const scoreLine = id => { const v = D.snaps.map(s => s.sc[id]?.s ?? 0), w = 70, h = 26, mx = Math.max(...v, 0.1); return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" class="spk" aria-hidden="true"><path d="${v.map((x, i) => `${i ? 'L' : 'M'}${(i / Math.max(1, v.length - 1) * (w - 2) + 1).toFixed(1)},${(h - 2 - x / mx * (h - 4)).toFixed(1)}`).join('')}"/></svg>`; };
  const grp = (t, ids) => `<div class="grp">${t}</div>` + ids.filter(id => D.iss[id]).map(id => `<button class="ii" type="button" data-i="${id}" aria-pressed="${S3.i === id}"><span class="lb">${esc(D.iss[id].label)}</span><span class="mt">${sn.status[id] || ''} · 글 ${D.items.timeline.filter(r => has(r, id)).length}</span>${scoreLine(id)}</button>`).join('');
  const id = S3.i, I = D.iss[id], sc = sn.sc[id] || {};
  const assets = I.assets.filter(a => D.px[a]), a = assets.includes(S3.a) ? S3.a : assets[0];
  const posts = D.items.timeline.filter(r => has(r, id)).sort((x, y) => y.t - x.t), calls = D.items.ledger.filter(r => has(r, id)).sort((x, y) => y.t - x.t);
  const cats = D.cats.filter(c => has(c, id)), fx = D.items.radar.filter(r => has(r, id)).sort((x, y) => y.t - x.t), ct = D.items.contagion.filter(r => has(r, id));
  const tot = (sc.m || 0) + (sc.q || 0) + (sc.p || 0) + (sc.o || 0) || 1, lead = posts.find(r => (r.rel || []).includes(id)) || posts[0];
  const scored = calls.filter(r => r.scored), k = x => scored.filter(r => RESK[r.res] === x).length;
  const cl = a ? clusters(D, a, { iss: id, rng: 0.3 }) : [], now = a ? last(D, a) : null;
  const near = [...cl.filter(c => c.d > 0).sort((x, y) => x.d - y.d).slice(0, 3).reverse(), ...cl.filter(c => c.d <= 0).sort((x, y) => y.d - x.d).slice(0, 3)];
  const nextC = cats.filter(c => c.t > D.built - DAY / 2).slice(0, 5), pastC = cats.filter(c => c.t <= D.built - DAY / 2).slice(-3).reverse();
  root.innerHTML = pastNote(D) + `<div class="s3"><nav class="il" aria-label="사안">${grp('주요 자리', sn.major) + grp('관찰', sn.rest) + grp('고정', ['thesis'])}</nav><div class="story">
  <div class="sh"><h2>${esc(I.label)}</h2><span class="chip ${sn.status[id] || ''}">${sn.status[id] || ''}</span><span class="mute" style="font-size:13px">글 ${posts.length} · 판정 ${calls.length} · 일정 ${cats.length} · 정정·이견 ${fx.length} · 연결 ${ct.length}</span></div>
  ${lead ? `<p class="lede"><b>${esc(lead.title)}</b> — ${esc(lead.gist)}<br><span class="w">${mdh(lead.t)} ${WHO[lead.who] || lead.who} ${KIND[lead.kind] || ''} · 이 사안의 가장 최근 글</span></p>` : '<p class="lede mute">이 날까지 이 사안의 글이 없습니다.</p>'}
  <div class="why"><span class="mute">왜 이 무게?</span><div class="bar" ${tt('점수 ' + (sc.s ?? 0).toFixed(1), `최근 언급 ${(sc.m || 0).toFixed(1)} · 질문 ${(sc.q || 0).toFixed(1)} · 가격 영향 ${(sc.p || 0).toFixed(1)} · 일정·정정 ${(sc.o || 0).toFixed(1)}`)}><i class="m" style="width:${(sc.m || 0) / tot * 100}%"></i><i class="q" style="width:${(sc.q || 0) / tot * 100}%"></i><i class="p" style="width:${(sc.p || 0) / tot * 100}%"></i><i class="o" style="width:${(sc.o || 0) / tot * 100}%"></i></div>
  <span></span><div class="legend"><span style="--c:var(--s1)">최근 언급</span><span style="--c:var(--s2)">사용자 질문</span><span style="--c:var(--s3)">가격 영향</span><span style="--c:var(--s4)">일정·정정</span></div></div>
  ${a ? `<div class="chartbox">${assets.length > 1 ? `<div class="ltabs" style="margin-bottom:8px">${assets.map(x => `<button type="button" data-a="${x}" aria-pressed="${x === a}">${x}</button>`).join('')}</div>` : ''}<div class="row" style="justify-content:space-between"><b>${a} ${fp(now)} <span class="mute" style="font-weight:400">7일 ${pct(chg(D, a, 7))}</span></b><span class="mute" style="font-size:12px">이 사안에 걸린 기록만 겹쳤습니다</span></div><div id="v-ch"></div>
  <div class="key">${KEYS}<span class="claude"><i class="dot"></i>Claude 글</span><span class="gpt"><i class="dot"></i>GPT 글</span><span>▪ 일정</span></div></div>` : ''}
  <div class="blocks">
    <div class="panel"><h3>판정 ${scored.length ? `<span class="mute" style="font-weight:400">채점 ${scored.length} · <span class="good">✓${k('good')}</span> <span class="warn">◐${k('warn')}</span> · ${k('mute')} <span class="bad">✕${k('bad')}</span></span>` : ''}</h3><ul class="ev">${calls.slice(0, 5).map(r => `<li>${r.scored ? `<span class="rb ${RESK[r.res]}">${RESI[RESK[r.res]]} ${RES[r.res]}</span>` : `<span class="rb mute">${CAT[r.cat] || '서술'}</span>`}<span>${esc(r.st)}<br><span class="w">${mdh(r.t)} ${WHO[r.who] || r.who} · ${r.a}</span></span></li>`).join('') || '<li class="empty">이 사안의 판정이 없습니다.</li>'}</ul></div>
    <div class="panel"><h3>${a || ''} 가격선 <span class="mute" style="font-weight:400">지금 ${fp(now)} 기준</span></h3><ul class="ev">${near.map(c => `<li><span class="w" style="min-width:58px;text-align:right">${pct(c.d)}</span><span><b>${fp(c.p)}</b> ${esc(c.label)} <span class="w">${LGNAME[c.gp]} · ${c.n}번</span></span></li>`).join('') || '<li class="empty">이 사안에 걸린 가격선이 없습니다.</li>'}</ul></div>
    <div class="panel"><h3>일정</h3><ul class="ev">${nextC.map(c => `<li><span class="w"><b>${c.date.slice(5)}</b>${c.time ? ' ' + c.time : ''}</span><span>${esc(c.ev)}${c.exp ? `<br><span class="w">${esc(c.exp)}</span>` : ''}</span></li>`).join('')}${pastC.map(c => `<li class="mute"><span class="w">${c.date.slice(5)} 지남</span><span>${esc(c.ev)}${c.out ? ' → ' + esc(c.out) : ''}</span></li>`).join('')}${cats.length ? '' : '<li class="empty">이 사안에 걸린 일정이 없습니다.</li>'}</ul></div>
    <div class="panel"><h3>정정·이견과 연결</h3><ul class="ev">${fx.slice(0, 3).map(r => `<li><span class="w">${md(r.t)} ${r.type}</span><span>${esc(r.a)} → <b>${esc(r.b)}</b></span></li>`).join('')}${ct.slice(-3).map(c => `<li><span class="w">연결 · ${c.st}</span><span><b>${esc(c.a)}</b> → <b>${esc(c.b)}</b><br><span class="w">${esc(c.how || '')}</span></span></li>`).join('')}${fx.length + ct.length ? '' : '<li class="empty">없음</li>'}</ul></div>
  </div>
  <div class="panel"><h3 style="font-size:14px;margin:0 0 10px">이 사안의 글 흐름 (최근 8개)</h3><ul class="tl">${posts.slice(0, 8).map(r => `<li class="${r.who}"><span class="w">${mdh(r.t)} · ${WHO[r.who] || r.who} ${KIND[r.kind] || ''}</span><br><b>${esc(r.title)}</b> ${esc(r.gist.slice(0, 120))}</li>`).join('') || '<li class="mute">없음</li>'}</ul></div></div></div>`;
  if (a) priceChart(root.querySelector('#v-ch'), D, a, { iss: id, future: 3 * DAY, h: innerWidth < 560 ? 260 : 340 });
  root.onclick = e => {
    const b = e.target.closest('[data-i],[data-a]'); if (!b) return;
    if (b.dataset.i) { S3.i = b.dataset.i; S3.a = null; } if (b.dataset.a) S3.a = b.dataset.a; ss('mm-v3', S3); R[3](root, D);
    if (b.dataset.i && innerWidth < 900) root.querySelector('.story').scrollIntoView({ behavior: 'smooth' });
  };
  root.onchange = null;
};

/* ---- 4. 하루씩 흐름 ---- */
R[4] = (root, D) => {
  const dayKey = t => new Date(t + 9 * 36e5).toISOString().slice(0, 10), WD = ['일', '월', '화', '수', '목', '금', '토'];
  const all = [...D.items.timeline.map(r => ({ k: 'post', r })), ...D.items.ledger.map(r => ({ k: 'call', r })), ...D.items.ladder.map(r => ({ k: 'lv', r })), ...D.items.radar.map(r => ({ k: 'fix', r }))];
  const by = {}; for (const x of all) (by[dayKey(x.r.t)] ||= []).push(x);
  const first = Math.min(...D.items.timeline.map(r => r.t)), keys = [];
  for (let t = first; t <= D.built; t += DAY) keys.push(dayKey(t));
  if (!keys.includes(dayKey(D.built))) keys.push(dayKey(D.built));
  const px = D.px.BTC;
  const btcDay = k => {
    if (!px) return null;
    const t0 = Date.parse(k + 'T00:00:00+09:00'), t1 = t0 + DAY, ix = px.t.map((t, i) => i).filter(i => px.t[i] >= t0 - 4 * 36e5 && px.t[i] < t1);
    if (!ix.length) return null;
    const c = ix.map(i => px.c[i]);
    return { o: ix[0] > 0 ? px.c[ix[0] - 1] : px.o[ix[0]], c: c[c.length - 1], lo: Math.min(...ix.map(i => px.l[i])), hi: Math.max(...ix.map(i => px.h[i])), s: c };
  };
  const candle = b => {
    if (!b) return '<span class="mute">가격 없음</span>';
    const W = 120, H = 44, mn = Math.min(b.lo, b.o), mx = Math.max(b.hi, b.o), Y = v => 3 + (mx - v) / (mx - mn || 1) * (H - 6);
    const pts = [b.o, ...b.s].map((v, i, arr) => `${i ? 'L' : 'M'}${(i / (arr.length - 1) * (W - 4) + 2).toFixed(1)},${Y(v).toFixed(1)}`).join(''), up = b.c >= b.o;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true"><line x1="0" x2="${W}" y1="${Y(b.o)}" y2="${Y(b.o)}" stroke="var(--line)" stroke-dasharray="2 3"/><path d="${pts}" fill="none" stroke="var(${up ? '--good' : '--critical'})" stroke-width="1.8"/></svg><div>BTC <b>${fp(b.c)}</b> <b class="${up ? 'pos' : 'neg'}">${pct(b.c / b.o - 1)}</b></div><div class="mute">범위 ${fp(b.lo)}–${fp(b.hi)}</div>`;
  };
  const mx = Math.max(...keys.map(k => (by[k] || []).length), 1);
  const heat = keys.map((k, i) => { const n = (by[k] || []).length, lv = n ? Math.min(6, 1 + Math.floor(n / mx * 5.99)) : 0, d = new Date(k + 'T00:00:00+09:00'); return `<button type="button" class="k${lv} ${d.getDay() === 1 || i === 0 ? 'wk' : ''}" data-go4="${k}" data-l="${k.slice(5).replace('-', '/')}" aria-label="${k} 기록 ${n}건" ${tt(`${k.slice(5)} (${WD[d.getDay()]})`, `기록 ${n}건`)}></button>`; }).join('');
  const days = [...keys].reverse().map(k => {
    const xs = by[k] || [], d = new Date(k + 'T00:00:00+09:00');
    const posts = xs.filter(x => x.k === 'post').map(x => x.r).sort((a, b) => (b.kind === 'research') - (a.kind === 'research') || b.t - a.t);
    const calls = xs.filter(x => x.k === 'call').length, lvs = xs.filter(x => x.k === 'lv').length, fx = xs.filter(x => x.k === 'fix').length, cats = D.cats.filter(c => c.date === k);
    const iss = {}; for (const x of xs) for (const i of x.r.iss || []) iss[i] = (iss[i] || 0) + 1;
    const top = Object.entries(iss).sort((a, b) => b[1] - a[1]).slice(0, 4), hl = posts[0];
    const rows = [...xs].sort((a, b) => a.r.t - b.r.t).map(({ k: t, r }) =>
      t === 'post' ? [r.t, `${WHO[r.who] || r.who} ${KIND[r.kind] || ''}`, `<b>${esc(r.title)}</b> ${esc(r.gist)}`] :
      t === 'call' ? [r.t, `판정 · ${r.a}`, esc(r.st) + (r.scored ? ` <span class="rb ${RESK[r.res]}">${RESI[RESK[r.res]]} ${RES[r.res]}</span>` : '')] :
      t === 'lv' ? [r.t, `가격선 · ${r.a}`, `<b>${fp(r.price)}</b> ${esc(r.label)}`] : [r.t, r.type, `${esc(r.a)} → <b>${esc(r.b)}</b>`]);
    return `<article class="dy" id="v-d${k}"><div class="dt"><b>${k.slice(5).replace('-', '/')}</b><span>${WD[d.getDay()]}요일</span></div><div class="px">${candle(btcDay(k))}</div>
    <div class="bd">${hl ? `<div class="hd">${esc(hl.title)}</div><div class="gs">${esc(hl.gist.slice(0, 160))}</div>` : `<div class="gs mute">이날은 리서치 글이 없습니다.</div>`}
    <div class="cnt"><span>글 <b>${posts.length}</b></span><span>판정 <b>${calls}</b></span><span>가격선 <b>${lvs}</b></span><span>정정·이견 <b>${fx}</b></span>${cats.length ? `<span>일정 <b>${cats.length}</b> ${esc(cats.map(c => c.ev).join(', ').slice(0, 60))}</span>` : ''}</div>
    ${top.length ? `<div class="ich">${top.map(([i, n]) => `<span class="chip">${esc(D.iss[i]?.label || i)} ${n}</span>`).join('')}</div>` : ''}
    ${rows.length ? `<details class="all"><summary>이날 기록 ${rows.length}건 모두 보기</summary><ul class="ev">${rows.map(r => `<li><span class="w">${mdh(r[0]).split(' ')[1]}<br>${esc(r[1])}</span><span>${r[2]}</span></li>`).join('')}</ul></details>` : ''}</div></article>`;
  }).join('');
  root.innerHTML = pastNote(D) + `<div class="heat" role="group" aria-label="날짜별 기록 수">${heat}</div><div class="hk">적음 <i style="background:var(--h1)"></i><i style="background:var(--h3)"></i><i style="background:var(--h5)"></i> 많음</div><div class="days">${days}</div>`;
  root.onclick = e => {
    const b = e.target.closest('[data-go4]'); if (!b) return;
    const el = root.querySelector('#v-d' + b.dataset.go4); if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' }); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1400);
  };
  root.onchange = null;
};

/* ---- 5. 종목 한 줄씩 ---- */
const S5 = { open: null };
R[5] = (root, D) => {
  const A = Object.keys(D.px);
  const mention = (a, t0, t1) => [...D.items.timeline.filter(r => (r.assets || []).includes(a)), ...D.items.ledger.filter(r => r.a === a), ...D.items.ladder.filter(r => r.a === a)].filter(r => r.t >= t0 && r.t < t1);
  const t7 = D.built - 7 * DAY;
  const rowsA = A.map(a => ({ a, n7: mention(a, t7, D.built + 1).length, n: mention(a, 0, D.built + 1).length })).sort((x, y) => y.n7 - x.n7 || y.n - x.n);
  const COL = { sup: 's1', res: 's2', ma: 's3', liq: 's4', oth: 'ink-3' };
  const track = a => {
    const cl = clusters(D, a, { rng: 0.12 }), W = 230, H = 44, X = d => W / 2 + d / 0.12 * (W / 2 - 6);
    const up = cl.filter(c => c.d > 0).sort((x, y) => x.d - y.d)[0], dn = cl.filter(c => c.d < 0).sort((x, y) => y.d - x.d)[0];
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" class="trk" role="img" aria-label="${a} 가격선 거리"><line x1="4" x2="${W - 4}" y1="18" y2="18" stroke="var(--line)" stroke-width="6" stroke-linecap="round"/>`;
    for (const c of cl) s += `<line x1="${X(c.d)}" x2="${X(c.d)}" y1="${18 - 5 - Math.min(6, c.n)}" y2="${18 + 5 + Math.min(6, c.n)}" stroke="var(--${COL[c.gp]})" stroke-width="2.5" ${tt(`${fp(c.p)} (${pct(c.d)}) · ${c.n}번`, c.label)}/>`;
    s += `<line x1="${W / 2}" x2="${W / 2}" y1="4" y2="32" stroke="var(--ink)" stroke-width="2.5"/>`;
    if (dn) s += `<text x="${X(dn.d)}" y="${H - 1}" text-anchor="middle">${pct(dn.d)}</text>`;
    if (up) s += `<text x="${X(up.d)}" y="${H - 1}" text-anchor="middle">${pct(up.d)}</text>`;
    return s + `</svg>`;
  };
  const heat = a => { const t0 = Math.floor((D.built + 9 * 36e5) / DAY) * DAY - 9 * 36e5 - 13 * DAY; return `<div class="hm">${[...Array(14)].map((_, i) => { const n = mention(a, t0 + i * DAY, t0 + (i + 1) * DAY).length; return `<i class="k${n ? Math.min(3, 1 + Math.floor(n / 6)) : 0}" ${tt(md(t0 + i * DAY), `${a} 기록 ${n}건`)}></i>`; }).join('')}</div>`; };
  const nextCat = a => {
    const re = new RegExp(a, 'i'), iss = D.meta.issues.filter(i => i.assets.includes(a)).map(i => i.id);
    const c = D.cats.find(c => c.t > D.built - DAY / 2 && (re.test(c.ev) || (c.iss || []).some(i => iss.includes(i) && a !== 'BTC'))) || (a === 'BTC' ? D.cats.find(c => c.t > D.built - DAY / 2) : null);
    return c ? `<div class="nx"><b>${c.date.slice(5)}${c.time ? ' ' + c.time : ''}</b> ${esc(c.ev)}</div>` : '<span class="mute" style="font-size:12px">걸린 일정 없음</span>';
  };
  let h = `<div class="mr hd"><span>종목 · 지금</span><span>30일 흐름(4시간봉)</span><span>지금 가격 ±12% 안의 우리 선</span><span>판정 결과</span><span>최근 14일 언급</span><span>다음 일정</span></div>`;
  for (const { a, n7 } of rowsA) {
    const calls = D.items.ledger.filter(r => r.a === a && r.scored).sort((x, y) => x.t - y.t), c7 = chg(D, a, 7);
    h += `<div class="mr" role="button" tabindex="0" data-a5="${a}" aria-expanded="${S5.open === a}"><div class="nm"><b>${a}</b><div>${fp(last(D, a))} <span class="${c7 >= 0 ? 'pos' : 'neg'}">${pct(c7)}</span></div><div class="sub">7일 기록 ${n7}건</div></div>
      <div>${spark(D, a, 150, 40, 30)}</div><div>${track(a)}</div>
      <div>${calls.length ? `<div class="dots">${calls.map(r => `<i class="${RESK[r.res]}" ${tt(`${mdh(r.t)} ${WHO[r.who] || r.who}`, r.st, RES[r.res])}></i>`).join('')}</div><div class="sub">채점 ${calls.length} · ✓${calls.filter(r => RESK[r.res] === 'good').length} ◐${calls.filter(r => RESK[r.res] === 'warn').length} ✕${calls.filter(r => RESK[r.res] === 'bad').length}</div>` : '<span class="mute" style="font-size:12px">채점 판정 없음</span>'}</div>
      <div>${heat(a)}</div><div>${nextCat(a)}</div></div>`;
    if (S5.open === a) h += `<div class="det"><div id="v-ch5"></div><div class="key">${KEYS}<span class="good"><i class="dash"></i>판정 ✓</span><span class="warn"><i class="dash"></i>◐</span><span class="bad"><i class="dash"></i>✕</span><span class="claude"><i class="dot"></i>Claude 글</span><span class="gpt"><i class="dot"></i>GPT 글</span></div></div>`;
  }
  root.innerHTML = pastNote(D) + `<p class="mute" style="font-size:13px;margin:0 0 6px">순서: 최근 7일 동안 그 종목을 다룬 기록이 많은 순. 가격선 칸의 가운데 굵은 선이 지금 가격, 눈금은 우리가 말한 가격(±12% 안)입니다.</p><div class="mx"><div class="in">${h}<div class="mr hd" style="position:static"><span class="mute" style="font-weight:400">판정 점: <span class="good">●목표 도달</span> <span class="warn">●조건만 충족</span> ○조건 안 옴 <span class="bad">●무효</span> <span class="live">●결과 전</span></span></div></div></div>`;
  if (S5.open && D.px[S5.open]) { const el = root.querySelector('#v-ch5'); el.style.width = Math.min(root.clientWidth - 30, 1100) + 'px'; priceChart(el, D, S5.open, { future: 3 * DAY, h: 360 }); }
  root.onclick = e => { const r = e.target.closest('.mr[data-a5]'); if (!r) return; S5.open = S5.open === r.dataset.a5 ? null : r.dataset.a5; R[5](root, D); };
  root.onkeydown = e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.mr[data-a5]')) { e.preventDefault(); e.target.click(); } };
  root.onchange = null;
};
