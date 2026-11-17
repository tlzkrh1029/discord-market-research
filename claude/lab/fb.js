// 피드백 남기는 방법 19가지 시안. fb.html#0(목록) ~ #19. 대부분 저장하지 않는 모형이다.
import { load, esc, theme } from './lab.js';

const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
const REPO = 'https://github.com/tlzkrh1029/discord-market-research';
const TODAY = new Date(Date.now() + 9 * 36e5).toISOString().slice(0, 10);
const VIEW = $('#view');
theme();
let D;
try { D = await load(); } catch (e) { VIEW.innerHTML = `<p class="empty">데이터를 읽지 못했습니다(${esc(e.message)}).</p>`; throw e; }

// 데이터 ---------------------------------------------------------------
const TH = D.now.curated.thesis, T = D.now.thesis, CUR = D.now.curated.issues || {}, H = D.now.thesis_hist || { w208: [], m48: [] };
const CONDS = TH.cond.map((c, i) => ({ ...c, k: 'c' + (i + 1), fid: 'thesis.c' + (i + 1) }));
const AG = TH.against.map((t, i) => ({ t, k: 'a' + (i + 1), fid: 'thesis.a' + (i + 1) }));
const MAJ = D.snap.major, ALL = MAJ.concat(D.snap.rest), SC = D.snap.sc;
const LBL = id => D.iss[id]?.label || id;
const MAX = Math.max(...ALL.map(i => SC[i]?.s || 0), 1);
const TXT = { 'thesis.idea': TH.idea };
for (const c of CONDS) TXT[c.fid] = c.t;
for (const a of AG) TXT[a.fid] = a.t;
for (const id of ALL) TXT['issue.' + id] = LBL(id);
const FIDS = Object.keys(TXT);
const condBy = re => CONDS.find(c => re.test(c.t));

