"""사안 원장 → 점수 → 배치(스냅샷) → 화면 데이터.

python3 build.py <채널 추출본 폴더> <채널 로그 jsonl> <가격 원자료 폴더> <출력 폴더>
입력은 공개 레포 밖(로컬)에 있고, 출력만 레포의 claude/data/에 쓴다.
"""
import json, math, os, re, sys, datetime as dt
from collections import defaultdict
sys.path.insert(0, os.path.dirname(__file__))
from issues import ISSUES, ASSET_ISSUE, VIEWS

MM, LOG, RAW, OUT = sys.argv[1:5]
HERE = os.path.dirname(__file__)
K = dt.timezone(dt.timedelta(hours=9)); U = dt.timezone.utc
T0H = dt.datetime(2026, 10, 17, tzinfo=K)   # calls2 'at'(시간) 기준
MAIN = '1560906410366074970'
J = lambda p: json.load(open(p, encoding='utf-8'))
X = J(os.path.join(MM, 'merged.json')); ADD = J(os.path.join(HERE, 'additions.json')); CUR = J(os.path.join(HERE, 'curated.json'))
for k in ('posts', 'levels', 'corrections', 'catalysts', 'disagreements'):
    X[k] = X[k] + ADD.get(k, [])
CALLS2 = {c['src'] + '|' + c['st'][:20]: c for c in J(os.path.join(MM, 'calls2.json'))}
I = {i['id']: i for i in ISSUES}
for i in ISSUES: i['_re'] = re.compile(i['kw'], re.I)
TAG = {t: i['id'] for i in ISSUES for t in i['tags'] + [i['id']]}

def kts(s):  # '2026-11-16 18:08' (KST) → datetime
    return dt.datetime.strptime(s[:16], '%Y-%m-%d %H:%M').replace(tzinfo=K)
POST = {p['src']: p for p in X['posts']}

def kw_issues(text):
    return [i['id'] for i in ISSUES if text and i['_re'].search(text)]

def link(text, asset=None, src=None):
    """항목 → 사안. 본문 낱말 먼저, 없으면 종목, 그래도 없으면 근거 글의 첫 태그."""
    got = kw_issues(text)
    if not got and asset in ASSET_ISSUE: got = [ASSET_ISSUE[asset]]
    if not got and src in POST:
        tags = [TAG[t] for t in POST[src].get('narratives') or [] if t in TAG]
        got = tags[:1]
    return sorted(set(got))

# ---- 항목 정리 (공개용 필드만) ----
items = defaultdict(list)
for p in X['posts']:
    iss = sorted({TAG[t] for t in p.get('narratives') or [] if t in TAG})
    items['timeline'].append(dict(src=p['src'], ts=p['ts'], who=p['author'], kind=p['kind'], title=p['title'], gist=p['gist'],
                                  assets=p.get('assets') or [], iss=iss, rel=[i for i in kw_issues(p['title'] + ' ' + p['gist']) if i in iss],
                                  g='주장' if p['kind'] == 'kol' else '관측·해석'))
for c in X['calls']:
    s2 = CALLS2.get(c['src'] + '|' + c['statement'][:20], {})
    items['ledger'].append(dict(src=c['src'], ts=c['ts'], who=c['author'], asset=c['asset'], st=c['statement'], exp=c.get('expected'),
                                hz=c.get('horizon'), cat=s2.get('cat'), res=s2.get('res'), kol=c.get('kol'),
                                trg=s2.get('trg'), dir=s2.get('dir'), tgt=s2.get('tgt'), daily=s2.get('daily'),
                                at=(T0H + dt.timedelta(hours=s2['at'])).strftime('%Y-%m-%d %H:%M') if s2.get('at') is not None else None,
                                iss=link(c['statement'] + ' ' + (c.get('expected') or ''), c['asset'], c['src']), g='주장' if c.get('kol') else '해석'))
