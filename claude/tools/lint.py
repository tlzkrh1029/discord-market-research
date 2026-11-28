"""손으로 쓴 문장(curated.json)과 덧붙인 기록(additions.json)을 점검한다.

python3 claude/tools/lint.py            사람이 읽는 보고
python3 claude/tools/lint.py --json     기계가 읽는 보고(JSON)
python3 claude/tools/lint.py --now '2026-11-28 18:00'   기준 시각을 바꿔서 점검

레포 안의 파일만 읽으므로 어디서나 돌릴 수 있다. build.py가 끝에서 자동으로 부르고,
여기서 오류가 나도 빌드 결과에는 영향을 주지 않는다.
'오래된 문장' 기준은 화면(app.js의 STALE)과 같은 값을 쓴다. 손 문장을 쓴 시각은
근거 Discord 메시지 ID(스노플레이크)에서 꺼낸다.

보고 등급
  오류: 화면에 빈 줄이 생기거나 깨지는 형식 문제. 바로 고친다.
  주의: 맨 위 고정 칸의 문장이 낡았다. 이번 리서치에 맞춰 다시 쓰거나, 그대로 둘 이유를 확인한다.
  참고: 정리하면 좋은 것(새 사안 후보, 너무 길어진 해석, 결과가 비어 있는 지난 일정).
"""
import json, os, re, sys, datetime as dt
from collections import Counter

K = dt.timezone(dt.timedelta(hours=9))
STALE_H = dict(now=24, focus=72, issue=72, thesis=168)   # app.js의 STALE과 같은 값(시간)
OPEN = ('대기', '진행 중', '미확인', '반쯤')                # 아직 결론이 나지 않은 조건 상태
COND_STALE_DAYS = 5      # 결론이 안 난 조건에 적힌 날짜가 모두 이보다 오래됐으면 알린다
VIEW_MAX = 1200          # 사안 해석이 이 글자 수를 넘으면 정리를 권한다
NEW_ISSUE_MIN = 4        # 48시간 안에 이만큼 글에 나온 종목인데 사안이 없으면 새 사안 후보로 알린다
DATE = re.compile(r'(?<![\d/.])(1[0-2]|0?[1-9])/(3[01]|[12]\d|0?[1-9])(?![\d/])(?:\s+(\d{1,2}):(\d{2}))?')
ISO = re.compile(r'(20\d\d)-(\d{2})-(\d{2})')


def snow(i):
    """Discord 메시지 ID → 올라온 시각(KST)."""
    try:
        return dt.datetime.fromtimestamp(((int(i) >> 22) + 1420070400000) / 1000, K)
    except Exception:
        return None


def src_time(src):
    ts = [t for t in (snow(i) for i in (src or [])) if t]
    return max(ts) if ts else None


def ago(now, t):
    h = (now - t).total_seconds() / 3600
    return f'{h:.0f}시간 전' if h < 36 else f'{h / 24:.0f}일 전'


def dates_in(text, now):
    """문장에 적힌 '월/일(시:분)'을 기준 시각에서 가장 가까운 해로 읽는다."""
    out = []
    for m in ISO.finditer(text or ''):   # '판정 2027-02-19'처럼 해까지 적은 날짜
        try:
            out.append(dt.datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), 23, 59, tzinfo=K))
        except ValueError:
            pass
    for m in DATE.finditer(text or ''):
        mo, da = int(m.group(1)), int(m.group(2))
        hh, mi = (min(int(m.group(3)), 23), int(m.group(4))) if m.group(3) else (23, 59)
        best = None
        for y in (now.year - 1, now.year, now.year + 1):
            try:
                d = dt.datetime(y, mo, da, hh, mi, tzinfo=K)
            except ValueError:
                continue
            if best is None or abs((d - now).total_seconds()) < abs((best - now).total_seconds()):
                best = d
        if best:
            out.append(best)
    return out