// 작은 도구 -------------------------------------------------------------
const short = (s, n = 26) => { s = String(s ?? ''); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const fbLine = (fid, k, m) => `[FB ${fid} @${TODAY}] ${k}: ${m || '(메모 없음)'} ‹${short(TXT[fid])}›`;
const ST = s => /^(충족|충족 중|안 넘음)$/.test(s) ? 'ok' : s === '불충족' ? 'no' : /미확인/.test(s) ? 'unk' : /(걸림|근접)/.test(s) ? 'risk' : 'wait';
const ICON = { ok: '✓', no: '✕', unk: '?', risk: '!', wait: '…' };
const stc = s => `<span class="st ${ST(s)}">${ICON[ST(s)]} ${esc(s)}</span>`;
const g = x => `<span class="g ${esc(x)}">${esc(x)}</span>`;
const n0 = v => Math.round(v).toLocaleString('en-US');
const pp = (v, d = 2) => (v > 0 ? '+' : '') + v.toFixed(d) + '%'; // v는 퍼센트 단위
const hash = s => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const snowT = id => { try { return Number(BigInt(id) >> 22n) + 1420070400000; } catch { return null; } };
const kdt = t => new Date(t + 9 * 36e5).toISOString().slice(5, 16).replace('T', ' ').replace('-', '/');
const addDays = (d, n) => new Date(Date.parse(d + 'T00:00:00Z') + n * 864e5).toISOString().slice(0, 10);
const mdS = d => d.slice(5).replace('-', '/');
const CM = sha => `${REPO}/commit/${sha}`;
const ext = (h, t) => `<a href="${esc(h)}" target="_blank" rel="noopener noreferrer">${t} ↗</a>`;

// 저장: mm-fb- 접두어, 모든 접근은 try/catch. 막혀 있어도 화면은 돈다
const store = {
  ok: (() => { try { localStorage.setItem('mm-fb-t', '1'); localStorage.removeItem('mm-fb-t'); return true; } catch { return false; } })(),
  get(k, d) { try { const v = localStorage.getItem('mm-fb-' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('mm-fb-' + k, JSON.stringify(v)); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem('mm-fb-' + k); } catch { } },
};
const saveNote = () => store.ok ? '이 브라우저에만 저장됩니다(localStorage). Claude나 다른 기기에는 보이지 않습니다.' : '이 브라우저가 저장을 막고 있어 창을 닫으면 사라집니다.';

// 복사: clipboard → 숨은 textarea → 글을 골라 두고 ⌘C 안내
async function copy(text, out, quiet) {
  // 먼저 동기 복사(클릭 직후라 권한 문제 적음), 안 되면 clipboard API를 1.5초까지만 기다린다
  const keep = document.activeElement;
  let ok = false;
  try { const ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0'; (DLG.open ? DLG : document.body).append(ta); ta.select(); ok = document.execCommand('copy'); ta.remove(); } catch { }
  keep?.focus?.({ preventScroll: true });
  if (!ok && navigator.clipboard) ok = await Promise.race([navigator.clipboard.writeText(text).then(() => true, () => false), new Promise(r => setTimeout(() => r(false), 1500))]);
  if (out) {
    out.innerHTML = (quiet && ok ? '' : `<pre class="out" tabindex="0">${esc(text)}</pre>`) + `<p class="okmsg" role="status">${ok ? '✓ 복사했습니다. Discord 채널에 붙여 넣으세요.' : '복사가 막혀 있습니다. 위 글을 골라 두었으니 ⌘C(Ctrl+C)로 복사하세요.'}</p>`;
    const p = !ok && $('pre', out);
    if (p) { const r = document.createRange(); r.selectNodeContents(p); const s = getSelection(); s.removeAllRanges(); s.addRange(r); p.focus(); }
  }
  return ok;
}

// 대화상자 하나를 돌려 쓴다
const DLG = document.createElement('dialog'); DLG.className = 'dlg'; document.body.append(DLG);
function ask(o, fn) {
  const kinds = o.kinds || ['동의', '반대', '수정'];
  DLG.innerHTML = `<form class="fbf" novalidate>
    <h3 class="h3">${esc(o.title || '의견 남기기')}</h3>
    <p class="src" style="margin:0">${esc(o.fid)} · ${esc(short(TXT[o.fid] || '', 70))}</p>
    ${kinds.length > 1 ? `<fieldset class="seg"><legend>종류</legend>${kinds.map((k, i) => `<label><input type="radio" name="k" value="${esc(k)}"${i ? '' : ' checked'}><span>${esc(k)}</span></label>`).join('')}</fieldset>` : `<input type="hidden" name="k" value="${esc(kinds[0])}">`}
    <label class="fl"><span>${esc(o.memo || '메모')}</span><textarea name="m" rows="3" placeholder="${esc(o.ph || '한두 줄이면 충분합니다')}"></textarea></label>
    ${o.extra || ''}
    <div class="res" aria-live="polite"></div>
    <div class="row"><button class="btn pri" type="submit">${esc(o.ok || '확인')}</button><button class="btn" type="button" data-close>닫기</button></div>
    ${o.note ? `<p class="src" style="margin:0">${esc(o.note)}</p>` : ''}
  </form>`;
  const f = $('form', DLG);
  f.onsubmit = e => { e.preventDefault(); const r = fn({ k: f.elements.k.value, m: f.elements.m.value.trim(), res: $('.res', f), f }); if (r !== false) DLG.close(); };
  $('[data-close]', f).onclick = () => DLG.close();
  if (o.init) o.init(f);
  DLG.showModal(); f.elements.m.focus();
}

// 툴팁(차트용)
const TIP = document.createElement('div'); TIP.className = 'fbtip'; TIP.setAttribute('role', 'tooltip'); document.body.append(TIP);
const showTip = (h, x, y) => { TIP.innerHTML = h; TIP.style.display = 'block'; const w = TIP.offsetWidth, hh = TIP.offsetHeight; TIP.style.left = Math.max(8, Math.min(innerWidth - w - 8, x + 14)) + scrollX + 'px'; TIP.style.top = (y + hh + 24 > innerHeight ? y - hh - 12 : y + 16) + scrollY + 'px'; };
const hideTip = () => { TIP.style.display = 'none'; };
addEventListener('scroll', hideTip, { passive: true });

// 본판 THESIS·주요 자리의 작은 사본 -------------------------------------------
const PARTS = [['m', '최근 언급', '--s1'], ['q', '사용자 질문', '--s2'], ['p', '가격 영향', '--s3'], ['o', '미결·임박', '--s4']];
function bar(sc, max = MAX, w) {
  const v = PARTS.map(([k]) => (sc?.[k] || 0) * (w ? w[k] : 1)), s = v.reduce((a, b) => a + b, 0);
  return `<div class="barrow"><div class="bar" role="img" aria-label="점수 ${s.toFixed(1)}: ${PARTS.map(([, n], i) => `${n} ${v[i].toFixed(1)}`).join(', ')}">${PARTS.map(([k], i) => `<i class="${k}" style="width:${Math.max(0, v[i] / max * 100).toFixed(1)}%"></i>`).join('')}</div><span class="sc num">${s.toFixed(1)}</span></div>`;
}
const LEG = `<div class="legend" style="margin-bottom:10px">${PARTS.map(([, n, c]) => `<span style="--c:var(${c})">${n}</span>`).join('')}</div>`;
// o: fid(data-fid 붙임) · tail(x)(문장 뒤) · under(x)(줄 아래) · against(false면 숨김) · open(반대 근거 펼침)
function thesisMini(o = {}) {
  const at = f => o.fid ? ` data-fid="${f}"` : '';
  const tl = x => o.tail ? ' ' + o.tail(x) : '';
  const un = x => o.under ? `<div class="cx">${o.under(x)}</div>` : '';
  const idea = { fid: 'thesis.idea', k: 'idea', t: TH.idea };
  return `<div class="panel tmini">
    <div class="slotlabel">THESIS 계기판 · 사용자 판단 틀</div>
    <p class="view"${at(idea.fid)} style="margin:0 0 10px">${esc(TH.idea)}${tl(idea)}</p>
    <ul class="cond">${CONDS.map(c => `<li${at(c.fid)}>${stc(c.s)}<span>${esc(c.t)}${tl(c)}</span>${c.n ? `<span class="n">${esc(c.n)}</span>` : ''}${un(c)}</li>`).join('')}</ul>
    ${o.against === false ? '' : `<details class="drawer" style="margin-top:10px"${o.open ? ' open' : ''}><summary>반대 근거 ${AG.length}개</summary><ul class="against">${AG.map(a => `<li${at(a.fid)}>${esc(a.t)}${tl(a)}</li>`).join('')}</ul></details>`}
  </div>`;
}
// o: fid · tail(제목 뒤) · head(머리줄 끝) · foot(카드 끝) · delta(id,n)
function cardMini(id, n, o = {}) {
  const m = D.iss[id] || { label: id, kind: '' }, cur = CUR[id], st = D.snap.status[id] || '', fid = 'issue.' + id, x = { fid, id };
  return `<article class="card cmini"${o.fid ? ` data-fid="${fid}"` : ''}>
    <div class="c1"><span class="rank">${n + 1}</span><h3>${esc(m.label)} <span class="kind">${esc(m.kind)}</span>${o.tail ? ' ' + o.tail(x) : ''}</h3>${o.delta ? o.delta(id, n) : ''}<span class="chip ${esc(st)}">${esc(st)}</span>${o.head ? o.head(x) : ''}</div>
    ${bar(SC[id])}
    ${cur ? `<p class="view">${g(cur.g)}${esc(cur.view)}</p>` : '<p class="view mute">사람 손 문장 없음(관찰 사안)</p>'}
    ${o.foot ? o.foot(x) : ''}
  </article>`;
}
const cardsMini = (ids, o) => LEG + `<div class="cards">${ids.map((id, n) => cardMini(id, n, o)).join('')}</div>`;
const H2MAJ = `<h2 class="h2">주요 자리 · ${MAJ.length}자리</h2>`;

// 실제 피드백(2026-11-17) — 17·18번에서 같이 쓴다
const FEED = [
  { t: '사각지대 칸 폐기', st: '반영됨', sha: '7401504', at: '11/17 18:32', trail: ['받음', '반영됨 · 7401504'], note: '사각지대 칸과 계산을 지우고 그 자리(맨 끝)에 MTF 50선 칸' },
  { t: 'KOL 수집 결과 더 다루기', st: '반영됨', sha: '7401504', at: '11/17 18:32', trail: ['받음', '반영됨 · 7401504'], note: 'KOL 수집 결과 칸: 글 532개·261명, 우리말 요지 + 원문 링크' },
  { t: '"화면" 칸 시안 5개', st: '반영됨', sha: 'faa9c19', at: '11/17 18:08', trail: ['받음', '반영됨 · faa9c19'], note: 'claude/lab/ 시안 1~5' },
  { t: '시안 5개 전부 채택', st: '반영 예정', at: '11/17', trail: ['받음', '반영 예정'], note: '"화면" 칸을 시안 다섯 방식으로 바꾸기' },
  { t: 'MTF 50선 = 통과 종목만', st: '반영됨', sha: '4cf5c30', at: '11/17 18:43', trail: ['받음', 'Claude가 처음엔 521개 전체 표로 잘못 이해', '사용자 정정 → 반영 예정', '반영됨 · 4cf5c30'], note: '전체 표 대신 모든 판정 TF에서 SMA50 위인 통과 종목만' },
  { t: '피드백 아이디어 19개 시안', st: '진행 중', at: '11/17', trail: ['받음', '진행 중'], note: '이 페이지(lab/fb.html)' },
];

// 시안 ------------------------------------------------------------------
const GH_URL = (fid, k, m) => `${REPO}/issues/new?` + new URLSearchParams({ title: `[피드백] ${fid} ${k}: ${short(m || TXT[fid], 40)}`, body: `항목: ${fid}\n원문: ${TXT[fid]}\n종류: ${k}\n\n의견:\n${m || '(메모 없음)'}\n\n— 시장 기억장치 Claude 판에서 (${TODAY})`, labels: 'feedback' });
const GRP = { A: 'A. 어디에 남기나', B: 'B. THESIS를 바꾸는 장치', C: 'C. 주요 자리 전용', D: 'D. 반영됐는지 보이게 하기' };
let RES = null;
const IDEAS = [
{ n: 1, g: 'A', t: '복사 → Discord', tag: '작동 · 복사', how: '복사만 합니다',
  one: '💬 → 동의/반대/수정 + 메모 → [FB 아이디] 한 줄을 복사해 채널에 붙임.',
  d: '조건·카드 옆 💬를 눌러 동의/반대/수정과 메모를 고르면 "[FB 아이디 @날짜] …" 한 줄이 복사되고, 그 줄을 채널에 붙여 넣으면 Claude가 아이디로 원본 문장을 찾아 고친 뒤 채널에 답합니다.',
  run(b) {
    const btn = x => `<button type="button" class="fbb" data-fb="${x.fid}" aria-label="${x.fid} 의견 남기기" title="${x.fid}">💬</button>`;
    const made = [];
    b.innerHTML = thesisMini({ tail: btn, open: true }) + H2MAJ + cardsMini(MAJ, { head: btn }) + `<div class="panel xt"><h3 class="h3">이번에 만든 줄</h3><div id="o1"><p class="empty">아직 없습니다. 💬를 눌러 보세요.</p></div></div>`;
    b.onclick = e => {
      const x = e.target.closest('[data-fb]'); if (!x) return;
      const fid = x.dataset.fb;
      ask({ fid, ok: '줄 만들고 복사' }, ({ k, m, res }) => {
        const line = fbLine(fid, k, m); copy(line, res); made.unshift(line);
        $('#o1', b).innerHTML = `<ol class="lines">${made.map(l => `<li><code>${esc(l)}</code></li>`).join('')}</ol>`;
        return false;
      });
    };
  } },
{ n: 2, g: 'A', t: '모아 보내기 모드', tag: '작동 · 모아서 복사', save: 'local',
  one: '피드백 모드를 켜고 여기저기 누르며 메모를 모은 뒤 한 번에 복사.',
  d: '"피드백 모드"를 켜고 문장·카드를 누를 때마다 메모가 옆 트레이에 쌓이고 "한 번에 복사"로 Discord 메시지 하나가 되며, Claude는 그 메시지의 아이디별 메모를 차례로 반영하고 건마다 반영 여부를 답합니다.',
  run(b) {
    let on = false, notes = store.get('tray', []);
    if (!Array.isArray(notes)) notes = [];
    b.innerHTML = `<div class="row xb"><button type="button" class="btn" id="t2" aria-pressed="false">✎ 피드백 모드 켜기</button><span class="mute sm" id="s2" role="status">꺼짐: 평소처럼 읽기만 합니다.</span></div>
      <div class="side"><div id="z2" class="fbz">${thesisMini({ fid: 1, open: true })}${H2MAJ}${cardsMini(MAJ, { fid: 1 })}</div>
      <aside class="panel" aria-labelledby="h2t"><h3 class="h3" id="h2t">모은 메모 <b id="n2">0</b>건</h3><ol class="notes" id="l2"></ol>
      <div class="row"><button type="button" class="btn pri" id="c2">한 번에 복사</button><button type="button" class="btn" id="x2">모두 지우기</button></div><div id="o2"></div>
      <p class="src">${saveNote()} (mm-fb-tray)</p></aside></div>`;
    const text = () => [`[FB 모음 @${TODAY} · ${notes.length}건]`, ...notes.map((x, i) => `${i + 1}) ${x.fid} ${x.k}: ${x.m || '(메모 없음)'} ‹${short(TXT[x.fid])}›`)].join('\n');
    const list = () => {
      $('#n2', b).textContent = notes.length;
      $('#l2', b).innerHTML = notes.length ? notes.map((x, i) => `<li><code>${esc(x.fid)}</code> <b>${esc(x.k)}</b> ${esc(x.m || '(메모 없음)')} <button type="button" class="lnk sm" data-del="${i}" aria-label="${i + 1}번 메모 지우기">지우기</button></li>`).join('') : '<li class="mute" style="list-style:none;margin-left:-20px">아직 없습니다. 모드를 켜고 문장을 눌러 보세요.</li>';
      $$('#z2 [data-fid]', b).forEach(el => el.classList.toggle('has', notes.some(x => x.fid === el.dataset.fid)));
    };
    const setOn = v => {
      on = v; const t = $('#t2', b); t.setAttribute('aria-pressed', v); t.textContent = v ? '✎ 피드백 모드 끄기' : '✎ 피드백 모드 켜기';
      $('#z2', b).classList.toggle('on', v);
      $$('#z2 [data-fid]', b).forEach(el => { if (v) { el.tabIndex = 0; el.setAttribute('role', 'button'); el.setAttribute('aria-label', `${el.dataset.fid} 메모 남기기: ${short(TXT[el.dataset.fid], 40)}`); } else { el.removeAttribute('tabindex'); el.removeAttribute('role'); el.removeAttribute('aria-label'); } });
      $('#s2', b).textContent = v ? '켜짐: 점선으로 둘러싼 곳을 누르거나, Tab으로 가서 Enter.' : '꺼짐: 평소처럼 읽기만 합니다.';
    };
    const open = el => { const fid = el.dataset.fid; ask({ fid, title: '메모 남기기', ok: '트레이에 담기' }, ({ k, m }) => { notes.push({ fid, k, m }); store.set('tray', notes); list(); }); };
    b.onclick = e => {
      if (e.target.closest('#t2')) return setOn(!on);
      const d = e.target.closest('[data-del]'); if (d) { notes.splice(+d.dataset.del, 1); store.set('tray', notes); return list(); }
      if (e.target.closest('#c2')) return notes.length ? copy(text(), $('#o2', b)) : ($('#o2', b).innerHTML = '<p class="okmsg" role="status">담긴 메모가 없습니다.</p>');
      if (e.target.closest('#x2')) { notes = []; store.del('tray'); $('#o2', b).innerHTML = ''; return list(); }
      if (!on || e.target.closest('summary')) return;
      const el = e.target.closest('#z2 [data-fid]'); if (el) open(el);
    };
    b.onkeydown = e => { if (!on || (e.key !== 'Enter' && e.key !== ' ')) return; const el = e.target; if (el.matches?.('#z2 [data-fid]')) { e.preventDefault(); open(el); } };
    list();
  } },
{ n: 3, g: 'A', t: 'GitHub 이슈로', tag: '작동 · GitHub 창 열기', how: 'GitHub 새 이슈 창만 엽니다',
  one: '아이디·원문·의견이 채워진 GitHub 새 이슈 창을 엽니다. 제출은 직접.',
  d: '항목마다 "이슈로 ↗"를 누르고 의견을 쓰면 아이디·원문·의견이 채워진 GitHub 새 이슈 창이 새 탭에 열리고, 사용자가 제출하면 Claude가 feedback 라벨 이슈를 읽어 고친 뒤 커밋으로 그 이슈를 닫습니다.',
  run(b) {
    const cnt = fid => { const h = hash(fid) % 7; return h < 3 ? 0 : h - 2; };
    const total = [...CONDS.map(c => c.fid), ...MAJ.map(i => 'issue.' + i)].reduce((s, f) => s + cnt(f), 0);
    const btn = x => `<button type="button" class="lnk sm" data-gh="${x.fid}" aria-label="${x.fid} GitHub 이슈로 남기기">이슈로 ↗</button>${cnt(x.fid) ? ` <span class="bdg">열린 ${cnt(x.fid)} · 예시</span>` : ''}`;
    b.innerHTML = `<div class="row xb"><span class="bdg big">열린 피드백 ${total}건 · 예시</span><span class="mute sm">숫자는 예시입니다. 채택하면 빌드 때 feedback 라벨이 붙은 열린 이슈를 세어 넣습니다.</span></div>`
      + thesisMini({ tail: btn, against: false }) + H2MAJ + cardsMini(MAJ, { foot: x => `<div class="row">${btn(x)}</div>` });
    b.onclick = e => {
      const x = e.target.closest('[data-gh]'); if (!x) return; const fid = x.dataset.gh;
      ask({ fid, title: 'GitHub 이슈로 남기기', ok: 'GitHub에서 열기 ↗', kinds: ['동의', '반대', '수정', '질문'], extra: '<div class="ghp"></div>',
        note: '새 탭에 GitHub "새 이슈" 화면만 엽니다. 제출은 직접 누르셔야 하고 GitHub 로그인이 필요합니다. 저장소에 feedback 라벨이 없으면 라벨만 빠집니다.',
        init: f => { const up = () => { const t = GH_URL(fid, f.elements.k.value, f.elements.m.value.trim()); $('.ghp', f).innerHTML = `<p class="src" style="margin:0">제목: ${esc(new URL(t).searchParams.get('title'))}</p>`; }; f.addEventListener('input', up); f.addEventListener('change', up); up(); } },
        ({ k, m, res }) => { const u = GH_URL(fid, k, m); window.open(u, '_blank', 'noopener'); res.innerHTML = `<p class="okmsg" role="status">새 탭을 열었습니다. 팝업이 막혔다면 ${ext(u, '이 링크')}</p>`; return false; });
    };
  } },
{ n: 4, g: 'A', t: '원본 파일 직접 고치기', tag: '작동 · 링크 + 미리보기', how: 'GitHub 편집 화면 링크만',
  one: 'GitHub 편집 화면으로 바로 가서 curated.json·pins.json을 직접 고침.',
  d: '"이 조건 고치기"를 누르면 그 조건이 원본 파일 어디에 어떤 모양으로 있는지 보여 주고 GitHub 편집 화면으로 보내 주며, 사용자가 커밋하면 Claude는 다음 갱신 때 그 원본으로 다시 빌드하고 커밋 기록으로 무엇이 바뀌었는지 확인합니다.',
  run(b) {
    const ED = f => `${REPO}/edit/main/claude/tools/${f}`;
    const tog = (fid, t) => `<button type="button" class="lnk sm" data-sn="${fid}" aria-expanded="false" aria-controls="sn-${fid}">${t} ▸</button>`;
    const box = (fid, h) => `<div id="sn-${fid}" hidden>${h}<div class="cpo"></div></div>`;
    const how = '<p class="src">편집 화면에서 ⌘F(Ctrl+F)로 "찾을 글"을 찾아 고친 뒤 Commit changes. GitHub 로그인이 필요합니다. 미리보기는 빌드 때 복사해 둔 값이라 원본과 조금 다를 수 있습니다.</p>';
    const condSnip = c => { const i = +c.k.slice(1) - 1; return `<p class="src">위치: tools/curated.json → "thesis" → "cond" → ${i + 1}번째</p><pre class="out">${esc(JSON.stringify(TH.cond[i]))}</pre><div class="row xt"><a class="btn pri" href="${ED('curated.json')}" target="_blank" rel="noopener noreferrer">curated.json 고치기 ↗</a><button type="button" class="btn" data-cp="${esc(TH.cond[i].t)}">찾을 글 복사</button></div>${how}`; };
    const cardSnip = id => `<p class="src">문장: tools/curated.json → "issues" → "${esc(id)}"</p><pre class="out">${esc(CUR[id] ? JSON.stringify(CUR[id], null, 1) : '(아직 없음 · 새로 넣으면 됩니다)')}</pre>
      <p class="src xt">자리: tools/pins.json (11/17 빌드 기준 pin·down 모두 비어 있음). 고정하려면 pin에, 내리려면 down에 넣습니다.</p><pre class="out">${esc(`{\n  "_note": "…",\n  "pin": ["${id}"],\n  "down": []\n}`)}</pre>
      <div class="row xt"><a class="btn pri" href="${ED('curated.json')}" target="_blank" rel="noopener noreferrer">문장 고치기 ↗</a><a class="btn" href="${ED('pins.json')}" target="_blank" rel="noopener noreferrer">자리 고치기(pins.json) ↗</a><button type="button" class="btn" data-cp='"${esc(id)}"'>찾을 글 복사</button></div>${how}`;
    b.innerHTML = thesisMini({ tail: c => c.k && c.k[0] === 'c' ? tog(c.fid, '이 조건 고치기') : '', under: c => box(c.fid, condSnip(c)), against: false })
      + H2MAJ + cardsMini(MAJ, { foot: x => `<div>${tog(x.fid, '이 카드 고치기')}</div>${box(x.fid, cardSnip(x.id))}` });
    b.onclick = e => {
      const t = e.target.closest('[data-sn]');
      if (t) { const p = document.getElementById('sn-' + t.dataset.sn), o = p.hidden; p.hidden = !o; t.setAttribute('aria-expanded', o); t.textContent = t.textContent.replace(/[▸▾]$/, o ? '▾' : '▸'); return; }
      const c = e.target.closest('[data-cp]'); if (c) copy(c.dataset.cp, $('.cpo', c.closest('[id^="sn-"]')), true);
    };
  } },
{ n: 5, g: 'A', t: 'claude.ai 피드백함', tag: '모형', how: '화면 모양만',
  one: '별도 Claude 페이지(피드백함)에 의견과 댓글을 쌓는 모양.',
  d: '항목 옆 "피드백함 ↗"을 누르면 그 아이디가 실린 별도 Claude 페이지가 열리고 거기에 의견과 댓글을 쌓으면, Claude가 새 댓글 알림을 받아 원본을 고친 뒤 같은 자리에 답글을 답니다.',
  run(b) {
    const TR = { 'thesis.c1': [{ w: '사용자', t: '주봉 마감 시각이 KST인지 헷갈려요.', ex: 1 }, { w: 'Claude', t: '바이낸스 주봉은 월요일 09시 KST에 닫힙니다. 문구에 KST를 붙이겠습니다.', ex: 1 }], 'thesis.c5': [{ w: '사용자', t: '허용 이탈폭 숫자는 언제 확정하나요?', ex: 1 }], 'issue.memes': [{ w: '사용자', t: '밈은 관찰 자리로 내려도 될 것 같아요.', ex: 1 }] };
    let cur = 'thesis.c1';
    const btn = x => `<button type="button" class="lnk sm" data-box="${x.fid}" aria-label="${x.fid} 피드백함 열기">피드백함 ↗</button>`;
    const win = () => { const th = TR[cur] || []; return `<div class="mockwin"><div class="mwbar"><span aria-hidden="true">● ● ●</span><span class="u">claude.ai/…/피드백함?fid=${esc(cur)}</span><span class="pill mock">⚠ 모형</span></div>
      <div class="mwbody"><div><div class="slotlabel">피드백함 · ${esc(cur)}</div><b>${esc(short(TXT[cur], 70))}</b></div>
      <ul class="thread">${th.length ? th.map(x => `<li class="${x.w === 'Claude' ? 'cl' : ''}"><div class="w">${esc(x.w)}${x.ex ? ' · 예시' : ' · 방금(저장 안 됨)'}</div>${esc(x.t)}</li>`).join('') : '<li class="mute">아직 의견이 없습니다.</li>'}</ul>
      <form class="addf" data-f5><label class="sr" for="t5">의견 쓰기</label><input type="text" id="t5" placeholder="의견 쓰기"><button class="btn pri">남기기</button></form>
      <p class="src" style="margin:0">모형 · 실제로 저장되지 않음. 의견 있는 항목: ${Object.keys(TR).map(f => `<button type="button" class="lnk sm" data-box="${f}">${f} ${TR[f].length}</button>`).join(' · ')}</p></div></div>`; };
    b.innerHTML = `<div class="side"><div>${thesisMini({ tail: btn, against: false })}${H2MAJ}${cardsMini(MAJ, { foot: x => `<div>${btn(x)}</div>` })}</div><aside id="w5" aria-live="polite" aria-label="피드백함 모형">${win()}</aside></div>`;
    b.onclick = e => { const x = e.target.closest('[data-box]'); if (x) { cur = x.dataset.box; $('#w5', b).innerHTML = win(); $('#t5', b).focus(); } };
    b.onsubmit = e => { e.preventDefault(); const v = $('#t5', b).value.trim(); if (!v) return; (TR[cur] ||= []).push({ w: '나', t: v }); $('#w5', b).innerHTML = win(); $('#t5', b).focus(); };
  } },
{ n: 6, g: 'A', t: 'Notion 피드백 DB', tag: '모형', how: '이 화면 표에만 줄이 늘어납니다',
  one: 'Notion 데이터베이스 표에 한 줄씩 쌓고 상태로 관리하는 모양.',
  d: '항목을 고르고 의견을 쓴 뒤 "Notion에 보내기"를 누르면 Notion 피드백 DB에 한 줄(항목 ID·종류·내용·상태·날짜)이 생기고, Claude가 그 DB를 읽어 고친 뒤 상태를 "반영됨"으로 바꿉니다.',
  run(b) {
    const SS = ['받음', '반영 예정', '반영됨', '보류'], SI = { 받음: '○', '반영 예정': '◐', 반영됨: '●', 보류: '⏸' };
    const rows = [{ fid: 'thesis.c5', k: '수정', t: '허용 이탈폭 숫자를 확정하자', st: '받음', d: '11/17', ex: 1 }, { fid: 'issue.memes', k: '반대', t: '밈은 관찰 자리로', st: '보류', d: '11/16', ex: 1 }, { fid: 'thesis.c4', k: '질문', t: 'USDT.D 값은 어디서 보나', st: '반영됨', d: '11/16', ex: 1 }];
    let flt = '';
    const opts = `<optgroup label="THESIS">${FIDS.filter(f => f.startsWith('thesis')).map(f => `<option value="${f}">${f} · ${esc(short(TXT[f], 22))}</option>`).join('')}</optgroup><optgroup label="사안">${ALL.map(id => `<option value="issue.${id}">issue.${id} · ${esc(LBL(id))}</option>`).join('')}</optgroup>`;
    const table = () => `<div class="row" role="group" aria-label="상태로 거르기">${['', ...SS].map(s => `<button type="button" class="btn sm" data-flt="${s}" aria-pressed="${flt === s}">${s ? SI[s] + ' ' + s : '전체'} ${rows.filter(r => !s || r.st === s).length}</button>`).join('')}</div>
      <div class="scrollx xt"><table class="tblw"><caption class="sr">피드백 DB 표</caption><thead><tr><th>항목 ID</th><th>종류</th><th>내용</th><th>상태</th><th>날짜</th></tr></thead><tbody>${rows.map((r, i) => (!flt || r.st === flt) ? `<tr><td><code>${esc(r.fid)}</code></td><td>${esc(r.k)}</td><td>${esc(r.t)}${r.ex ? ' <span class="bdg">예시</span>' : ''}</td><td><label class="sr" for="s6-${i}">상태</label><select id="s6-${i}" data-row="${i}">${SS.map(s => `<option value="${s}"${s === r.st ? ' selected' : ''}>${SI[s]} ${s}</option>`).join('')}</select></td><td>${esc(r.d)}</td></tr>` : '').join('')}</tbody></table></div>`;
    b.innerHTML = `<div class="panel"><div class="row xb"><b>📋 피드백 DB</b><span class="mute sm">표 보기</span><span class="pill mock">⚠ 모형 · Notion에 보내지 않음</span></div>
      <form class="fgrid" style="max-width:none" data-f6><div class="row" style="align-items:flex-end"><label class="fl" style="flex:1 1 240px"><span>항목</span><select name="fid">${opts}</select></label><label class="fl"><span>종류</span><select name="k"><option>동의</option><option>반대</option><option selected>수정</option><option>질문</option></select></label></div>
      <label class="fl"><span>내용</span><input type="text" name="t" placeholder="한 줄"></label><div class="row"><button class="btn pri">Notion에 보내기</button><span class="mute sm" role="status" id="m6"></span></div></form>
      <div id="t6" class="xt">${table()}</div></div>`;
    b.onsubmit = e => { e.preventDefault(); const f = e.target, t = f.elements.t.value.trim(); if (!t) { $('#m6', b).textContent = '내용을 써 주세요.'; return; } rows.unshift({ fid: f.elements.fid.value, k: f.elements.k.value, t, st: '받음', d: mdS(TODAY) }); f.elements.t.value = ''; $('#m6', b).textContent = '이 화면 표에만 한 줄 넣었습니다(모형).'; $('#t6', b).innerHTML = table(); };
    b.onclick = e => { const x = e.target.closest('[data-flt]'); if (x) { flt = x.dataset.flt; $('#t6', b).innerHTML = table(); $(`[data-flt="${flt}"]`, b).focus(); } };
    b.onchange = e => { const x = e.target.closest('[data-row]'); if (x) { rows[+x.dataset.row].st = x.value; $('#t6', b).innerHTML = table(); $(`#s6-${x.dataset.row}`, b)?.focus(); } };
  } },
{ n: 7, g: 'A', t: 'THESIS 원문을 Claude 문서로', tag: '모형', how: '댓글·제안은 이 화면에만',
  one: 'THESIS 원문을 문서로 두고 문장에 댓글·고침 제안(지움/넣음)을 다는 모양.',
  d: 'THESIS 원문을 Claude 문서로 옮겨 두고 사용자가 문장에 댓글을 달거나 고침 제안(지움·넣음)을 수락·거절하면, Claude가 댓글에 답하고 수락된 제안을 curated.json에 옮겨 다음 빌드에 반영합니다.',
  run(b) {
    const dl = T.daily?.at(-1), c5 = condBy(/이탈폭/);
    const SUG = [{ at: condBy(/4년선/)?.k, from: '1~2주', to: '14일(일봉 14개)', who: 'Claude · 예시' }];
    if (c5 && dl) SUG.push({ at: c5.k, from: '약 63.5k', to: `약 ${n0(dl.line * 0.964)}(일봉 4년선 ${n0(dl.line)} 기준)`, who: 'Claude · 예시(숫자는 계산)' });
    const COM = [{ at: condBy(/208주/)?.k, q: '11/16 09시', t: '마감 시각에 KST를 붙이면 덜 헷갈립니다.', who: '사용자 · 예시' }, { at: 'idea', q: '레버리지 없이', t: '"현물만"을 조건 목록에도 넣을까요?', who: 'Claude · 예시' }, { at: 'a2', q: 'NVT 333', t: '판정이 2027-01이라 따로 표시하면 좋겠습니다.', who: '사용자 · 예시' }];
    SUG.forEach(s => s.st = '');
    const deco = (key, text) => {
      const rg = [];
      SUG.forEach((s, i) => { if (s.at === key) { const p = text.indexOf(s.from); if (p >= 0) rg.push({ p, e: p + s.from.length, s, i }); } });
      COM.forEach((c, i) => { if (c.at === key && c.q) { const p = text.indexOf(c.q); if (p >= 0 && !rg.some(r => p < r.e && p + c.q.length > r.p)) rg.push({ p, e: p + c.q.length, c, i }); } });
      rg.sort((a, b) => a.p - b.p);
      let h = '', at = 0;
      for (const r of rg) {
        h += esc(text.slice(at, r.p)); const mid = text.slice(r.p, r.e);
        h += r.s ? (r.s.st === 'ok' ? esc(r.s.to) : r.s.st === 'no' ? esc(mid) : `<del>${esc(mid)}</del><ins>${esc(r.s.to)}</ins><sup>제안${r.i + 1}</sup>`) : `<mark class="${r.c.done ? 'res' : ''}">${esc(mid)}</mark><sup>${r.i + 1}</sup>`;
        at = r.e;
      }
      h += esc(text.slice(at));
      COM.forEach((c, i) => { if (c.at === key && !c.q) h += `<sup>💬${i + 1}</sup>`; });
      return h + ` <button type="button" class="lnk addc" data-add="${key}" aria-label="${key} 문장에 댓글 달기">＋댓글</button>`;
    };
    const render = () => { b.innerHTML = `<div class="side"><article class="doc" aria-label="THESIS 문서 모형"><h3>THESIS</h3><p class="src">11/15판 · 사용자 판단 틀 · Claude 문서 모형</p><p>${deco('idea', TH.idea)}</p>
      <h4>조건</h4><ol>${CONDS.map(c => `<li>${deco(c.k, c.t)}${c.n ? ` <span class="mute sm">(${esc(c.n)})</span>` : ''}</li>`).join('')}</ol>
      <h4>반대 근거</h4><ul>${AG.map(a => `<li>${deco(a.k, a.t)}</li>`).join('')}</ul></article>
      <aside class="panel"><h3 class="h3">고침 제안 ${SUG.length}</h3><ul class="cmts">${SUG.map((s, i) => `<li><div class="w">제안${i + 1} · ${esc(s.who)} · ${esc(s.at)}</div><del>${esc(s.from)}</del> → <ins>${esc(s.to)}</ins><div class="row xt"><button type="button" class="btn sm" data-sg="${i}" data-v="ok" aria-pressed="${s.st === 'ok'}">✓ 수락</button><button type="button" class="btn sm" data-sg="${i}" data-v="no" aria-pressed="${s.st === 'no'}">✕ 거절</button></div></li>`).join('')}</ul>
      <h3 class="h3 xt">댓글 ${COM.length}</h3><ul class="cmts">${COM.map((c, i) => `<li class="${c.done ? 'done' : ''}"><div class="w">${i + 1} · ${esc(c.who)} · ${esc(c.at)}${c.q ? ` · "${esc(c.q)}"` : ''}</div>${esc(c.t)}<div class="row xt"><button type="button" class="btn sm" data-dn="${i}" aria-pressed="${!!c.done}">${c.done ? '↺ 다시 열기' : '✓ 해결'}</button></div></li>`).join('')}</ul>
      <p class="src">모형 · 실제로 저장되지 않음. 수락한 제안은 위 문서에 바로 들어갑니다.</p></aside></div>`; };
    b.onclick = e => {
      const s = e.target.closest('[data-sg]'); if (s) { const x = SUG[+s.dataset.sg]; x.st = x.st === s.dataset.v ? '' : s.dataset.v; render(); $(`[data-sg="${s.dataset.sg}"][data-v="${s.dataset.v}"]`, b)?.focus(); return; }
      const d = e.target.closest('[data-dn]'); if (d) { COM[+d.dataset.dn].done = !COM[+d.dataset.dn].done; render(); $(`[data-dn="${d.dataset.dn}"]`, b)?.focus(); return; }
      const a = e.target.closest('[data-add]'); if (a) { const key = a.dataset.add; ask({ fid: 'thesis.' + key, title: '댓글 달기', kinds: ['댓글'], memo: '댓글', ok: '달기' }, ({ m }) => { if (!m) return false; COM.push({ at: key, q: null, t: m, who: '나 · 방금(저장 안 됨)' }); render(); }); }
    };
    render();
  } },
{ n: 8, g: 'B', t: '조건 시뮬레이터', tag: '실제 계산', calc: 1, how: '설정은 이 화면에만',
  one: '허용 이탈폭·기준선을 바꾸면 "지금 충족?"과 2021년 이후 신호를 다시 계산.',
  d: '허용 이탈폭·기준선·평가 기준을 바꾸면 "지금 충족인가"와 2021년 8월 이후 띠를 깬 때(신호)가 바로 다시 계산되고, "이 설정으로 제안"으로 만든 줄을 채널에 붙이면 Claude가 THESIS 조건 숫자를 그 값으로 바꿀지 근거와 함께 답합니다.',
  run(b) {
    const c5 = condBy(/이탈폭/), m0 = c5 && c5.t.match(/-(\d+(?:\.\d+)?)%/);
    const S = { a: m0 ? +m0[1] : 3.6, base: 'w208', ev: 'close', k: 1 };
    const isLive = r => r.length > 0 && Math.abs(r.at(-1)[1] - T.btc_live) < 0.01;
    const series = () => { let r = H[S.base] || []; if (S.ev === 'close' && isLive(r)) r = r.slice(0, -1); return r.map(([d, c, l]) => ({ d, c, l, p: c / l - 1 })); };
    const nowRow = () => {
      if (S.base === 'w208' && S.ev === 'close' && T.weekly?.length) { const w = T.weekly.at(-1); return { d: w.bar, c: w.close, l: w.line, p: w.pct / 100 }; }
      if (S.base === 'm48' && S.ev === 'live' && T.m48_live && isLive(H.m48)) return { d: H.m48.at(-1)[0], c: T.btc_live, l: T.m48_live, p: T.btc_live / T.m48_live - 1 };
      return series().at(-1);
    };
    const runs = rows => { const out = []; let c = null; rows.forEach((r, i) => { if (r.p < -S.a / 100) { if (!c) c = { i0: i, n: 0, min: 0 }; c.n++; c.min = Math.min(c.min, r.p); } else if (c) { c.back = i; out.push(c); c = null; } }); if (c) out.push(c); return out.filter(x => x.n >= S.k).map(x => ({ ...x, sig: x.i0 + S.k - 1 })); };
    const nm = () => S.base === 'w208' ? { line: '208주선', bar: '주봉', u: '주' } : { line: '48개월선', bar: '월봉', u: '개월' };
    const lb = (d, live) => S.base === 'w208' ? (live ? `진행 중 주봉(${mdS(d)} 시작)` : `${addDays(d, 7)} 마감 주봉`) : `${d.slice(0, 7)} 월봉${live ? '(진행 중)' : ''}`;
    b.innerHTML = `<div class="panel"><div class="ctl8">
      <label class="fl"><span>허용 이탈폭 <b id="av8"></b></span><input type="range" id="a8" min="0" max="15" step="0.1" value="${S.a}"><span class="src">0%(선 자체) ~ -15% · 지금 THESIS 값 -${S.a}%</span></label>
      <fieldset class="seg"><legend>기준선</legend><label><input type="radio" name="b8" value="w208" checked><span>208주선 · 주봉</span></label><label><input type="radio" name="b8" value="m48"><span>48개월선 · 월봉</span></label></fieldset>
      <fieldset class="seg"><legend>평가 기준</legend><label><input type="radio" name="e8" value="close" checked><span>마감된 봉 종가</span></label><label><input type="radio" name="e8" value="live"><span>진행 중 봉 포함</span></label></fieldset>
      <fieldset class="seg"><legend>신호 = 띠 밖 마감이</legend>${[1, 2, 3].map(k => `<label><input type="radio" name="k8" value="${k}"${k === 1 ? ' checked' : ''}><span>${k}봉 연속</span></label>`).join('')}</fieldset></div>
      <div class="verdict" id="v8" aria-live="polite"></div><div id="c8"></div>
      <div class="lg8"><span><i style="background:var(--ink);height:3px"></i>종가 ÷ 기준선 − 1</span><span><i style="background:color-mix(in srgb,var(--accent) 30%,transparent)"></i>허용 띠(0 ~ −폭)</span><span><i style="border-top:2px dashed var(--critical);height:0"></i>띠 아래 끝</span><span>● 띠 밖 마감</span><span>▼번호 = 신호</span><span>○ 진행 중 봉</span></div>
      <p class="src">+50% 위는 위 끝에 붙여 그렸습니다. 원자료: ${esc(T.src)} · ${esc(T.asof)} KST. 11/15 THESIS의 허용 폭은 일봉 4년선 기준이고, 여기서는 같은 폭을 주봉 208주선·월봉 48개월선에 대 봅니다.</p></div>
      <div class="two xt"><div class="panel"><h3 class="h3">신호가 난 때</h3><div id="l8"></div></div><div class="panel"><h3 class="h3">이 설정으로 제안</h3><p class="mute sm" style="margin:0 0 8px">thesis.c5(허용 이탈폭)를 이 설정으로 바꾸자는 한 줄을 만듭니다.</p><button type="button" class="btn pri" id="p8">제안 줄 만들고 복사</button><div id="o8"></div></div></div>`;
    const chart = () => {
      const el = $('#c8', b), rows = series(), R = runs(rows), a = S.a / 100, N = nm(), lv = S.ev === 'live' && isLive(H[S.base]);
      const W = Math.max(300, el.clientWidth || 600), Hh = W < 560 ? 230 : 300, mL = 40, mR = 10, mT = 22, mB = 24;
      const lo = Math.min(-0.2, Math.floor((Math.min(...rows.map(r => r.p)) - 0.03) * 10) / 10), hi = 0.5;
      const X = i => mL + i / Math.max(1, rows.length - 1) * (W - mL - mR), Y = v => mT + (hi - Math.max(lo, Math.min(hi, v))) / (hi - lo) * (Hh - mT - mB);
      const s = [`<svg class="sim" viewBox="0 0 ${W} ${Hh}" width="${W}" height="${Hh}" role="img" aria-label="BTC ${N.bar} 종가의 ${N.line} 대비 거리, 허용 띠 -${S.a}%, 신호 ${R.length}번">`];
      for (let k = Math.ceil(lo * 10); k <= 5; k++) { const v = k / 10; s.push(`<line class="${k ? 'gr' : 'z'}" x1="${mL}" x2="${W - mR}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${mL - 5}" y="${Y(v) + 4}" text-anchor="end">${k * 10}%</text>`); }
      s.push(`<rect class="band" x="${mL}" width="${W - mL - mR}" y="${Y(0)}" height="${Math.max(0, Y(-a) - Y(0))}"/><line class="edge" x1="${mL}" x2="${W - mR}" y1="${Y(-a)}" y2="${Y(-a)}"/>`);
      rows.forEach((r, i) => { if (i && r.d.slice(0, 4) !== rows[i - 1].d.slice(0, 4)) s.push(`<line class="gr" stroke-dasharray="2 4" x1="${X(i)}" x2="${X(i)}" y1="${mT}" y2="${Hh - mB}"/><text class="ax" x="${X(i)}" y="${Hh - 7}" text-anchor="middle">${r.d.slice(0, 4)}</text>`); });
      s.push(`<path class="ln" d="${rows.map((r, i) => `${i ? 'L' : 'M'}${X(i).toFixed(1)},${Y(r.p).toFixed(1)}`).join('')}"/>`);
      rows.forEach((r, i) => { if (r.p < -a) s.push(`<circle class="br" cx="${X(i).toFixed(1)}" cy="${Y(r.p).toFixed(1)}" r="2.4"/>`); });
      let lx = -99; R.forEach((x, j) => { const cx = X(x.sig), cy = Y(rows[x.sig].p), lab = cx - lx > 13; if (lab) lx = cx; s.push(`<path class="sg" d="M${(cx - 5).toFixed(1)},${(cy - 14).toFixed(1)}L${(cx + 5).toFixed(1)},${(cy - 14).toFixed(1)}L${cx.toFixed(1)},${(cy - 5).toFixed(1)}Z"/>${lab ? `<text class="sgt" x="${cx.toFixed(1)}" y="${(cy - 17).toFixed(1)}" text-anchor="middle">${j + 1}</text>` : ''}`); });
      if (lv) { const i = rows.length - 1; s.push(`<circle class="live" cx="${X(i)}" cy="${Y(rows[i].p)}" r="4"/>`); }
      s.push(`<line class="xh" x1="0" x2="0" y1="${mT}" y2="${Hh - mB}" visibility="hidden"/><rect class="ov" x="${mL}" y="${mT}" width="${W - mL - mR}" height="${Hh - mT - mB}" fill="transparent"/></svg>`);
      el.innerHTML = s.join('');
      const svg = $('svg', el), ov = $('.ov', svg), xh = $('.xh', svg);
      ov.onpointermove = e => {
        const r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width, i = Math.max(0, Math.min(rows.length - 1, Math.round((x - mL) / (W - mL - mR) * (rows.length - 1)))), q = rows[i];
        xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible');
        showTip(`<b>${lb(q.d, lv && i === rows.length - 1)}</b><br>종가 ${n0(q.c)} · ${N.line} ${n0(q.l)}<br>${pp(q.p * 100)} · ${q.p < -a ? '띠 밖' : q.p < 0 ? '선 아래, 띠 안' : '선 위'}`, e.clientX, e.clientY);
      };
      ov.onpointerleave = () => { xh.setAttribute('visibility', 'hidden'); hideTip(); };
    };
    const draw = () => {
      const rows = series(), R = runs(rows), a = S.a / 100, r = nowRow(), ok = r.p >= -a, N = nm(), live = S.ev === 'live' && isLive(H[S.base]);
      $('#av8', b).textContent = S.a ? `-${S.a.toFixed(1)}%` : '0%(선 자체)';
      $('#a8', b).setAttribute('aria-valuetext', `-${S.a.toFixed(1)}%`);
      $('#v8', b).innerHTML = `<div><div class="src">지금 충족? · ${lb(r.d, live)}</div><div class="big ${ok ? 'ok' : 'no'}">${ok ? '✓ 충족 · 띠 안' : '✕ 불충족 · 띠 밖'}</div></div>
        <div class="stat"><b>${pp(r.p * 100)}</b><span>종가 ${n0(r.c)} ÷ ${N.line} ${n0(r.l)}</span></div>
        <div class="stat"><b>${n0(r.l * (1 - a))}</b><span>띠 아래 끝(이 밑 마감 = 이탈)</span></div>
        <div class="stat"><b>${R.length}번</b><span>${esc(rows[0]?.d.slice(0, 7) || '')} 이후 신호 · 띠 밖 ${rows.filter(x => x.p < -a).length}${N.u}</span></div>`;
      $('#l8', b).innerHTML = R.length ? `<ol class="sigl">${R.map(x => `<li><b>${lb(rows[x.sig].d)}</b> · 띠 밖 ${x.n}${N.u} 연속 · 가장 깊게 ${pp(x.min * 100, 1)} · ${x.back != null ? `복귀 ${lb(rows[x.back].d)}` : '<b>아직 띠 밖</b>'}</li>`).join('')}</ol>` : '<p class="empty">이 설정에서는 신호가 없습니다.</p>';
      chart();
    };
    const prop = () => { const rows = series(), R = runs(rows), r = nowRow(), N = nm(); return `[FB thesis.c5 @${TODAY}] 수정: 허용 이탈폭 -${S.a.toFixed(1)}% · ${N.line}(${N.bar}) · ${S.ev === 'close' ? '마감 종가' : '진행 중 봉 포함'} · 띠 밖 ${S.k}봉 연속이면 신호 → 지금 ${pp(r.p * 100)}(${r.p >= -S.a / 100 ? '충족' : '불충족'}) · ${rows[0].d.slice(0, 7)} 이후 신호 ${R.length}번${R.length ? '(' + R.map(x => lb(rows[x.sig].d)).join(', ') + ')' : ''} ‹${short(TXT['thesis.c5'])}›`; };
    b.oninput = e => { if (e.target.id === 'a8') { S.a = +e.target.value; draw(); } };
    b.onchange = e => { const t = e.target; if (t.name === 'b8') S.base = t.value; else if (t.name === 'e8') S.ev = t.value; else if (t.name === 'k8') S.k = +t.value; else return; draw(); };
    b.onclick = e => { if (e.target.closest('#p8')) copy(prop(), $('#o8', b)); };
    RES = chart; draw();
  } },
{ n: 9, g: 'B', t: 'THESIS 버전 관리', tag: '작동 · 바뀐 점 계산', how: 'v3 제안은 복사만',
  one: 'v1(11/10)·v2(11/15)를 나란히, 그 자리에서 고친 내용은 점선 "v3 제안"으로.',
  d: 'THESIS가 바뀔 때마다 날짜·이유·더하고 뺀 조건을 버전으로 남기고, 사용자가 v2 조건을 그 자리에서 고치면 점선 "v3 제안"과 바뀐 점이 만들어지며, 그 제안을 채널에 붙이면 Claude가 v3로 올리고 이유를 기록합니다.',
  run(b) {
    const V1 = '11/10 사용자 가설: USDT.D 같은 도미넌스 지표가 주요 지지·저항에 닿았다는 읽기.';
    const srcT = (TH.src || []).map(snowT).filter(Boolean);
    const ed = CONDS.map(c => ({ k: c.k, o: c.t, t: c.t, x: false })), add = [];
    const WD = { da: '추가', dd: '삭제', dc: '수정' };
    const diff = () => [...ed.filter(e => e.x).map(e => ({ s: '−', c: 'dd', t: `${e.k} ${e.o}` })), ...ed.filter(e => !e.x && e.t.trim() !== e.o).map(e => ({ s: '~', c: 'dc', t: `${e.k} ${e.o} → ${e.t.trim()}` })), ...add.map(t => ({ s: '+', c: 'da', t: '새 조건 ' + t }))];
    const dl = L => `<ul class="dl">${L.map(x => `<li class="${x.c}"><span class="s" aria-hidden="true">${x.s}</span><span><b>${WD[x.c]}</b> ${x.c === 'dd' ? `<s>${esc(x.t)}</s>` : esc(x.t)}</span></li>`).join('')}</ul>`;
    const txt = () => [`[FB thesis v3 제안 @${TODAY}]`, ...diff().map(x => `${x.s === '−' ? '-' : x.s} ${x.t}`)].join('\n');
    const dpart = () => { const L = diff(); return `<h3 class="h3 xt">v2 → v3 바뀐 점 ${L.length}</h3>${L.length ? dl(L) : '<p class="empty">아직 고친 곳이 없습니다. 위 칸을 고쳐 보세요.</p>'}<div class="row xt"><button type="button" class="btn pri" id="c9"${L.length ? '' : ' disabled'}>v3 제안 복사</button></div><div id="o9"></div>`; };
    const render = () => {
      const L = diff(), fo = document.activeElement?.id;
      b.innerHTML = `<div class="vtl" aria-label="버전 흐름"><div class="nd"><i></i><b>v1</b>11/10</div><div class="ln"></div><div class="nd"><i></i><b>v2</b>11/15 · 지금</div><div class="ln p"></div><div class="nd p"><i></i><b>v3</b>${L.length ? '제안됨' : '고치면 생김'}</div></div>
      <div class="vers">
        <div class="panel ver"><div class="vh"><b>v1</b><span class="mute">11/10</span></div><p class="view">${esc(V1)}</p><p class="src">조건 없음 · 가설 한 줄</p></div>
        <div class="panel ver"><div class="vh"><b>v2</b><span class="mute">11/15 · 지금</span></div><p class="view">${esc(TH.idea)}</p>
          <p class="src">이유: 한 줄 가설을 확인할 수 있는 조건 ${CONDS.length}개와 반대 근거 ${AG.length}개로 풀어 씀 · 근거 메시지 ${srcT.map(kdt).join(', ')} KST(메시지 ID에서 계산)</p>
          <h3 class="h3 xt">v1 → v2</h3>${dl([{ s: '~', c: 'dc', t: '가설 → ' + short(TH.idea, 56) }, ...CONDS.map(c => ({ s: '+', c: 'da', t: `${c.k} ${c.t}` })), ...AG.map(a => ({ s: '+', c: 'da', t: '반대 근거 · ' + a.t }))])}</div>
        <div class="panel ver p"><div class="vh"><b>v3</b><span class="mute">제안 · 아직 반영 안 됨</span></div>
          <ul class="ed">${ed.map((e, i) => { const ch = !e.x && e.t.trim() !== e.o; return `<li class="${e.x ? 'x' : ch ? 'c' : ''}"><label for="e9-${i}" class="mono">${e.k}${e.x ? ' · − 삭제 예정' : ch ? ' · ~ 수정됨' : ''}</label><input type="text" id="e9-${i}" data-ed="${i}" value="${esc(e.t)}"${e.x ? ' disabled' : ''}><div class="row"><button type="button" class="btn sm" id="x9-${i}" data-x="${i}" aria-pressed="${e.x}">${e.x ? '↺ 되살리기' : '✕ 빼기'}</button>${ch ? `<button type="button" class="btn sm" id="r9-${i}" data-rv="${i}">원래대로</button>` : ''}</div></li>`; }).join('')}
          ${add.map((t, i) => `<li class="c"><span class="mono">+ 새 조건</span><span>${esc(t)}</span><div><button type="button" class="btn sm" data-ad="${i}">빼기</button></div></li>`).join('')}</ul>
          <form class="addf xt" data-f9><label class="sr" for="n9">새 조건</label><input type="text" id="n9" placeholder="+ 새 조건 쓰기"><button class="btn">추가</button></form>
          <div id="d9">${dpart()}</div></div>
      </div>`;
      if (fo) document.getElementById(fo)?.focus();
    };
    b.oninput = e => { const i = e.target.dataset.ed; if (i != null) { ed[+i].t = e.target.value; $('#d9', b).innerHTML = dpart(); } };
    b.onchange = e => { if (e.target.dataset.ed != null) render(); };
    b.onclick = e => {
      const x = e.target.closest('[data-x]'); if (x) { ed[+x.dataset.x].x = !ed[+x.dataset.x].x; return render(); }
      const r = e.target.closest('[data-rv]'); if (r) { ed[+r.dataset.rv].t = ed[+r.dataset.rv].o; render(); return $(`#e9-${r.dataset.rv}`, b)?.focus(); }
      const a = e.target.closest('[data-ad]'); if (a) { add.splice(+a.dataset.ad, 1); return render(); }
      if (e.target.closest('#c9')) copy(txt(), $('#o9', b));
    };
    b.onsubmit = e => { e.preventDefault(); const v = $('#n9', b).value.trim(); if (v) { add.push(v); render(); $('#n9', b).focus(); } };
    render();
  } },
{ n: 10, g: 'B', t: '조건별 신뢰도', tag: '작동 · 요약 계산', save: 'local',
  one: '조건마다 유지/수정/삭제 + 확신 1~5 → 의심받는 조건 요약.',
  d: '조건마다 유지·수정·삭제와 확신(1~5)을 찍으면 어느 조건이 의심받는지 요약 막대로 모이고, 내보낸 글을 채널에 붙이면 Claude가 수정·삭제 표가 붙은 조건부터 원자료로 다시 확인해 고칩니다.',
  run(b) {
    let S = store.get('conf', {}); if (typeof S !== 'object' || !S) S = {};
    const V = { 유지: '✓', 수정: '✎', 삭제: '✕' };
    const meter = n => `<span class="meter" aria-label="확신 ${n || '?'}/5">${[1, 2, 3, 4, 5].map(k => `<i class="${k <= (n || 0) ? 'on' : ''}"></i>`).join('')}</span>`;
    const sum = () => {
      const cnt = { 유지: 0, 수정: 0, 삭제: 0, 안고름: 0 }; CONDS.forEach(c => cnt[S[c.k]?.v || '안고름']++);
      const dz = CONDS.filter(c => ['수정', '삭제'].includes(S[c.k]?.v)).sort((x, y) => (S[y.k].v === '삭제') - (S[x.k].v === '삭제') || (S[y.k].n || 0) - (S[x.k].n || 0));
      return `<div class="sbar" role="img" aria-label="유지 ${cnt.유지}, 수정 ${cnt.수정}, 삭제 ${cnt.삭제}, 안 고름 ${cnt.안고름}">${[['k', '유지'], ['e', '수정'], ['d', '삭제'], ['n', '안고름']].map(([c, k]) => cnt[k] ? `<span class="${c}" style="flex:${cnt[k]}">${k === '안고름' ? '안 고름' : V[k] + ' ' + k} ${cnt[k]}</span>` : '').join('')}</div>
        <h3 class="h3 xt">의심받는 조건 ${dz.length}</h3>${dz.length ? `<ul class="evl">${dz.map(c => `<li><b>${V[S[c.k].v]} ${S[c.k].v}</b><span class="t">${c.k} ${esc(short(c.t, 34))}</span>${meter(S[c.k].n)}</li>`).join('')}</ul>` : '<p class="empty">아직 없습니다.</p>'}`;
    };
    const txt = () => `[FB thesis 신뢰도 @${TODAY}] ` + (CONDS.filter(c => S[c.k]?.v).map(c => `${c.k} ${S[c.k].v}(${S[c.k].n || '?'}/5)`).join(' · ') || '(아직 고른 조건 없음)');
    b.innerHTML = `<div class="side"><div class="panel">${CONDS.map(c => { const s = S[c.k] || {}; return `<div class="crow"><div class="hd">${stc(c.s)}<span class="t"><code>${c.fid}</code> ${esc(c.t)}</span></div>
      <div class="row"><fieldset class="seg"><legend>판단</legend>${Object.keys(V).map(v => `<label><input type="radio" name="v-${c.k}" value="${v}" data-k="${c.k}" data-f="v"${s.v === v ? ' checked' : ''}><span>${V[v]} ${v}</span></label>`).join('')}</fieldset>
      <fieldset class="seg"><legend>확신</legend>${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="n-${c.k}" value="${n}" data-k="${c.k}" data-f="n"${s.n === n ? ' checked' : ''}><span>${n}</span></label>`).join('')}</fieldset></div></div>`; }).join('')}</div>
      <aside class="panel"><h3 class="h3">요약</h3><div id="s10">${sum()}</div><div class="row xt"><button type="button" class="btn pri" id="c10">내보내기(복사)</button><button type="button" class="btn" id="x10">모두 지우기</button></div><div id="o10"></div><p class="src">${saveNote()} (mm-fb-conf)</p></aside></div>`;
    b.onchange = e => { const t = e.target; if (!t.dataset.k) return; const s = S[t.dataset.k] ||= {}; s[t.dataset.f] = t.dataset.f === 'n' ? +t.value : t.value; store.set('conf', S); $('#s10', b).innerHTML = sum(); };
    b.onclick = e => {
      if (e.target.closest('#c10')) copy(txt(), $('#o10', b));
      if (e.target.closest('#x10')) { S = {}; store.del('conf'); $$('input[data-k]', b).forEach(i => i.checked = false); $('#s10', b).innerHTML = sum(); $('#o10', b).innerHTML = ''; }
    };
  } },
{ n: 11, g: 'B', t: '반대 근거함', tag: '작동', save: 'local',
  one: '조건마다 반대 근거를 모으고, 3개가 넘으면 "재검토 필요".',
  d: '조건마다 반대 근거를 한 줄씩 모아 두고(지금 THESIS의 반대 근거 4개를 낱말로 먼저 나눠 넣음) 3개 이상 쌓이면 "재검토 필요"가 붙으며, Claude는 그 표시가 붙은 조건을 다음 리서치에서 먼저 다시 확인합니다.',
  run(b) {
    const MAP = [[/ETH\s*9년선/, 'ETH'], [/USDT/, 'USDT'], [/208주|주봉/, '208주'], [/4년선|일봉/, '4년선'], [/48개월|월봉/, '48개월'], [/이탈폭/, '이탈폭']];
    const home = t => { for (const [re] of MAP) if (re.test(t)) { const c = CONDS.find(c => re.test(c.t)); if (c) return c.k; } return 'all'; };
    const seed = {}; AG.forEach(a => (seed[home(a.t)] ||= []).push(a.t));
    let add = store.get('against', {}); if (typeof add !== 'object' || !add) add = {};
    const list = k => [...(seed[k] || []).map(t => ({ t, o: 1 })), ...(add[k] || []).map((t, i) => ({ t, i }))];
    const box = (k, title, st) => { const L = list(k); return `<div class="crow"><div class="hd">${st || ''}<span class="t">${k === 'all' ? '<b>전체</b> <span class="mute sm">(특정 조건에 안 붙는 것)</span>' : `<code>thesis.${k}</code> ${esc(title)}`}</span><span class="bdg">반대 ${L.length}</span>${L.length >= 3 ? '<span class="bdg warn2">⚠ 재검토 필요</span>' : ''}</div>
      ${L.length ? `<ul class="evl">${L.map(x => `<li><span class="t">${esc(x.t)}</span>${x.o ? '<span class="bdg">THESIS 원문</span>' : `<span class="bdg">추가</span><button type="button" class="lnk sm" data-del="${k}:${x.i}" aria-label="이 반대 근거 지우기">지우기</button>`}</li>`).join('')}</ul>` : '<p class="mute sm" style="margin:0">아직 없음</p>'}
      <form class="addf" data-k="${k}"><label class="sr" for="i11-${k}">${k === 'all' ? '전체' : k} 반대 근거 추가</label><input type="text" id="i11-${k}" placeholder="반대 근거 한 줄"><button class="btn sm">추가</button></form></div>`; };
    const keys = [...CONDS.map(c => c.k), 'all'];
    const txt = () => [`[FB thesis 반대 근거 @${TODAY}]`, ...keys.map(k => { const L = list(k); return L.length ? `${k === 'all' ? '전체' : k}(${L.length}${L.length >= 3 ? ' · 재검토 필요' : ''}): ${L.map(x => x.t).join(' / ')}` : ''; }).filter(Boolean)].join('\n');
    const render = (fo) => {
      const need = keys.filter(k => list(k).length >= 3).length;
      b.innerHTML = `<div class="row xb"><span class="bdg big">재검토 필요 ${need}곳</span><span class="mute sm">원문 반대 근거 ${AG.length}개는 낱말(ETH 9년선·USDT 등)로 조건에 붙였고, 못 붙인 것은 "전체"에 두었습니다.</span></div>
        <div class="panel">${CONDS.map(c => box(c.k, c.t, stc(c.s))).join('')}${box('all')}</div>
        <div class="row xt"><button type="button" class="btn pri" id="c11">모두 복사</button></div><div id="o11"></div><p class="src">${saveNote()} (mm-fb-against)</p>`;
      if (fo) document.getElementById(fo)?.focus();
    };
    b.onsubmit = e => { e.preventDefault(); const k = e.target.dataset.k, i = $('input', e.target), v = i.value.trim(); if (!v) return; (add[k] ||= []).push(v); store.set('against', add); render(i.id); };
    b.onclick = e => {
      const d = e.target.closest('[data-del]'); if (d) { const [k, i] = d.dataset.del.split(':'); add[k].splice(+i, 1); store.set('against', add); return render('i11-' + k); }
      if (e.target.closest('#c11')) copy(txt(), $('#o11', b));
    };
    render();
  } },
{ n: 12, g: 'B', t: '정기 점검 카드', tag: '일부 계산 + 모형', how: 'Discord로 보내지 않음',
  one: '주봉 마감 뒤 상태가 바뀐 조건만 모은 Discord 카드 + 빠른 답장 버튼.',
  d: '매주 월요일 주봉이 닫히면 Claude가 상태가 바뀐 조건만 모은 점검 카드를 채널에 올리고, 사용자가 빠른 답장(그대로·고치기·다음 주에·근거 더)을 누르면 Claude가 그 답대로 조건을 유지하거나 고칩니다.',
  run(b) {
    const W = T.weekly || [], Dd = T.daily || [], w1 = W.at(-1), w0 = W.at(-2);
    if (!w1 || !w0 || !Dd.length) { b.innerHTML = '<p class="empty">주봉·일봉 자료가 모자라 이 시안을 그릴 수 없습니다.</p>'; return; }
    const closeOf = bar => mdS(addDays(bar, 7)) + ' 09시';
    const ch = [], same = [];
    const cW = condBy(/208주/), cD = condBy(/4년선/), cM = condBy(/48개월/), cU = condBy(/USDT/), cA = condBy(/이탈폭/), cE = condBy(/ETH/);
    if (cW) { const a = w0.pct >= 0 ? '충족' : '불충족', z = w1.pct >= 0 ? '충족' : '불충족'; (a !== z ? ch : same).push({ c: cW, t: `${a} → ${z}`, n: `주봉 ${pp(w0.pct)} → ${pp(w1.pct)} (208주선 ${n0(w1.line)})` }); }
    const dP = Dd.find(r => r.bar === addDays(w1.bar, -1)) || Dd[0], dN = Dd.at(-1); let k = 0; for (let i = Dd.length - 1; i >= 0 && Dd[i].pct < 0; i--) k++;
    if (cD) { const a = dP.pct >= 0 ? '선 위' : '선 아래', z = dN.pct >= 0 ? '선 위' : `선 아래 ${k}일째`; (a.slice(0, 3) !== z.slice(0, 3) ? ch : same).push({ c: cD, t: `${a} → ${z}`, n: `일봉 ${pp(dP.pct)}(${mdS(dP.bar)}) → ${pp(dN.pct)}(${mdS(dN.bar)})` }); }
    const am = cA && cA.t.match(/-(\d+(?:\.\d+)?)%/);
    if (cA && am) { const lim = -am[1], a = dP.pct >= lim, z = dN.pct >= lim; (a !== z ? ch : same).push({ c: cA, t: z ? '충족 중' : '넘음', n: `일봉 ${pp(dN.pct)} · 한도 ${lim}%` }); }
    if (cM && T.m48_live) { const p = (T.btc_live / T.m48_live - 1) * 100; same.push({ c: cM, t: '진행 중', n: `지금 값이면 ${pp(p)}로 ${p >= 0 ? '충족' : '불충족'} ✱` }); }
    if (cE && T.eth) same.push({ c: cE, t: T.eth.pct >= 0 ? '충족 중' : '불충족', n: `ETH ${pp(T.eth.pct)} ✱` });
    if (cU) same.push({ c: cU, t: '미확인', n: 'USDT.D는 사이트가 받지 않음' });
    const li = x => `<li><code>${x.c.k}</code> ${esc(short(x.c.t, 30))} — <b>${esc(x.t)}</b> <span class="mute">${esc(x.n)}</span></li>`;
    const QR = [['👍 그대로 두기', `그대로: 이번 판정에 동의 (${ch.map(x => `${x.c.k} ${x.t}`).join(', ') || '바뀐 조건 없음'})`], ['✏️ 조건 고치기', `고치기: ${ch[0]?.c.k || 'c1'} — (어떻게 고칠지 쓰기)`], ['⏸ 다음 주에', `보류: 다음 주봉(${closeOf(addDays(w1.bar, 7))}) 마감 뒤 다시`], ['❓ 근거 더', `질문: ${ch.map(x => x.c.k).join('·') || 'c1'} 판정의 원자료(종가·기준선)를 보여 주세요`]];
    b.innerHTML = `<div class="dmsg" role="article" aria-label="Discord 메시지 모양(모형)"><div class="ava" aria-hidden="true">C</div><div style="min-width:0"><div><span class="nm">Claude</span><span class="tg">앱</span><span class="dtm">${closeOf(w1.bar)} 주봉 마감 뒤 · 예시 시각</span></div>
      <div class="embed"><b>📋 THESIS 주간 점검 · 기준: ${closeOf(w0.bar)} 이후</b>
        <div><b>바뀐 조건 ${ch.length}</b>${ch.length ? `<ul>${ch.map(li).join('')}</ul>` : '<p class="mute" style="margin:0">없음</p>'}</div>
        <div><b>그대로 ${same.length}</b><ul>${same.map(li).join('')}</ul></div>
        <div class="src">계산: 이 사이트 데이터(바이낸스 일·주·월봉, ${esc(T.asof)} KST) · ✱ 지난주 값이 없어 지금 값만</div></div>
      <div class="qr" role="group" aria-label="빠른 답장">${QR.map(([l], i) => `<button type="button" class="btn" data-qr="${i}">${l}</button>`).join('')}</div></div></div>
      <div class="panel xt" style="max-width:760px"><h3 class="h3">답장 미리보기</h3><label class="sr" for="r12">답장 글</label><textarea id="r12" rows="2" placeholder="위 빠른 답장을 누르세요"></textarea><div class="row xt"><button type="button" class="btn pri" id="c12">답장 복사</button></div><div id="o12"></div></div>`;
    b.onclick = e => {
      const q = e.target.closest('[data-qr]'); if (q) { const t = $('#r12', b); t.value = `[FB thesis 주간점검 @${TODAY}] ${QR[+q.dataset.qr][1]}`; t.focus(); return; }
      if (e.target.closest('#c12')) { const v = $('#r12', b).value.trim(); if (v) copy(v, $('#o12', b), true); else $('#o12', b).innerHTML = '<p class="okmsg" role="status">먼저 빠른 답장을 고르세요.</p>'; }
    };
  } },
{ n: 13, g: 'C', t: '카드 버튼', tag: '작동 · 다시 줄 세우기', how: 'pins.json은 바꾸지 않음',
  one: '카드마다 올려/내려/📌고정/숨김 + 이유 → 바로 다시 줄 서고 pins.json 바뀔 모양.',
  d: '카드마다 올려·내려·📌고정·숨김을 이유와 함께 누르면 목록이 바로 다시 줄 서고 pins.json이 어떻게 바뀔지 보이며, 그 요청을 채널에 붙이면 Claude가 pins.json을 고쳐 다음 빌드부터 그 자리에 둡니다.',
  run(b) {
    const A = {}, AN = { up: '▲ 올려', down: '▼ 내려', pin: '📌 고정', hide: '숨김' }, AW = { up: '올려', down: '내려', pin: '고정', hide: '숨김' };
    const pick = a => ALL.filter(i => A[i]?.a === a);
    const order = () => { const top = [...pick('pin'), ...pick('up'), ...ALL.filter(i => !A[i])]; return [...top.slice(0, MAJ.length), ...pick('down'), ...top.slice(MAJ.length)]; };
    const acts = id => `<div class="acts" role="group" aria-label="${esc(LBL(id))} 자리 바꾸기">${Object.entries(AN).map(([a, n]) => `<button type="button" class="btn" id="a13-${a}-${id}" data-act="${a}" data-id="${id}" aria-pressed="${A[id]?.a === a}">${n}</button>`).join('')}</div>${A[id] ? `<label class="fl"><span>${AW[A[id].a]} 이유</span><input type="text" data-why="${id}" value="${esc(A[id].why || '')}" placeholder="한 줄"></label>` : ''}`;
    const mv = (id, i) => { const d = ALL.indexOf(id) - i; return ALL.indexOf(id) >= MAJ.length && i < MAJ.length ? '<span class="mv nw">새로 주요</span>' : d > 0 ? `<span class="mv up">▲${d}</span>` : d < 0 ? `<span class="mv dn">▼${-d}</span>` : ''; };
    const diff = () => {
      const pin = pick('pin'), dn = pick('down'), up = pick('up'), hid = pick('hide'), J = a => JSON.stringify(a), tail = up.length || hid.length;
      const L = [[' ', '{'], [' ', '  "_note": "…",'], ...(pin.length ? [['-', '  "pin": [],'], ['+', `  "pin": ${J(pin)},`]] : [[' ', '  "pin": [],']]), ...(dn.length ? [['-', '  "down": []'], ['+', `  "down": ${J(dn)}${tail ? ',' : ''}`]] : [[tail ? '-' : ' ', '  "down": []'], ...(tail ? [['+', '  "down": [],']] : [])]), ...(up.length ? [['+', `  "up": ${J(up)}${hid.length ? ',' : ''}   ← 새 칸 제안`]] : []), ...(hid.length ? [['+', `  "hide": ${J(hid)}   ← 새 칸 제안`]] : []), [' ', '}']];
      return `<div class="diff" aria-label="pins.json 바뀔 모양">${L.map(([s, t]) => `<div class="${s === '+' ? 'a' : s === '-' ? 'r' : ''}">${s === ' ' ? '&nbsp;' : s} ${esc(t)}</div>`).join('')}</div>`;
    };
    const txt = () => { const L = ALL.filter(i => A[i]).map(i => `[FB issue.${i} @${TODAY}] ${AW[A[i].a]}: ${A[i].why || '(이유 없음)'} ‹${LBL(i)}›`); return L.length ? L.join('\n') : ''; };
    const side = () => `<h3 class="h3">pins.json 바뀔 모양</h3><p class="src" style="margin:0">지금(11/17 빌드): pin·down 모두 비어 있음. 올려·숨김은 pins.json에 칸이 없어 새 칸으로 제안합니다.</p>${diff()}<div class="row xt"><button type="button" class="btn pri" id="c13"${txt() ? '' : ' disabled'}>요청 복사</button><button type="button" class="btn" id="x13">처음대로</button></div><div id="o13"></div>`;
    const render = fo => {
      const L = order(), hid = pick('hide');
      b.innerHTML = `<div class="side"><div>${H2MAJ}${LEG}<div class="cards">${L.slice(0, MAJ.length).map((id, n) => cardMini(id, n, { delta: mv, foot: x => acts(x.id) })).join('')}</div>
        <h2 class="h2">관찰 · 주요 자리 밖</h2><div class="rows">${L.slice(MAJ.length).map((id, n) => `<div class="rowi"><div class="h"><b>${n + MAJ.length + 1}. ${esc(LBL(id))}</b>${mv(id, n + MAJ.length)}<span>점수 ${SC[id].s.toFixed(1)}</span>${A[id]?.a === 'down' ? '<span class="mv dn">▼ 내림</span>' : ''}</div>${acts(id)}</div>`).join('')}</div>
        ${hid.length ? `<h2 class="h2">숨김 ${hid.length}</h2><div class="rows">${hid.map(id => `<div class="rowi"><div class="h"><b>${esc(LBL(id))}</b><span>숨김</span></div>${acts(id)}</div>`).join('')}</div>` : ''}</div>
        <aside class="panel" id="s13">${side()}</aside></div>`;
      if (fo) document.getElementById(fo)?.focus();
    };
    b.onclick = e => {
      const x = e.target.closest('[data-act]'); if (x) { const { act, id } = x.dataset; if (A[id]?.a === act) delete A[id]; else A[id] = { a: act, why: A[id]?.why || '' }; return render(x.id); }
      if (e.target.closest('#c13')) return copy(txt(), $('#o13', b));
      if (e.target.closest('#x13')) { for (const k in A) delete A[k]; render('x13'); }
    };
    b.oninput = e => { const id = e.target.dataset.why; if (id && A[id]) { A[id].why = e.target.value; const o = $('#s13', b); const keep = $('#o13', b).innerHTML; o.innerHTML = side(); $('#o13', b).innerHTML = keep; } };
    render();
  } },
{ n: 14, g: 'C', t: '드래그로 순서 정하기', tag: '작동 · 일치도 계산', how: '순서는 이 화면에만',
  one: '사안을 끌어서(또는 ▲▼) 원하는 순서로, 점수 순서와 얼마나 같은지 숫자로.',
  d: '사안을 끌어 놓거나 ▲▼로 원하는 순서를 만들면 점수 순서와의 차이와 일치도가 바로 계산되고, 내보낸 순서를 채널에 붙이면 Claude가 점수 규칙(가중치)을 그 순서에 가깝게 고칠지 고정으로 둘지 제안합니다.',
  run(b) {
    const SO = [...ALL].sort((x, y) => SC[y].s - SC[x].s), K = MAJ.length;
    let L = [...ALL], dragId = null;
    const rho = () => { const n = L.length; let s = 0; L.forEach((id, i) => { const d = i - SO.indexOf(id); s += d * d; }); return 1 - 6 * s / (n * (n * n - 1)); };
    const ovl = () => L.slice(0, K).filter(i => SO.slice(0, K).includes(i)).length, off = () => L.reduce((s, id, i) => s + Math.abs(i - SO.indexOf(id)), 0), same0 = ALL.every((id, i) => SO[i] === id);
    const li = (id, i) => { const so = SO.indexOf(id), d = so - i; return `<li draggable="true" data-id="${id}" class="${i < K ? 'maj' : ''}"><span class="grip" aria-hidden="true">≡</span><span class="rk">${i + 1}</span><span>${esc(LBL(id))} <span class="mute sm">점수 ${SC[id].s.toFixed(1)} · 점수 순 ${so + 1}위</span></span><span class="mv ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}" title="점수 순과 차이">${d > 0 ? '▲' + d : d < 0 ? '▼' + -d : '='}</span><span class="ud"><button type="button" class="btn" id="u14-${id}" data-mv="-1" data-id="${id}" aria-label="${esc(LBL(id))} 위로"${i ? '' : ' disabled'}>▲</button><button type="button" class="btn" id="d14-${id}" data-mv="1" data-id="${id}" aria-label="${esc(LBL(id))} 아래로"${i < L.length - 1 ? '' : ' disabled'}>▼</button></span></li>` + (i === K - 1 ? `<li class="divider" aria-hidden="true">— 여기까지 주요 자리 ${K} —</li>` : ''); };
    const txt = () => `[FB 주요 자리 순서 @${TODAY}] ${L.map((id, i) => `${i + 1} ${id}`).join(' · ')} (점수 순과 일치도 ${rho().toFixed(3)}, 어긋난 칸 ${off()}, 주요 ${K}자리 겹침 ${ovl()}/${K})`;
    const render = fo => {
      b.innerHTML = `<div class="side"><div class="panel"><p class="mute sm" style="margin:0 0 8px">≡ 손잡이를 끌어 놓거나 ▲▼를 누르세요(키보드는 Tab → Enter). ▲▼ 숫자 = 점수 순보다 몇 칸 위/아래인지.</p><ol class="dnd" aria-label="사안 순서">${L.map(li).join('')}</ol></div>
        <aside class="panel"><div class="row" style="gap:18px"><div class="stat"><b>${rho().toFixed(3)}</b><span>점수 순과 일치도(스피어만, 1 = 같음)</span></div><div class="stat"><b>${off()}칸</b><span>점수 순과 어긋난 칸 합</span></div><div class="stat"><b>${ovl()}/${K}</b><span>주요 ${K}자리 겹침</span></div></div>
          <div class="row xt"><button type="button" class="btn" id="r14">지금 자리로</button><button type="button" class="btn" id="s14">점수 순으로</button></div>
          <div class="row xt"><button type="button" class="btn pri" id="c14">순서 복사</button></div><div id="o14"></div>
          <p class="src">처음 순서 = 지금 사이트 배치${same0 ? '(오늘은 점수 순과 같음)' : '(이틀 연속 규칙이 있어 점수 순과 조금 다름)'}.</p></aside></div>`;
      if (fo) { const el = document.getElementById(fo); (el && !el.disabled ? el : document.getElementById(fo.replace(/^u/, 'x').replace(/^d/, 'u').replace(/^x/, 'd')))?.focus(); }
    };
    b.onclick = e => {
      const m = e.target.closest('[data-mv]'); if (m) { const i = L.indexOf(m.dataset.id), j = i + +m.dataset.mv; if (j >= 0 && j < L.length) { [L[i], L[j]] = [L[j], L[i]]; render(m.id); } return; }
      if (e.target.closest('#r14')) { L = [...ALL]; return render('r14'); }
      if (e.target.closest('#s14')) { L = [...SO]; return render('s14'); }
      if (e.target.closest('#c14')) copy(txt(), $('#o14', b));
    };
    b.addEventListener('dragstart', e => { const li = e.target.closest?.('li[data-id]'); if (!li) return; dragId = li.dataset.id; li.classList.add('drag'); e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', dragId); } catch { } });
    b.addEventListener('dragover', e => { const li = e.target.closest?.('li[data-id]'); if (!li || !dragId) return; e.preventDefault(); $$('.over', b).forEach(x => x.classList.remove('over')); li.classList.add('over'); });
    b.addEventListener('drop', e => { const li = e.target.closest?.('li[data-id]'); if (!li || !dragId) return; e.preventDefault(); const to = L.indexOf(li.dataset.id); L.splice(L.indexOf(dragId), 1); L.splice(to, 0, dragId); dragId = null; render(); });
    b.addEventListener('dragend', () => { dragId = null; $$('.drag,.over', b).forEach(x => x.classList.remove('drag', 'over')); });
    render();
  } },
{ n: 15, g: 'C', t: '"왜 이 자리?" 분해 + 가중치', tag: '실제 계산', calc: 1, how: '배수는 이 화면에만',
  one: '점수를 언급·질문·가격·미결로 쪼개 보고, 배수를 바꾸면 순위가 바로 바뀜.',
  d: '사안 점수를 언급·질문·가격·미결 네 조각으로 쪼개 보여 주고 조각마다 배수(0~3배)를 움직이면 순위가 바로 다시 매겨지며, 내보낸 배수를 채널에 붙이면 Claude가 build.py의 점수 규칙을 그 배수로 바꿔 다시 빌드합니다.',
  run(b) {
    const w = { m: 1, q: 1, p: 1, o: 1 }, K = MAJ.length;
    const base = [...ALL].sort((x, y) => SC[y].s - SC[x].s);
    const sc = id => PARTS.reduce((s, [k]) => s + SC[id][k] * w[k], 0);
    const rank = () => [...ALL].sort((x, y) => sc(y) - sc(x));
    const txt = () => { const R = rank(), inn = R.slice(0, K).filter(i => !base.slice(0, K).includes(i)), out = base.slice(0, K).filter(i => !R.slice(0, K).includes(i)); return `[FB 점수 배수 @${TODAY}] ${PARTS.map(([k, n]) => `${n} ${w[k].toFixed(1)}×`).join(' · ')} → 주요 ${K}: ${R.slice(0, K).join(', ')}${inn.length ? ` (들어옴 ${inn.join(', ')} / 나감 ${out.join(', ')})` : ' (지금과 같음)'}`; };
    b.innerHTML = `<div class="panel"><div class="sl">${PARTS.map(([k, n, c]) => `<label><span><span><i class="sw4" style="background:var(${c})"></i>${n}</span><b id="w15-${k}">1.0×</b></span><input type="range" min="0" max="3" step="0.1" value="1" data-w="${k}" aria-label="${n} 배수"></label>`).join('')}</div>
      <div class="row xt"><button type="button" class="btn sm" data-pre="1">모두 1×</button><button type="button" class="btn sm" data-pre="q2">질문 2×</button><button type="button" class="btn sm" data-pre="p0">가격 빼기</button><button type="button" class="btn sm" data-pre="m0">언급 빼기</button></div>
      <details class="drawer xt"><summary>지금 점수 규칙(build.py)</summary><ul class="against">${PARTS.map(([k, n]) => `<li><b>${n}</b>: ${esc(D.meta.weights?.[k] || '')}</li>`).join('')}</ul></details></div>
      <div class="side xt"><div class="panel"><p class="mute sm" style="margin:0 0 6px">막대 = 배수를 곱한 조각. ↑↓ = 지금 점수 순위에서 몇 칸 움직였나.</p><div id="r15"></div></div>
      <aside class="panel"><h3 class="h3">주요 ${K}자리 변화</h3><div id="io15"></div><div class="row xt"><button type="button" class="btn pri" id="c15">배수 복사</button></div><div id="o15"></div></aside></div>`;
    const draw = () => {
      const R = rank(), mx = Math.max(...R.map(sc), 1e-9), inn = R.slice(0, K).filter(i => !base.slice(0, K).includes(i)), out = base.slice(0, K).filter(i => !R.slice(0, K).includes(i));
      PARTS.forEach(([k]) => $(`#w15-${k}`, b).textContent = w[k].toFixed(1) + '×');
      $('#r15', b).innerHTML = R.map((id, i) => { const d = base.indexOf(id) - i; return `<div class="wrow"><span class="rk">${i + 1}</span><span class="nm">${esc(LBL(id))} <span class="mv ${d > 0 ? 'up' : d < 0 ? 'dn' : ''}">${d > 0 ? '↑' + d : d < 0 ? '↓' + -d : ''}</span>${MAJ.includes(id) ? ' <span class="bdg">지금 주요</span>' : ''}</span>${bar(SC[id], mx, w)}</div>${i === K - 1 ? `<div class="divider">— 여기까지 주요 ${K}자리 —</div>` : ''}`; }).join('');
      $('#io15', b).innerHTML = inn.length ? `<ul class="evl"><li><b class="mv up">↑ 들어옴</b><span class="t">${inn.map(i => esc(LBL(i))).join(', ')}</span></li><li><b class="mv dn">↓ 나감</b><span class="t">${out.map(i => esc(LBL(i))).join(', ')}</span></li></ul>` : '<p class="empty" style="padding:4px 0">점수 순 주요 자리와 같습니다.</p>';
    };
    b.oninput = e => { const k = e.target.dataset.w; if (k) { w[k] = +e.target.value; draw(); } };
    b.onclick = e => {
      const p = e.target.closest('[data-pre]'); if (p) { const v = p.dataset.pre; Object.assign(w, { m: 1, q: 1, p: 1, o: 1 }, v === 'q2' ? { q: 2 } : v === 'p0' ? { p: 0 } : v === 'm0' ? { m: 0 } : {}); $$('[data-w]', b).forEach(i => i.value = w[i.dataset.w]); return draw(); }
      if (e.target.closest('#c15')) copy(txt(), $('#o15', b));
    };
    draw();
  } },
{ n: 16, g: 'C', t: '사안 정리 요청', tag: '작동 · 글 만들기', how: '복사만 합니다',
  one: '사안 합치기·나누기·이름 바꾸기·키워드 추가·새 사안을 양식으로.',
  d: '사안을 합치거나 나누거나 이름·키워드를 바꾸거나 새 사안을 만들고 싶을 때 양식을 채우면 요청 글이 만들어지고, 채널에 붙이면 Claude가 issues.py의 사안 목록·키워드를 고쳐 기록 전체를 다시 분류합니다.',
  run(b) {
    const T16 = { merge: '합치기', split: '나누기', rename: '이름 바꾸기', kw: '키워드 추가', add: '새 사안' };
    const opt = ALL.map(id => `<option value="${id}">${esc(LBL(id))} (${id})</option>`).join('');
    const kinds = [...new Set(D.meta.issues.map(i => i.kind))];
    b.innerHTML = `<form class="panel fgrid" id="f16" novalidate>
      <fieldset class="seg"><legend>무엇을</legend>${Object.entries(T16).map(([k, n], i) => `<label><input type="radio" name="a" value="${k}"${i ? '' : ' checked'}><span>${n}</span></label>`).join('')}</fieldset>
      <fieldset data-for="merge" style="border:0;padding:0;margin:0"><legend class="fl"><span>합칠 사안(2개 이상)</span></legend><div class="chk">${ALL.map(id => `<label><input type="checkbox" name="mg" value="${id}">${esc(LBL(id))}</label>`).join('')}</div></fieldset>
      <label class="fl" data-for="split rename kw"><span>사안</span><select name="one">${opt}</select></label>
      <label class="fl" data-for="merge rename add"><span>새 이름</span><input type="text" name="nm" placeholder="예: 밈·알트 수급"></label>
      <label class="fl" data-for="split"><span>나눌 이름들(줄마다 하나)</span><textarea name="parts" rows="3" placeholder="예: PEPE / SPX를 줄마다"></textarea></label>
      <label class="fl" data-for="kw add"><span>키워드(쉼표로)</span><input type="text" name="kw" placeholder="예: 언락, 바이백"></label>
      <div class="row" data-for="add"><label class="fl"><span>종류</span><select name="kind">${kinds.map(k => `<option>${esc(k)}</option>`).join('')}</select></label><label class="fl" style="flex:1 1 160px"><span>가격을 볼 종목(쉼표로)</span><input type="text" name="as" placeholder="예: BTC"></label></div>
      <label class="fl"><span>이유(한 줄)</span><input type="text" name="why"></label>
      <div><div class="slotlabel">요청 글 미리보기</div><pre class="out" id="p16" aria-live="polite"></pre></div>
      <div class="row"><button class="btn pri">요청 글 복사</button></div><div id="o16"></div></form>`;
    const f = $('#f16', b), E = f.elements;
    const txt = () => {
      const a = E.a.value, why = E.why.value.trim(), W = why ? ` · 이유: ${why}` : '', H0 = `[FB 사안 정리 @${TODAY}] ${T16[a]}: `;
      if (a === 'merge') { const m = $$('[name=mg]:checked', f).map(x => x.value); return m.length < 2 ? { t: '합칠 사안을 2개 이상 고르세요.' } : { ok: 1, t: H0 + m.map(i => 'issue.' + i).join(' + ') + ` → "${E.nm.value.trim() || m.map(LBL).join('·')}"` + W }; }
      if (a === 'split') { const p = E.parts.value.split(/\n|\//).map(s => s.trim()).filter(Boolean); return p.length < 2 ? { t: '나눌 이름을 2개 이상 쓰세요.' } : { ok: 1, t: H0 + `issue.${E.one.value} → ${p.map(x => `"${x}"`).join(' / ')}` + W }; }
      if (a === 'rename') { const n = E.nm.value.trim(); return !n ? { t: '새 이름을 쓰세요.' } : { ok: 1, t: H0 + `issue.${E.one.value} "${LBL(E.one.value)}" → "${n}"` + W }; }
      if (a === 'kw') { const k = E.kw.value.split(/[,，]/).map(s => s.trim()).filter(Boolean); return !k.length ? { t: '키워드를 쓰세요.' } : { ok: 1, t: H0 + `issue.${E.one.value} 키워드 += ${k.join(', ')}` + W }; }
      const n = E.nm.value.trim(); return !n ? { t: '새 사안 이름을 쓰세요.' } : { ok: 1, t: H0 + `"${n}" · 종류 ${E.kind.value} · 키워드 ${E.kw.value.trim() || '(없음)'} · 종목 ${E.as.value.trim() || 'BTC'}` + W };
    };
    const up = () => { const a = E.a.value; $$('[data-for]', f).forEach(el => el.hidden = !el.dataset.for.split(' ').includes(a)); const r = txt(); $('#p16', b).textContent = r.t; $('#p16', b).classList.toggle('mute', !r.ok); };
    f.addEventListener('input', up); f.addEventListener('change', up); up();
    f.onsubmit = e => { e.preventDefault(); const r = txt(); if (!r.ok) { $('#o16', b).innerHTML = `<p class="okmsg" role="status">${esc(r.t)}</p>`; return; } copy(r.t, $('#o16', b), true); };
  } },
{ n: 17, g: 'D', t: '피드백마다 상태', tag: '실제 기록 + 모형', how: '옮기기·새로 넣기는 이 화면에만',
  one: '받음 → 반영 예정 → 진행 중 → 반영됨 / 보류(이유). 오늘 실제 피드백 6건.',
  d: '사용자가 남긴 피드백마다 받음·반영 예정·진행 중·반영됨·보류(이유) 중 어디에 있는지 한 판에 보여 주고(오늘 실제 피드백 6건), Claude는 커밋할 때마다 해당 카드를 옮기고 커밋 링크를 붙입니다.',
  run(b) {
    const COLS = ['받음', '반영 예정', '진행 중', '반영됨', '보류'], CI = { 받음: '○', '반영 예정': '◐', '진행 중': '▶', 반영됨: '●', 보류: '⏸' };
    const F = FEED.map(x => ({ ...x, real: 1 }));
    const card = (x, i) => `<div class="kcard"><div class="t">${esc(x.t)}</div><div class="w">${x.real ? `실제 · ${esc(x.at)}` : '방금 · 저장 안 됨'}${x.sha ? ` · ${ext(CM(x.sha), '커밋 ' + x.sha)}` : ''}</div>${x.note ? `<div>${esc(x.note)}</div>` : ''}${x.trail ? `<ol class="trail">${x.trail.map(t => `<li>${esc(t)}</li>`).join('')}</ol>` : ''}
      ${x.st === '보류' ? `<label class="fl"><span>보류 이유</span><input type="text" data-why="${i}" value="${esc(x.why || '')}" placeholder="왜 보류인지"></label>` : ''}
      <label class="fl"><span>옮기기(모형)</span><select data-mv="${i}" id="m17-${i}">${COLS.map(c => `<option value="${c}"${c === x.st ? ' selected' : ''}>${CI[c]} ${c}</option>`).join('')}</select></label></div>`;
    const render = fo => {
      const c = s => F.filter(x => x.st === s).length;
      b.innerHTML = `<p class="row xb"><span class="bdg big">${F.length}건 · ${COLS.filter(c).map(s => `${CI[s]} ${s} ${c(s)}`).join(' · ')}</span><span class="mute sm">11/17 18:43 기준 실제 기록. 커밋 링크는 GitHub로 갑니다.</span></p>
        <div class="kb">${COLS.map(s => `<section class="kcol" aria-label="${s}"><h3><span>${CI[s]} ${s}</span><span>${c(s)}</span></h3>${F.map((x, i) => x.st === s ? card(x, i) : '').join('') || '<p class="mute sm" style="margin:2px 4px">없음</p>'}</section>`).join('')}</div>
        <form class="panel xt addf" data-f17 style="max-width:620px"><label class="sr" for="n17">새 피드백</label><input type="text" id="n17" placeholder="새 피드백 한 줄 → 받음(모형)"><button class="btn">넣기</button></form>`;
      if (fo) document.getElementById(fo)?.focus();
    };
    b.onchange = e => { const i = e.target.dataset.mv; if (i != null) { const x = F[+i]; x.trail = [...(x.trail || []), `${e.target.value}(방금 · 모형)`]; x.st = e.target.value; render(x.st === '보류' ? null : 'm17-' + i); if (x.st === '보류') $(`[data-why="${i}"]`, b)?.focus(); } };
    b.oninput = e => { const i = e.target.dataset.why; if (i != null) F[+i].why = e.target.value; };
    b.onsubmit = e => { e.preventDefault(); const v = $('#n17', b).value.trim(); if (v) { F.push({ t: v, st: '받음', trail: ['받음(방금 · 모형)'] }); render('n17'); } };
    render();
  } },
{ n: 18, g: 'D', t: '빌드마다 "이번에 반영한 피드백"', tag: '실제 기록', how: '내용은 실제 커밋, 배치만 시안',
  one: '빌드(커밋)마다 반영한 피드백을 전·후로. 오늘 실제 커밋 3개.',
  d: '사이트를 다시 빌드할 때마다 그 빌드에서 반영한 피드백을 전·후 모습과 커밋 링크로 맨 위에 띄우고, Claude는 커밋 메시지에 피드백 이름을 적어 두어 이 칸이 저절로 채워지게 합니다.',
  run(b) {
    const BUILDS = [
      { p: 1, at: '다음 빌드(예정)', items: [{ fb: '시안 5개 전부 채택', bf: '"화면" 칸: 탭 6개 + 글 목록', af: '시안 다섯 방식을 모두 담은 "화면" 칸' }, { fb: '피드백 아이디어 19개 시안', bf: '피드백은 채널에서 말로만', af: '고르신 피드백 방식을 본판에' }] },
      { sha: '4cf5c30', at: '11/17 18:43', items: [{ fb: 'MTF 50선 = 통과 종목만', bf: 'MTF 50선 칸: 바이낸스 무기한 521개 전체 표', af: '모든 판정 TF에서 SMA50 위인 통과 종목만(시총 순) + 최근 7일 이탈 목록' }] },
      { sha: '7401504', at: '11/17 18:32', items: [{ fb: '사각지대 칸 폐기', bf: '사각지대 칸', af: 'MTF 50선 칸(맨 끝)' }, { fb: 'KOL 수집 결과 더 다루기', bf: 'KOL: 한 줄 요약', af: 'KOL 수집 결과 칸: 글 532개·261명 펼침, 사람별 묶음, 원문 링크' }] },
      { sha: 'faa9c19', at: '11/17 18:08', items: [{ fb: '"화면" 칸 시안 5개', bf: '"화면" 칸: 탭 6개 + 글 목록', af: 'lab/ 시안 5개: 차트 한 장 · 질문 여섯 개 · 사안별 이야기 · 하루씩 흐름 · 종목 한 줄씩' }] },
    ];
    const last = BUILDS.find(x => x.sha);
    b.innerHTML = `<h2 class="h2">본판 맨 위에 뜨는 모양</h2><details class="banner"><summary><b>✓ 이번 빌드(${last.sha} · ${last.at})에 반영한 피드백 ${last.items.length}건</b> · ${esc(last.items.map(x => x.fb).join(', '))}</summary><p style="margin:6px 0 0">${esc(last.items[0].bf)} → <b>${esc(last.items[0].af)}</b> · ${ext(CM(last.sha), '커밋 보기')}</p></details>
      <h2 class="h2">빌드 기록</h2><div class="blds">${BUILDS.map(x => `<section class="panel bld${x.p ? ' p' : ''}"><div class="bh"><b>${x.sha ? `빌드 ${x.sha}` : '다음 빌드'}</b><span class="mute">${esc(x.at)}</span>${x.sha ? ext(CM(x.sha), '커밋') : '<span class="bdg">예정 · 아직 안 됨</span>'}<span class="mute sm">반영 ${x.items.length}건</span></div>
        ${x.items.map(it => `<div class="xt"><div><b>${esc(it.fb)}</b></div><div class="ba"><div class="bf"><small>전</small>${esc(it.bf)}</div><div class="ar" aria-hidden="true">→</div><div class="af"><small>${x.p ? '후(예정)' : '후'}</small>${esc(it.af)}</div></div></div>`).join('')}</section>`).join('')}</div>`;
  } },
{ n: 19, g: 'D', t: '고정 ID + 💬N 배지', tag: '작동 · 배지 예시', how: '💬 숫자는 예시',
  one: '"ID 보기"로 모든 조건·카드에 고정 ID와 💬N 배지를 겹쳐 봄.',
  d: '"ID 보기"를 켜면 THESIS 조건과 카드마다 고정 ID(thesis.c3, issue.etf …)와 의견 수 💬N이 겹쳐 보여 채널에서 "thesis.c3 이상함"처럼 짧게 가리킬 수 있고, Claude는 그 ID로 원본을 바로 찾아 고칩니다.',
  run(b) {
    const cnt = fid => hash(fid + 'x') % 4;
    const tag = x => `<button type="button" class="idt" data-cp="${x.fid}" aria-label="${x.fid} 복사">${x.fid}</button>${cnt(x.fid) ? ` <span class="bdg cnt">💬${cnt(x.fid)} 예시</span>` : ''}`;
    b.innerHTML = `<div class="row xb"><button type="button" class="btn" id="t19" aria-pressed="true">ID 보기 켜짐</button><span class="mute sm">ID를 누르면 복사됩니다. 💬 숫자는 예시입니다.</span><span id="o19" class="sm" role="status"></span></div>
      <div id="z19" class="ids">${thesisMini({ fid: 1, tail: tag, open: true })}${H2MAJ}${cardsMini(MAJ, { fid: 1, tail: tag })}</div>
      <div class="panel xt"><h3 class="h3">ID 규칙</h3><ul class="evl"><li><code>thesis.idea</code><span class="t">THESIS 한 줄</span></li><li><span><code>thesis.c1</code> ~ <code>thesis.c${CONDS.length}</code></span><span class="t">조건(위에서부터)</span></li><li><span><code>thesis.a1</code> ~ <code>thesis.a${AG.length}</code></span><span class="t">반대 근거</span></li><li><code>issue.&lt;id&gt;</code><span class="t">사안 카드(예: issue.etf). 사안 id는 issues.py에 고정</span></li></ul>
      <p class="src">지금 c·a 번호는 순서로 매깁니다. 채택하면 curated.json에 조건마다 id를 적어, 조건을 더하거나 빼도 번호가 밀리지 않게 합니다.</p></div>`;
    b.onclick = e => {
      const t = e.target.closest('#t19'); if (t) { const on = $('#z19', b).classList.toggle('ids'); t.setAttribute('aria-pressed', on); t.textContent = on ? 'ID 보기 켜짐' : 'ID 보기 꺼짐'; return; }
      const c = e.target.closest('[data-cp]'); if (c) copy(c.dataset.cp).then(ok => { $('#o19', b).textContent = ok ? `✓ ${c.dataset.cp} 복사` : `복사가 막혔습니다: ${c.dataset.cp}`; });
    };
  } },
];

// 목록·이동 ---------------------------------------------------------------
const BY = Object.fromEntries(IDEAS.map(I => [I.n, I]));
const pillOf = I => I.save === 'local' ? `<span class="pill local">💾 ${store.ok ? '이 브라우저에만 저장' : '저장 막힘 · 창 닫으면 사라짐'}</span>` : `<span class="pill mock">⚠ 모형 · 실제로 저장되지 않음${I.how ? ' · ' + esc(I.how) : ''}</span>`;
const kindOf = I => `<span class="pill${I.calc ? ' real' : ''}">${I.calc ? '✓ ' : ''}${esc(I.tag)}</span>`;
function overview(b) {
  b.innerHTML = `<div class="lt"><span class="no">피드백 방법 시안</span><h1>피드백 남기는 방법 19가지</h1><p class="q">사이트에 의견을 남기는 방법을 19가지로 나눠, 지금 THESIS·주요 자리의 작은 사본 위에서 직접 눌러 볼 수 있게 했습니다. 번호로 고르시면(섞어도 됩니다, 예: 1·8·17) 그 방식만 본판에 붙입니다.</p>
    <div class="row xt"><span class="pill real">✓ 실제 계산</span><span class="pill">작동(복사·링크)</span><span class="pill mock">⚠ 모형 · 실제로 저장되지 않음</span><span class="pill local">💾 이 브라우저에만 저장</span></div></div>`
    + Object.entries(GRP).map(([k, name]) => `<section class="grp" aria-labelledby="g${k}"><h2 id="g${k}">${name}</h2><div class="ogrid">${IDEAS.filter(I => I.g === k).map(I => `<a class="oc" href="#${I.n}"><span class="n">시안 ${I.n}</span><b>${esc(I.t)}</b><p>${esc(I.one)}</p><div class="row">${kindOf(I)}${I.save === 'local' ? '<span class="pill local">💾 저장</span>' : /모형/.test(I.tag) ? '<span class="pill mock">⚠ 모형</span>' : ''}</div></a>`).join('')}</div></section>`).join('');
}
function nav(n) {
  const p = BY[n - 1], q = BY[n + 1];
  return `<nav class="pn" aria-label="앞뒤 시안">${p ? `<a href="#${p.n}">← ${p.n}. ${esc(p.t)}</a>` : '<a href="#0">← 목록</a>'}<a class="c" href="#0">목록</a>${q ? `<a href="#${q.n}">${q.n}. ${esc(q.t)} →</a>` : '<a href="#0">목록으로 →</a>'}</nav>`;
}
function route() {
  const n = Math.max(0, Math.min(IDEAS.length, parseInt(location.hash.slice(1), 10) || 0));
  const sw = $('#fsw');
  sw.innerHTML = `<a href="#0"${n === 0 ? ' aria-current="page"' : ''}>목록</a>` + IDEAS.map(I => `<a href="#${I.n}"${I.n === n ? ' aria-current="page"' : ''} title="${esc(I.t)}" aria-label="시안 ${I.n}: ${esc(I.t)}">${I.n}</a>`).join('');
  const cur = $('[aria-current]', sw); if (cur) sw.scrollLeft = cur.offsetLeft - sw.offsetLeft - sw.clientWidth / 2 + cur.offsetWidth / 2;
  RES = null; hideTip(); if (DLG.open) DLG.close();
  const box = document.createElement('div');
  VIEW.replaceChildren(box);
  if (!n) { document.title = '피드백 시안 19개'; overview(box); }
  else {
    const I = BY[n]; document.title = `피드백 시안 ${n} · ${I.t}`;
    box.innerHTML = `<div class="lt"><span class="no">${GRP[I.g]} · 시안 ${n}</span><h1>${esc(I.t)}</h1><p class="q">${esc(I.d)}</p><div class="row xt">${kindOf(I)}${pillOf(I)}</div></div><div class="fbody"></div>` + nav(n);
    try { I.run($('.fbody', box)); } catch (e) { $('.fbody', box).innerHTML = `<p class="empty">이 시안을 그리다 멈췄습니다: ${esc(e.message)}</p>`; console.error(e); }
  }
  scrollTo(0, 0); VIEW.focus({ preventScroll: true });
}
let rt; addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(() => RES && RES(), 150); });
addEventListener('hashchange', route);
$('#foot').innerHTML = `기준 ${esc(D.meta.built)} KST · THESIS·주요 자리는 지금 사이트 데이터의 작은 사본입니다 · 대부분 저장하지 않는 시안이고, 💾 표시만 이 브라우저에 저장합니다 · 투자 조언이 아닙니다.`;
route();