for l in X['levels']:
    items['ladder'].append(dict(src=l['src'], ts=l['ts'], who=l['author'], asset=l['asset'], price=l['price'], label=l['label'], kind=l['kind'],
                                iss=link(l['label'], l['asset'], l['src']) if l['asset'] != 'BTC' else sorted(set(['btc_floor'] + kw_issues(l['label']))), g='관측'))
for c in X['corrections']:
    items['radar'].append(dict(type='정정', src=c['src'], ts=c['ts'], who=c['by'], tgt=c['target'], a=c['wrong'], b=c['right'], why=c.get('cause'),
                               iss=link(c['wrong'] + ' ' + c['right'], None, c['src']), g='관측'))
for d in X['disagreements']:
    items['radar'].append(dict(type='이견', src=d['src'], ts=d['ts'], topic=d['topic'], a=d['claude'], b=d['gpt'], why=d.get('resolution'),
                               iss=link(d['topic'] + ' ' + d['claude'] + ' ' + d['gpt'], None, d['src']), g='해석'))
for c in X['catalysts']:
    ts = POST[c['src']]['ts'] if c['src'] in POST else None
    items['catalysts'].append(dict(src=c['src'], ts=ts, date=c['event_date'], time=c.get('time_kst'), ev=c['event'], exp=c.get('expectation'),
                                   out=c.get('outcome'), iss=link(c['event'] + ' ' + (c.get('expectation') or ''), None, c['src']), g='보도'))
for c in X['contagion']:
    ts = POST[c['src']]['ts'] if c['src'] in POST else None
    items['contagion'].append(dict(src=c['src'], ts=ts, a=c['from'], b=c['to'], how=c['mechanism'], st=c['status'],
                                   iss=link(c['from'] + ' ' + c['to'] + ' ' + c['mechanism'], None, c['src']), g='해석' if c['status'] != '관측' else '관측'))
for v in items.values():
    v.sort(key=lambda r: (r.get('ts') or r.get('date') or ''))

# ---- 사용자 질문 (본채널, 사용자 글만. 내용은 공개하지 않고 사안별 횟수만 쓴다) ----
questions = []
GENERIC = re.compile(r'팔로업|리서치|조사|브리핑|촉매|상황')
META = re.compile(r'\.env|흉내|질문지|핀 고정|데스크톱|스레드|채팅방')  # 방 운영 이야기는 시장 질문으로 세지 않는다
for ln in open(LOG, encoding='utf-8'):
    m = json.loads(ln)
    if m['chat'] != MAIN or m['author'] != 'tlzkrh1029' or not m['text']: continue
    if META.search(m['text']): continue
    t = dt.datetime.fromisoformat(m['ts'].replace('Z', '+00:00')).astimezone(K)
    hit = kw_issues(m['text'])
    if hit: questions.append((t, hit, 1.0))
    elif GENERIC.search(m['text']):
        # 종목·주제 없이 "팔로업 해줘"만 한 요청은, 그 요청으로 나온 리서치(60분 안)의 사안에 절반 무게로 나눠 준다
        got = set()
        for p in X['posts']:
            pt = kts(p['ts'])
            if t <= pt <= t + dt.timedelta(minutes=60) and p['kind'] in ('research', 'followup', 'brief'):
                got |= {TAG[x] for x in p.get('narratives') or [] if x in TAG}
        if got: questions.append((t, sorted(got), 0.5))

# ---- 가격 (일봉 종가, UTC 날짜) ----
def daily(fname):
    p = os.path.join(RAW, fname)
    if not os.path.exists(p): return {}
    return {dt.datetime.fromtimestamp(r[0] / 1000, U).date(): float(r[4]) for r in J(p)}
PX = {a: daily(f'd_{a}USDT.json') for a in ['BTC', 'ETH', 'SOL', 'BNB', 'ZEC', 'ENA', 'PEPE', 'UNI', 'STX', 'HYPE', 'SPX', 'MAGIC', 'NIGHT', 'ADA', 'GRASS', 'JUP', 'GMX']}
kx = J(os.path.join(RAW, 'k_xmr.json'))['result']; kx = next(v for k, v in kx.items() if k != 'last')
PX['XMR'] = {dt.datetime.fromtimestamp(r[0], U).date(): float(r[4]) for r in kx}