def check(tools_dir, data_dir=None, now=None):
    now = now or dt.datetime.now(K)
    J = lambda p: json.load(open(p, encoding='utf-8'))
    C = J(os.path.join(tools_dir, 'curated.json'))
    out = []
    add = lambda level, where, msg: out.append(dict(level=level, where=where, msg=msg))

    # 1. 맨 위 고정 칸의 손 문장이 언제 쓰였나
    for key, label in (('now', "'지금' 문장은"), ('focus', '주목 3선 손 메모는'), ('thesis', 'THESIS 조건 문장은')):
        blk = C.get(key) or {}
        t = src_time(blk.get('src'))
        if t is None:
            add('주의', key, f'{label} 근거 메시지 ID(src)가 없어 쓴 시각을 알 수 없습니다.')
        elif (now - t).total_seconds() > STALE_H[key] * 3600:
            add('주의', key, f'{label} {t:%m/%d %H:%M}에 쓴 그대로입니다({ago(now, t)}, 기준 {STALE_H[key]}시간). 화면에 "오래된 문장"으로 표시됩니다.')
    nb = C.get('now') or {}
    for f in ('headline', 'points', 'unverified'):
        if not nb.get(f):
            add('오류', 'now', f"'지금' 문장에 {f}가 비어 있습니다.")
    if len(nb.get('headline') or '') > 110:
        add('참고', 'now', f"'지금' 머리 문장이 {len(nb['headline'])}자입니다. 110자를 넘으면 화면에서 작은 글씨로 내려갑니다. 한 문장으로 줄이고 숫자는 아래 항목으로 옮기는 것을 권합니다.")

    # 2. 조건 형식: {t, s, n} 꼴이어야 한다. 글자만 적으면 화면이 상태를 알 수 없다
    major = []
    if data_dir and os.path.exists(os.path.join(data_dir, 'snapshots.json')):
        major = J(os.path.join(data_dir, 'snapshots.json'))[-1].get('major', [])
    blocks = [('thesis', C.get('thesis') or {})] + [('issues.' + k, v) for k, v in (C.get('issues') or {}).items()]
    for where, blk in blocks:
        bad = [c for c in blk.get('cond') or [] if not isinstance(c, dict) or not (c.get('t') or '').strip() or not (c.get('s') or '').strip()]
        if bad:
            first = bad[0] if isinstance(bad[0], str) else json.dumps(bad[0], ensure_ascii=False)
            add('오류', where, f'조건 {len(bad)}개가 {{"t": 조건, "s": 상태, "n": 메모}} 꼴이 아닙니다(화면에서는 "대기"로 대신 보입니다). 예: {first[:60]}')
        if where != 'thesis' and where[7:] not in major:
            continue   # 날짜 점검은 화면에 조건이 보이는 칸(THESIS와 주요 자리)만 한다
        for c in blk.get('cond') or []:
            if not isinstance(c, dict) or c.get('s') not in OPEN:
                continue
            ds = dates_in((c.get('t') or '') + ' ' + (c.get('n') or ''), now)
            if ds and max(ds) < now - dt.timedelta(days=COND_STALE_DAYS):
                # 적힌 날짜만 보고 짐작하는 것이라 틀릴 수 있다. THESIS는 주의, 사안 카드는 참고로 알린다
                add('주의' if where == 'thesis' else '참고', where,
                    f'"{c.get("s")}" 조건에 적힌 날짜가 모두 지났습니다(가장 늦은 날짜 {max(ds):%m/%d}, {ago(now, max(ds))}). 결과를 적거나 메모를 새로 확인해 주세요: {(c.get("t") or "")[:50]}')

    # 3. 사안 해석: 주요 자리에 올라 있는데 낡았거나, 너무 길어졌거나
    for k, v in (C.get('issues') or {}).items():
        t = src_time(v.get('src'))
        if k in major and t and (now - t).total_seconds() > STALE_H['issue'] * 3600:
            add('주의', 'issues.' + k, f'주요 자리 사안의 해석이 {t:%m/%d %H:%M}에 쓴 그대로입니다({ago(now, t)}).')
        if k in major and not v.get('src'):
            add('주의', 'issues.' + k, '주요 자리 사안의 해석에 근거 메시지 ID(src)가 없습니다.')
        view = v.get('view') or ''
        n = len([x for x in view.split(' / ') if x.strip()])
        if len(view) > VIEW_MAX:
            add('참고', 'issues.' + k, f'해석이 {len(view):,}자, {n}항목입니다. 화면은 앞의 2항목만 펼치고 나머지는 접습니다. 오래된 항목은 덜어내도 글 자체는 타임라인에 남습니다.')

    # 4. 덧붙인 기록: 시각 오류, 사안이 없는 종목, 결과가 비어 있는 지난 일정
    ap = os.path.join(tools_dir, 'additions.json')
    if os.path.exists(ap):
        A = J(ap)
        posts = A.get('posts') or []
        kts = lambda s: dt.datetime.strptime(s[:16], '%Y-%m-%d %H:%M').replace(tzinfo=K)
        fut = [p for p in posts if kts(p['ts']) > now + dt.timedelta(minutes=10)]
        if fut:
            add('오류', 'additions.posts', f'시각이 미래인 글 {len(fut)}개: {fut[0]["ts"]} {fut[0]["title"][:40]}')
        try:
            sys.path.insert(0, tools_dir)
            from issues import ISSUES, ASSET_ISSUE
            rx = [re.compile(i['kw'], re.I) for i in ISSUES]
            owned = set(ASSET_ISSUE) | {a for i in ISSUES for a in i['assets']}
            covered = lambda a: a in owned or any(r.search(a) for r in rx)
            cnt = Counter(a for p in posts if now - kts(p['ts']) < dt.timedelta(hours=48) for a in set(p.get('assets') or []))
            for a, n in cnt.most_common():
                if n >= NEW_ISSUE_MIN and not covered(a):
                    add('참고', 'issues.py', f'{a}: 최근 48시간 글 {n}개에 나오지만 이 종목을 가진 사안이 없습니다. 새 사안 후보입니다(지금은 다른 사안에 나뉘어 붙어 있습니다).')
        except Exception as e:  # issues.py를 못 읽어도 나머지 점검은 계속한다
            add('참고', 'issues.py', f'사안 정의를 읽지 못해 새 사안 후보 점검을 건너뜁니다: {e}')
        late = [c for c in A.get('catalysts') or [] if c.get('event_date') and not c.get('outcome')
                and dt.date.fromisoformat(c['event_date']) < now.date() - dt.timedelta(days=1)]
        if late:
            add('참고', 'additions.catalysts', f'날짜가 지난 일정 {len(late)}개에 결과(outcome)가 비어 있습니다. 가장 오래된 것: {min(c["event_date"] for c in late)} {min(late, key=lambda c: c["event_date"])["event"][:40]}')
    return out


def report(tools_dir, data_dir=None, now=None):
    """build.py가 부르는 입구. 사람이 읽는 보고를 찍고 결과 목록을 돌려준다."""
    res = check(tools_dir, data_dir, now)
    n = Counter(r['level'] for r in res)
    print(f"\n손 문장 점검: 오류 {n['오류']} · 주의 {n['주의']} · 참고 {n['참고']}")
    for lv in ('오류', '주의', '참고'):
        for r in res:
            if r['level'] == lv:
                print(f"  [{lv}] {r['where']}: {r['msg']}")
    return res


if __name__ == '__main__':
    here = os.path.dirname(os.path.abspath(__file__))
    data = os.path.join(os.path.dirname(here), 'data')
    now = None
    if '--now' in sys.argv:
        now = dt.datetime.strptime(sys.argv[sys.argv.index('--now') + 1], '%Y-%m-%d %H:%M').replace(tzinfo=K)
    if '--json' in sys.argv:
        print(json.dumps(check(here, data, now), ensure_ascii=False, indent=1))
    else:
        report(here, data, now)
