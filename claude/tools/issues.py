# 사안(issue) 정의. 리서치마다 Claude가 이 파일과 additions.json만 고치고 build.py를 다시 돌린다.
# tags: 채널 기록 추출본(merged.json)의 내러티브 태그 / kw: 사용자 질문·항목 본문에서 찾을 말 / assets: 가격 영향을 볼 종목
# pw: 가격 영향 반영 비율(매크로 사안은 BTC 움직임을 절반만 자기 몫으로 본다)
ISSUES = [
  dict(id='thesis', label='THESIS: USDT.D·4년선·알트 7종', kind='판단', fixed=True, tags=['thesis'],
       kw=r'USDT\.?D|4년선|THESIS|테시스|208주|48개월|365선|9년선|10년선|ETHU|BITX|NVT|HMA|WMA|허용 이탈', assets=['BTC'], pw=1.0),
  dict(id='leverage', label='레버리지 정리', kind='구조', tags=['leverage', 'options'],
       kw=r'레버리지|\bOI\b|청산|펀딩|롱 |숏|옵션|감마|DVOL|미결제', assets=['BTC'], pw=1.0),
  dict(id='btc_floor', label='BTC 아래 구간·레벨', kind='가격', tags=['onchain_cost'],
       kw=r'바닥|지지선|저점|실현가격|200주|원가|\d\dk', assets=['BTC'], pw=1.0),
  dict(id='etf', label='ETF 유출·현물 수요', kind='수급', tags=['etf_flows'],
       kw=r'ETF|현물 수요|유출|유입|프리미엄', assets=['BTC'], pw=0.6),
  dict(id='rates', label='금리·달러·연준', kind='매크로', tags=['fed_hike', 'real_yield', 'dollar', 'yen_boj'],
       kw=r'금리|연준|FOMC|CPI|PPI|인상|실질|국채|달러|엔화|BOJ|고용', assets=['BTC'], pw=0.5),
  dict(id='ai_semis', label='AI주·반도체·미증시', kind='미증시', tags=['ai_capex', 'nvda', 'asia_stocks', 'anthropic_ipo', 'miners_ai'],
       kw=r'엔비디아|NVDA|(?-i:\bAI\b)|반도체|하이닉스|TSMC|앤트로픽|나스닥|코스피|닛케이', assets=['BTC'], pw=0.5),
  dict(id='binance', label='바이낸스 해킹·보안', kind='사고', tags=['binance_hack', 'security'],
       kw=r'해킹|보안|출금 중단|준비금|익스플로잇', assets=['BNB'], pw=1.0),
  dict(id='privacy', label='프라이버시 코인 ZEC·XMR', kind='섹터', tags=['privacy'],
       kw=r'ZEC|XMR|지캐시|모네로|프라이버시', assets=['ZEC', 'XMR'], pw=1.0),
  dict(id='hyperliquid', label='하이퍼리퀴드·퍼프 DEX', kind='섹터', tags=['hyperliquid', 'perp_dex'],
       kw=r'HYPE|하이퍼리퀴드|퍼프|Aster', assets=['HYPE'], pw=1.0),
  dict(id='memes', label='밈코인 PEPE·SPX', kind='섹터', tags=['memecoins'],
       kw=r'PEPE|SPX|밈|페페', assets=['PEPE', 'SPX'], pw=1.0),
  dict(id='regulation', label='규제·미국 정치', kind='정책', tags=['regulation', 'us_politics'],
       kw=r'규제|\bSEC\b|법안|클래리티|CLARITY|선거|의회|셧다운|청문회', assets=['BTC'], pw=0.4),
  dict(id='stablecoin', label='스테이블코인·USDT', kind='수급', tags=['stablecoin'],
       kw=r'스테이블|USDT(?!\.?D)|테더|USDC|디페그', assets=['BTC'], pw=0.4),
  dict(id='treasury', label='트레저리 기업·Strategy', kind='수급', tags=['treasury_cos'],
       kw=r'Strategy|세일러|Saylor|MSTR|트레저리|BTCS|Nakamoto|8-K', assets=['BTC'], pw=0.6),
  dict(id='geopolitics', label='지정학(이란·관세)', kind='매크로', tags=['geopolitics'],
       kw=r'이란|전쟁|지정학|관세', assets=['BTC'], pw=0.4),
  dict(id='sentiment', label='심리·KOL 여론', kind='심리', tags=['sentiment'],
       kw=r'공포|탐욕|심리|여론', assets=['BTC'], pw=0.3),
  dict(id='eth', label='ETH', kind='자산', tags=['eth'], kw=r'\bETH\b|이더리움', assets=['ETH'], pw=1.0),
  dict(id='sol', label='SOL·솔라나', kind='자산', tags=['solana'], kw=r'(?-i:\bSOL\b)|솔라나', assets=['SOL'], pw=1.0),
  dict(id='ena', label='에테나 ENA', kind='섹터', tags=['ethena'], kw=r'\bENA\b|에테나|USDe', assets=['ENA'], pw=1.0),
  dict(id='magic', label='MAGIC·TIP-63 증자', kind='자산', tags=['magic', 'treasure'],
       kw=r'\bMAGIC\b|TIP-6[34]|Treasure\b|트레저(?!리)', assets=['MAGIC'], pw=1.0),
  dict(id='alt_supply', label='알트 수급·언락·바이백', kind='섹터', tags=['altseason', 'supply_overhang', 'buyback_tokenomics', 'btcfi'],
       kw=r'알트|언락|바이백|\bSTX\b|\bUNI\b|NIGHT', assets=['UNI', 'STX'], pw=0.6),
]

# 종목 → 사안 (레벨·판정처럼 종목이 붙은 항목을 이을 때)
ASSET_ISSUE = {'ZEC': 'privacy', 'XMR': 'privacy', 'HYPE': 'hyperliquid', 'PEPE': 'memes', 'SPX': 'memes',
               'ENA': 'ena', 'MAGIC': 'magic', 'ETH': 'eth', 'SOL': 'sol', 'BNB': 'binance', 'BTC': 'btc_floor'}

# 화면(뷰). 사안 원장이 무게를 정하면 이 화면들의 순서가 따라 바뀐다.
VIEWS = [
  dict(id='timeline', label='타임라인', what='리서치·팔로업 글'),
  dict(id='ledger', label='판정 원장', what='조건부 판정과 채점'),
  dict(id='ladder', label='가격 사다리', what='감시 레벨'),
  dict(id='radar', label='정정·이견', what='정정과 이견'),
  dict(id='catalysts', label='촉매', what='일정과 반응'),
  dict(id='contagion', label='전염 경로', what='충격이 옮겨 가는 길(가설 포함)'),
]