def move3(asset, day):  # 그날 아침(09시 KST)까지 닫힌 일봉 기준 3일 등락
    s = PX.get(asset) or {}
    d1 = day - dt.timedelta(days=1); d4 = day - dt.timedelta(days=4)
    if d1 in s and d4 in s: return s[d1] / s[d4] - 1
    return None

# ---- 점수 ----
KINDW = dict(research=1.0, followup=1.0, brief=0.8, answer=0.6, correction=0.8, review=0.6, kol=0.5)
NOWK = dt.datetime.now(K)
def day_end(day):  # 오늘 판은 지금 시각까지만 본다
    return min(dt.datetime.combine(day, dt.time(23, 59), K), NOWK)
def score_day(day):
    end = day_end(day)
    S = {i['id']: dict(M=0.0, Mk=0.0, Q=0.0, Qn=0, P=0.0, O=0.0, ev=0) for i in ISSUES}
    for p in X['posts']:
        t = kts(p['ts'])
        if t > end: continue
        age = (end - t).total_seconds() / 86400
        iss = {TAG[x] for x in p.get('narratives') or [] if x in TAG}
        if not iss: continue
        w = KINDW.get(p['kind'], 0.6) * math.exp(-age / 3) / math.sqrt(len(iss))
        for i in iss:
            S[i]['Mk' if p['kind'] == 'kol' else 'M'] += w
            if age <= 7: S[i]['ev'] += 1
    for kind, w0 in (('ladder', 0.15), ('ledger', 0.2)):
        for r in items[kind]:
            t = kts(r['ts'])
            if t > end: continue
            for i in r['iss']:
                S[i]['Mk' if r.get('g') == '주장' else 'M'] += w0 * math.exp(-(end - t).total_seconds() / 86400 / 3) / math.sqrt(len(r['iss']))
    for x in X['x_narratives']:
        t = dt.datetime.fromisoformat(x['date']).replace(hour=12, tzinfo=K)
        if t > end or x['narrative'] not in TAG: continue
        S[TAG[x['narrative']]]['Mk'] += 0.5 * math.exp(-(end - t).total_seconds() / 86400 / 3)
    for t, hit, qw in questions:
        if t > end: continue
        age = (end - t).total_seconds() / 86400
        for i in hit:
            S[i]['Q'] += qw * math.exp(-age / 3) / math.sqrt(len(hit))
            if age <= 7 and qw == 1.0: S[i]['Qn'] += 1
    for i in ISSUES:
        mv = [abs(m) for m in (move3(a, day) for a in i['assets']) if m is not None]
        S[i['id']]['P'] = min(max(mv) / 0.08, 1.5) * i['pw'] if mv else 0.0
    lo, hi = end - dt.timedelta(days=7), end
    for r in items['radar']:
        t = kts(r['ts'])
        if lo < t <= hi:
            for i in r['iss']: S[i]['O'] += 1.0
    for c in items['catalysts']:
        if not c['ts'] or kts(c['ts']) > end or not c['date']: continue
        ed = dt.date.fromisoformat(c['date'])
        if day <= ed <= day + dt.timedelta(days=7):
            for i in c['iss']: S[i]['O'] += 1.5 if ed <= day + dt.timedelta(days=2) else 0.7  # 이틀 안 일정은 더 무겁게
    out = {}
    for k, v in S.items():
        v['O'] = min(v['O'], 3.0)
        m = v['M'] + v['Mk']
        kol_share = v['Mk'] / m if m else 0
        alive = min(1.0, m + v['Q'])
        P = 1.5 * v['P'] * alive; Q = 2.5 * v['Q']; O = 0.5 * v['O'] * alive
        total = m + Q + P + O
        out[k] = dict(s=round(total, 3), m=round(m, 3), q=round(Q, 3), p=round(P, 3), o=round(O, 3),
                      kol=round(kol_share, 2), qn=v['Qn'], ev=v['ev'])
    return out

