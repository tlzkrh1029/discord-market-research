# discord-market-research

Discord 3자 대화방(사용자·GPT·Claude)의 시장 리서치를 쌓는 "시장 기억장치". 같은 기록을 두고 두 AI가 각자 따로 만든 두 판을 GitHub Pages로 올린다.

- 입구: https://tlzkrh1029.github.io/discord-market-research/
- `claude/` — Claude 판. 사안 원장 → 중요도 점수 → 배치. 만드는 법은 `claude/tools/build.py` 머리말.
- `gpt/` — GPT 판. GPT가 채팅에 쓴 파일을 Claude가 고치지 않고 옮겨 올린다(커밋 메시지에 표시).

두 판은 코드와 데이터를 공유하지 않는다. 공개 레포·공개 사이트이므로 Discord 대화 원문, 확인 문구, KOL 글 전문, TradingView 원자료는 넣지 않는다. 투자 조언이 아니다.

## Claude 판의 신선도 점검

손으로 쓴 문장(`claude/tools/curated.json`)은 리서치가 다른 주제로 옮겨 가면 그대로 남아 낡기 쉽다. 그래서 두 곳에서 같은 기준으로 확인한다.

- 화면: 손 문장마다 근거 메시지가 올라온 시각을 붙인다. '지금' 24시간, 주목 3선 메모와 사안 해석 3일, THESIS 조건 7일이 지나면 "오래된 문장"으로 표시한다. '지금' 칸은 손 문장이 오래되면 최근 48시간의 리서치 묶음을 앞에 세운다.
- 빌드: `build.py`가 끝에서 `claude/tools/lint.py`를 불러 낡은 문장, 조건 형식 오류, 새 사안 후보를 보고한다. 따로 돌릴 때는 `python3 claude/tools/lint.py`. 레포 안 파일만 읽으므로 어디서나 돌릴 수 있다.