# ---- 배치: 고정 자리(THESIS) + 주요 자리 6 + 관찰. 흔들림 방지 규칙 ----
KMAJ = 6
PINS = J(os.path.join(HERE, 'pins.json'))  # 사용자 한 표: pin은 늘 주요 자리, down은 주요 자리에서 뺀다
first_post = min(kts(p['ts']).date() for p in X['posts'])
last_day = dt.datetime.now(K).date()
days = [first_post + dt.timedelta(days=n) for n in range((last_day - first_post).days + 1)]
major, instreak, outstreak, prev_status, first_seen = [], defaultdict(int), defaultdict(int), {}, {}
hist = {}
snap = []
for day in days:
    sc = score_day(day); hist[day] = sc
    var = [i['id'] for i in ISSUES if not i.get('fixed')]
    for i in var:
        if i not in first_seen and (sc[i]['m'] > 0.05 or sc[i]['q'] > 0): first_seen[i] = day
    raw = sorted([i for i in var if i in first_seen], key=lambda i: -sc[i]['s'])
    rank = {i: n for n, i in enumerate(raw)}
    kth = sc[raw[KMAJ - 1]]['s'] if len(raw) >= KMAJ else 0
    changes = []
    for i in raw:
        if rank[i] < KMAJ: instreak[i] += 1; outstreak[i] = 0
        else: outstreak[i] += 1; instreak[i] = 0
    if not major:
        major = raw[:KMAJ]
        changes += [dict(t='시작', i=i, why='첫 배치') for i in major]
    else:
        for i in list(major):
            if outstreak[i] >= 2:
                major.remove(i); changes.append(dict(t='내려감', i=i, why='이틀 연속 6위 밖'))
        for i in raw:
            if i in major: continue
            surge = kth and sc[i]['s'] >= 1.5 * kth
            if instreak[i] >= 2 or surge:
                major.append(i)
                why = '급부상: 점수가 6위의 1.5배 이상' if surge and instreak[i] < 2 else '이틀 연속 6위 안'
                changes.append(dict(t='올라옴', i=i, why=why))
        while len(major) > KMAJ:
            low = min(major, key=lambda i: sc[i]['s'])
            major.remove(low); changes.append(dict(t='내려감', i=low, why='자리 부족, 새 사안에 밀림'))
        for i in raw:
            if len(major) >= KMAJ: break
            if i not in major: major.append(i); changes.append(dict(t='올라옴', i=i, why='빈자리 채움'))
    for i in PINS.get('pin', []):
        if i not in major and i in sc: major.append(i); changes.append(dict(t='올라옴', i=i, why='사용자 고정(📌)'))
    for i in PINS.get('down', []):
        if i in major: major.remove(i); changes.append(dict(t='내려감', i=i, why='사용자가 내림'))
    order = sorted(major, key=lambda i: (i not in PINS.get('pin', []), -sc[i]['s']))
    # 증거 안전장치: 주장(KOL) 위주 사안은 1위에 두지 않는다
    if order and sc[order[0]]['kol'] > 0.5 and len(order) > 1:
        order[0], order[1] = order[1], order[0]
        changes.append(dict(t='보류', i=order[1], why='근거가 주장(KOL) 위주라 1위 보류'))
    rest = [i for i in raw if i not in major]
    # 상태
    status = {}
    # 상태는 전체 점수 중 몫으로 본다(조용한 날 모두가 같이 식는 것은 변화로 치지 않는다)
    d3 = hist.get(day - dt.timedelta(days=3))
    tot = sum(sc[i]['s'] for i in raw) or 1
    tot3 = sum(d3[i]['s'] for i in raw if i in d3) if d3 else 0
    for i in raw:
        s = sc[i]['s']; sh = s / tot; sh3 = (d3[i]['s'] / tot3) if d3 and tot3 else 0
        if i in major: st = '활성'
        elif (day - first_seen[i]).days <= 3 or (sh3 and sh >= 1.5 * sh3 and s > 0.8): st = '떠오름'
        elif sh3 and sh <= 0.6 * sh3: st = '식는 중'
        elif s < 0.3: st = '휴면'
        else: st = '관찰'
        status[i] = st
        if i in prev_status and prev_status[i] != st and st in ('떠오름', '식는 중', '휴면') and not any(c['i'] == i for c in changes):
            changes.append(dict(t='상태', i=i, why=f'{prev_status[i]} → {st}'))
    prev_status = status
    for i in [x['id'] for x in ISSUES if x.get('fixed')]: status[i] = '고정'
    # 고정 자리 제안: 최근 7일 같은 사안 질문 3번 이상
    suggest = [i for i in raw if sc[i]['qn'] >= 3 and i not in [x['id'] for x in ISSUES if x.get('fixed')]]
    # 화면 순서: 주요 사안의 무게 × 최근 7일 항목 수(화면별 평균으로 나눔)
    end = day_end(day); lo = end - dt.timedelta(days=7)
    wsum = sum(sc[i]['s'] for i in order) or 1
    vs = {}
    for v in VIEWS:
        rows = [r for r in items[v['id']] if r.get('ts') and lo < kts(r['ts']) <= end]
        allrows = [r for r in items[v['id']] if r.get('ts') and kts(r['ts']) <= end]
        base = max(len(allrows) / max((day - first_post).days + 1, 1) * 7, 1)
        vs[v['id']] = round(sum(sc[i]['s'] / wsum * sum(1 for r in rows if i in r['iss']) for i in order + ['thesis']) / base, 3)
    views = ['timeline'] + sorted([v for v in vs if v != 'timeline'], key=lambda v: -vs[v])  # 타임라인은 기본 화면이라 맨 앞 고정
    hl = [p for p in X['posts'] if kts(p['ts']) <= end and p['kind'] in ('research', 'followup', 'brief')]
    snap.append(dict(d=day.isoformat(), hl=hl[-1]['src'] if hl else None, sc=sc, major=order, rest=rest, status=status, views=views, vs=vs, ch=changes, suggest=suggest))

# ---- THESIS 계기판 (가격 원자료로 다시 계산) ----
def kl(f): return J(os.path.join(RAW, f))
dd = {r[0]: r for r in kl('btc1d_a.json') + kl('btc1d_b.json')}; D = [dd[k] for k in sorted(dd)]
cl = [float(r[4]) for r in D]; ds = [dt.datetime.fromtimestamp(r[0] / 1000, U).date() for r in D]
th_daily = []
for n in range(len(D) - 15, len(D) - 1):  # 닫힌 일봉만
    s = sum(cl[n - 1459:n + 1]) / 1460
    th_daily.append(dict(bar=ds[n].isoformat(), close=cl[n], line=round(s), pct=round((cl[n] / s - 1) * 100, 2)))
w = kl('btc1w.json'); wc = [float(r[4]) for r in w]; wd = [dt.datetime.fromtimestamp(r[0] / 1000, U).date() for r in w]
th_weekly = [dict(bar=wd[j].isoformat(), close=wc[j], line=round(sum(wc[j - 207:j + 1]) / 208), pct=round((wc[j] / (sum(wc[j - 207:j + 1]) / 208) - 1) * 100, 2))
             for j in range(len(wc) - 7, len(wc) - 1)]
m = kl('btc1M.json'); mc = [float(r[4]) for r in m]
em = [float(r[4]) for r in kl('eth1M.json')]
ed = kl('d_ETHUSDT.json'); eth_last = [(dt.datetime.fromtimestamp(r[0] / 1000, U).date().isoformat(), float(r[4])) for r in ed[:-1]][-1]
eth9 = round(sum(em[-108:]) / 108)
alts = []
for s, name in [('UNIUSDT', 'UNI'), ('1000PEPEUSDT', 'PEPE'), ('STXUSDT', 'STX'), ('PUMPUSDT', 'PUMP'), ('RUNEUSDT', 'RUNE'), ('GRASSUSDT', 'GRASS'), ('USELESSUSDT', 'USELESS')]:
    y = kl('y_' + s + '.json'); c = [float(r[4]) for r in y]; yd = [dt.datetime.fromtimestamp(r[0] / 1000, U).date() for r in y]
    rows = []
    for n in range(len(c) - 6, len(c) - 1):
        sm = sum(c[n - 364:n + 1]) / 365; rows.append(dict(bar=yd[n].isoformat(), pct=round((c[n] / sm - 1) * 100, 1)))
    alts.append(dict(sym=name, rows=rows))
built = dt.datetime.now(K)
thesis = dict(daily=th_daily, weekly=th_weekly, m48_live=round(sum(mc[-48:]) / 48), btc_live=mc[-1],
              eth=dict(bar=eth_last[0], close=eth_last[1], line=eth9, pct=round((eth_last[1] / eth9 - 1) * 100, 2)),
              alts=alts, asof=built.strftime('%Y-%m-%d %H:%M'), src='바이낸스 일·주·월봉(현물, 알트는 선물) · 사이트 갱신 때 Claude 계산')


# ---- 주목 3선 (사용자 지정 11/21): BTCUSD 3일봉 사선 지지 · ETHUSD 10일봉 365SMA · USDT.D(손 문장) ----
def fday(fname):
    return {dt.datetime.fromtimestamp(r[0], U).date(): tuple(r[1:5]) for r in kl(fname)}
def nbar(d, n):  # TradingView nD: 해마다 1월 1일부터 다시 센다
    out = {}
    for day in sorted(d):
        k = (day.year, (day.timetuple().tm_yday - 1) // n); o, h, l, c = d[day]
        if k not in out: out[k] = [day, o, h, l, c, 1]
        else: x = out[k]; x[2] = max(x[2], h); x[3] = min(x[3], l); x[4] = c; x[5] += 1
    return [out[k] for k in sorted(out)]
def bar_close(day, n):  # 이 봉이 닫히는 시각(KST)
    y0 = dt.date(day.year, 1, 1); k = (day - y0).days // n
    end = min(y0 + dt.timedelta(days=(k + 1) * n), dt.date(day.year + 1, 1, 1))
    return end.isoformat() + ' 09:00'
def tests(rows, gap):  # 선에 3% 안으로 다가간 저점을 무리별로 하나씩
    out, cur = [], None
    for i, r in enumerate(rows):
        if r['dl'] < 3:
            if cur and i - cur['i'] <= gap:
                if r['dl'] < cur['dl']: cur.update(r, i=i)
                else: cur['i'] = i
            else:
                cur = dict(r, i=i); out.append(cur)
    return [dict(d=x['d'], low=x['low'], dl=x['dl'], dc=x['dc']) for x in out]
def diag(fname, a, b):
    bars = nbar(fday(fname), 3); ix = {x[0]: i for i, x in enumerate(bars)}
    ia, ib = ix[a], ix[b]; ha, hb = bars[ia][2], bars[ib][2]
    sl = (math.log(hb) - math.log(ha)) / (ib - ia); sn = (hb - ha) / (ib - ia)
    return bars, ia, ib, ha, hb, (lambda i: math.exp(math.log(ha) + sl * (i - ia))), (lambda i: ha + sn * (i - ia))
A_, B_ = dt.date(2024, 3, 13), dt.date(2024, 6, 5)
bars, ia, ib, ha, hb, lg, ln = diag('f_cb_btc.json', A_, B_)
rows = [dict(d=x[0].isoformat(), close=x[4], low=x[3], line=round(lg(i), 1), dl=round((x[3] / lg(i) - 1) * 100, 2), dc=round((x[4] / lg(i) - 1) * 100, 2)) for i, x in enumerate(bars)]
cur = bars[-1]; alt = diag('f_bs_btc.json', A_, B_)
f_btc = dict(sym='BTCUSD', tf='3일봉', kind='support', src='코인베이스 BTC-USD 일봉을 3일봉으로 묶음(1월 1일 기준)',
             a=dict(d=A_.isoformat(), h=ha), b=dict(d=B_.isoformat(), h=hb), scale='로그',
             line=round(lg(len(bars) - 1)), line_lin=round(ln(len(bars) - 1)), line_alt=dict(name='비트스탬프', v=round(alt[5](len(alt[0]) - 1))),
             step=round((lg(len(bars)) / lg(len(bars) - 1) - 1) * 100, 3),
             bar=cur[0].isoformat(), closes_at=bar_close(cur[0], 3), days=cur[5], price=cur[4], low=cur[3],
             pct=rows[-1]['dc'], pct_low=rows[-1]['dl'], prev=dict(d=rows[-2]['d'], close=rows[-2]['close'], pct=rows[-2]['dc']),
             tests=[x for x in tests(rows[ib + 1:-1], 4) if x['d'] >= '2024-12-01'],  # 진행 중 봉은 뺀다
             series=[[r['d'], r['close'], r['low'], r['line']] for r in rows if r['d'] >= '2024-01-01'])
def sma10(fname):
    bars = nbar(fday(fname), 10); c = [x[4] for x in bars]
    return bars, [sum(c[i - 364:i + 1]) / 365 if i >= 364 else None for i in range(len(c))]
eb, es = sma10('f_cb_eth.json'); ab_, as_ = sma10('f_bf_eth.json')
erows = [dict(d=x[0].isoformat(), close=x[4], low=x[3], line=round(es[i], 1), dl=round((x[3] / es[i] - 1) * 100, 2), dc=round((x[4] / es[i] - 1) * 100, 2)) for i, x in enumerate(eb) if es[i]]
ec = eb[-1]
f_eth = dict(sym='ETHUSD', tf='10일봉', kind='support', src='코인베이스 ETH-USD 일봉을 10일봉으로 묶음(1월 1일 기준), 종가 365개 평균',
             line=round(es[-1], 1), line_alt=dict(name='비트파이넥스', v=round(as_[-1], 1)), step=round(es[-1] - es[-2], 1),
             bar=ec[0].isoformat(), closes_at=bar_close(ec[0], 10), days=ec[5], price=ec[4], low=ec[3],
             pct=erows[-1]['dc'], pct_low=erows[-1]['dl'], prev=dict(d=erows[-2]['d'], close=erows[-2]['close'], pct=erows[-2]['dc']),
             below_closes=sum(1 for r in erows[:-1] if r['dc'] < 0), first=erows[0]['d'],
             tests=tests(erows[:-1], 1), series=[[r['d'], r['close'], r['low'], r['line']] for r in erows])
focus = dict(asof=built.strftime('%Y-%m-%d %H:%M'), btc=f_btc, eth=f_eth)

meta = dict(built=built.strftime('%Y-%m-%d %H:%M'), first=days[0].isoformat(), last=days[-1].isoformat(), kmaj=KMAJ,
            issues=[dict(id=i['id'], label=i['label'], kind=i['kind'], fixed=bool(i.get('fixed')), assets=i['assets']) for i in ISSUES],
            views=VIEWS, weights=dict(m='최근 언급: 리서치 글·레벨·판정, 하루마다 약 28% 감소', q='사용자 질문 ×2.5(같은 감소), 주제 없는 요청은 그 요청으로 나온 리서치 사안에 절반', p='가격 영향 ×1.5: 관련 종목 3일 등락 8%=1, 논의 중인 사안에만', o='정정·이견(7일)·7일 안 일정 ×0.5'),
            counts={k: len(v) for k, v in items.items()}, questions=len(questions))
os.makedirs(OUT, exist_ok=True)
def dump(name, obj):
    with open(os.path.join(OUT, name), 'w', encoding='utf-8') as f: json.dump(obj, f, ensure_ascii=False, separators=(',', ':'))
dump('meta.json', meta)
dump('snapshots.json', snap)
dump('items.json', items)
# THESIS 시뮬레이터용 이력: 주봉 종가와 208주선, 월봉 종가와 48개월선 (바이낸스 현물)
def sma_hist(fname, n, keep):
    rows = J(os.path.join(RAW, fname)); c = [float(r[4]) for r in rows]
    out = []
    for i in range(len(rows)):
        if i + 1 >= n: out.append([dt.datetime.fromtimestamp(rows[i][0] / 1000, U).date().isoformat(), round(c[i], 2), round(sum(c[i + 1 - n:i + 1]) / n, 1)])
    return out[-keep:]
thesis_hist = dict(w208=sma_hist('btc1w.json', 208, 330), m48=sma_hist('btc1M.json', 48, 80))
dump('now.json', dict(curated=CUR, thesis=thesis, thesis_hist=thesis_hist, focus=focus))

# 4시간봉 (화면 시안용, 공개 API 원자료를 종가·고가·저가로 줄여서)
PX4 = {'BTC': 'BTCUSDT', 'ETH': 'ETHUSDT', 'SOL': 'SOLUSDT', 'BNB': 'BNBUSDT', 'ZEC': 'ZECUSDT', 'ENA': 'ENAUSDT', 'UNI': 'UNIUSDT', 'MAGIC': 'MAGICUSDT',
       'HYPE': 'HYPEUSDT', 'SPX': 'SPXUSDT', 'PEPE': '1000PEPEUSDT', 'XMR': 'XMR_kraken',
       'NIGHT': 'NIGHTUSDT', 'ADA': 'ADAUSDT', 'JUP': 'JUPUSDT', 'GMX': 'GMXUSDT', 'GRASS': 'GRASSUSDT'}
px = {}
for a, f in PX4.items():
    p4 = os.path.join(RAW, 'h4_%s.json' % f)
    if not os.path.exists(p4): continue
    rows = J(p4)
    if isinstance(rows, dict): rows = rows['result']['XXMRZUSD']; rows = [[r[0] * 1000] + r[1:5] for r in rows]
    sc = 1e-3 if a == 'PEPE' else 1
    sig = lambda v: float('%.6g' % (float(v) * sc))
    px[a] = dict(t0=int(rows[0][0] // 1000), s=14400, o=[sig(r[1]) for r in rows], h=[sig(r[2]) for r in rows],
                 l=[sig(r[3]) for r in rows], c=[sig(r[4]) for r in rows])
dump('px.json', px)

# KOL 수집 결과 (채널 리서치가 인용한 X 글: 우리말 요지 + 원문 링크. 전문은 싣지 않는다)
KD = os.path.join(os.path.dirname(os.path.abspath(RAW)), 'kol')
if os.path.exists(os.path.join(KD, 'kol_items.json')):
    KEEP = ('id', 'src', 'src_ts', 'reporter', 'handle', 'name', 'url', 'post_ts', 'assets', 'topic', 'stance', 'claim', 'levels', 'likes', 'iss')
    ki = [{k: r.get(k) for k in KEEP} for r in J(os.path.join(KD, 'kol_items.json'))]
    kp = J(os.path.join(KD, 'kol_profiles.json')) if os.path.exists(os.path.join(KD, 'kol_profiles.json')) else []
    kc = J(os.path.join(KD, 'coverage.json')) if os.path.exists(os.path.join(KD, 'coverage.json')) else []
    d0 = min((r['src_ts'] or '9')[:10] for r in ki) if ki else '2026-10-17'
    btc = [[d.isoformat(), PX['BTC'][d]] for d in sorted(PX['BTC']) if d.isoformat() >= d0]
    dump('kol.json', dict(items=ki, profiles=kp, coverage=kc, btc=btc))
for f in sorted(os.listdir(OUT)): print(f, os.path.getsize(os.path.join(OUT, f)))
s = snap[-1]
print(s['d'], 'major', s['major'], '\nrest', s['rest'][:8], '\nviews', s['views'], '\nsuggest', s['suggest'])
for i in s['major'] + s['rest'][:5]: print(' ', i, s['sc'][i], s['status'][i])
