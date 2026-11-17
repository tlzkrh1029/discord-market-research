(() => {
  "use strict";
  const VIEWS = [
    ["home", "오늘의 작업대", "지금 풀어야 할 질문과 지난 기록판 이후의 변화를 먼저 봅니다."],
    ["timeline", "판단 타임라인", "사건 발생, 최초 인지, 판단 수정 시각을 구분합니다."],
    ["ledger", "판정 원장", "예측, 검증 질문, 기술적 집계를 서로 다른 기록으로 읽습니다."],
    ["radar", "정정·이견", "원 주장, 수정 내용, 영향과 남은 확인을 연결합니다."],
    ["ladder", "가격과 조건", "숫자보다 먼저 관측 시각과 유효 조건을 확인합니다."],
    ["narratives", "관심의 이동", "다룬 빈도, 논조, 가격 반응을 따로 비교합니다."],
    ["catalysts", "다음 확인 시점", "시장 일정과 다음 리서치 확인 항목을 구분합니다."],
    ["signals", "가설 계기판", "자료 없음은 정상도, 조건 불충족도 아닙니다."],
    ["contagion", "연결과 전염", "검증할 연결 가설과 관측된 관계를 구분합니다."]
  ];
  const VIEW_MAP = new Map(VIEWS.map(v => [v[0], v]));
  const ROW_KEYS = [
    "changes", "timeline", "ledger", "corrections", "levels",
    "attention", "catalysts", "signals", "connections"
  ];
  const ISSUE_STATES = ["active", "watch", "gap", "closed"];
  const ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,95}$/;
  const MAX_BYTES = 2 * 1024 * 1024;
  const PIN_KEY = "market-memory:gpt:pins:v1";
  const STATUS = {
    active: ["집중", "active"],
    watch: ["관찰", "watch"],
    gap: ["확인 공백", "gap"],
    closed: ["종결", "closed"],
    unknown: ["확인 불가", "gap"],
    stale: ["자료 낡음", "pending"],
    recheck: ["재확인 필요", "pending"],
    expired: ["만료", "withdrawn"],
    pass: ["조건 충족 · 기록 시점", "fact"],
    fail: ["조건 불충족 · 기록 시점", "failed"],
    hit: ["적중 · 수록 판정", "fact"],
    miss: ["실패 · 수록 판정", "failed"],
    pending: ["판정 대기", "pending"],
    not_evaluable: ["판정 불가 · 집계 제외", "gap"],
    not_a_prediction: ["예측 아님", "neutral"],
    reported: ["전달 보고", "report"],
    verified: ["검증 기록 있음", "fact"],
    unverified: ["미검증", "pending"],
    reported_applied: ["반영 보고 · 재현 전", "report"],
    pending_source: ["원문 확인 대기", "pending"],
    withdrawn: ["정정 주장 철회", "withdrawn"],
    unscheduled: ["확인 시점 미지정", "neutral"],
    scheduled: ["예정", "watch"],
    completed: ["완료 기록", "neutral"],
    cancelled: ["취소", "closed"]
  };
  const KIND_NAMES = {
    initial: "시작",
    scope: "범위",
    priority: "배치 변경",
    evidence: "근거 추가",
    new: "새 질문",
    coverage: "수집 범위",
    method: "방법 변경",
    intake: "후속 정보 연결",
    prediction: "예측",
    research_question: "검증 질문",
    descriptive_report: "기술적 집계",
    research_check: "리서치 확인",
    scheduled_event: "사전 일정",
    unexpected_event: "돌발 사건",
    hypothesis: "연결 가설",
    co_movement: "동행 관계",
    mechanical: "구조적 연결",
    reported_summary: "전달 요약",
    primary: "원자료",
    report: "보도·보고",
    claim: "작성자 주장",
    interpretation: "해석"
  };
  const ids = [
    "main", "viewTitle", "revisionSelect", "latestButton", "dataFile",
    "publicationState", "snapshotMeta", "datasetNote", "searchInput",
    "assetFilter", "statusFilter", "orderSelect", "resetFilters",
    "feedback", "loadError", "errorText", "retryButton", "stats",
    "content", "evidenceDialog", "evidenceTitle", "closeDialog",
    "drawerContent"
  ];
  const dom = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
  if (Object.values(dom).some(node => !node)) {
    throw new Error("index.html과 app.js의 화면 요소가 일치하지 않습니다.");
  }
  const numberFormat = new Intl.NumberFormat("ko-KR", {
    maximumFractionDigits: 4
  });
  const dateFormat = new Intl.DateTimeFormat("ko-KR", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  });
  let pinPersistence = true;
  let state = {
    data: null,
    revisionId: "",
    view: hashView(),
    query: "",
    asset: "all",
    status: "all",
    order: "priority",
    sourceName: "",
    pins: readPins()
  };
  let loadSequence = 0;
  let pendingController = null;
  // 데이터 문자열은 HTML로 해석하지 않습니다.
  function h(tagName, attributes = {}, ...children) {
    const node = document.createElement(tagName);
    for (const [key, value] of Object.entries(attributes)) {
      if (value !== null && value !== undefined && value !== false) {
        node.setAttribute(key, value === true ? "" : String(value));
      }
    }
    for (const child of children.flat(Infinity)) {
      if (child === null || child === undefined || child === false) continue;
      node.appendChild(
        child instanceof Node
          ? child
          : document.createTextNode(String(child))
      );
    }
    return node;
  }
  function badge(text, style = "neutral") {
    return h("span", { class: `tag ${style}` }, text);
  }
  function statusBadge(value) {
    const [text, style] = STATUS[value] || [value, "neutral"];
    return badge(text, style);
  }
  function kindName(value) {
    return KIND_NAMES[value] || value;
  }
  function number(value, unit = null) {
    if (value === null || value === undefined) return "미확인";
    const text = typeof value === "number"
      ? numberFormat.format(value)
      : String(value);
    return unit ? `${text}${unit === "%" ? "" : " "}${unit}` : text;
  }
  function date(value) {
    if (value === null || value === undefined) return "미확인";
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
    return `${dateFormat.format(new Date(value))} KST`;
  }
  function normalize(value) {
    return String(value).normalize("NFKC").toLocaleLowerCase("ko-KR");
  }
  function flatText(object) {
    return Object.values(object).flatMap(value => {
      if (typeof value === "string" || typeof value === "number") {
        return [value];
      }
      if (Array.isArray(value)) {
        return value.filter(v => typeof v === "string" || typeof v === "number");
      }
      return [];
    }).join(" ");
  }
  function safeURL(value) {
    if (typeof value !== "string") return null;
    try {
      const url = new URL(value);
      if (url.protocol !== "https:" || url.username || url.password) return null;
      return url.href;
    } catch {
      return null;
    }
  }
  function readPins() {
    try {
      const raw = localStorage.getItem(PIN_KEY);
      if (!raw || raw.length > 30000) return new Set();
      const values = JSON.parse(raw);
      return new Set(
        Array.isArray(values)
          ? values.filter(v => typeof v === "string" && ID_PATTERN.test(v)).slice(0, 200)
          : []
      );
    } catch {
      pinPersistence = false;
      return new Set();
    }
  }
  function savePins() {
    try {
      localStorage.setItem(PIN_KEY, JSON.stringify([...state.pins]));
      pinPersistence = true;
    } catch {
      pinPersistence = false;
    }
  }
  function hashView() {
    const value = location.hash.slice(1);
    return VIEW_MAP.has(value) ? value : "home";
  }
  // 형식·참조·값 타입 검사입니다. 시장 사실을 검증하는 기능은 아닙니다.
  function validate(data) {
    function check(condition, path, message) {
      if (!condition) throw new Error(`${path}: ${message}`);
    }
    function object(value, path) {
      check(value !== null && typeof value === "object" && !Array.isArray(value),
        path, "객체가 필요합니다.");
    }
    function text(value, path, nullable = false) {
      if (nullable && value === null) return;
      check(typeof value === "string" && value.length <= 6000,
        path, "6,000자 이하 문자열이 필요합니다.");
    }
    function texts(item, keys, path) {
      for (const key of keys) text(item[key], `${path}.${key}`);
    }
    function array(value, path, max = 2000) {
      check(Array.isArray(value) && value.length <= max,
        path, `${max}개 이하 배열이 필요합니다.`);
      return value;
    }
    function stringArray(value, path, max = 2000) {
      array(value, path, max).forEach((v, i) => text(v, `${path}[${i}]`));
    }
    function id(value, path) {
      check(typeof value === "string" && ID_PATTERN.test(value),
        path, "영문·숫자·점·밑줄·하이픈으로 된 ID가 필요합니다.");
    }
    function finite(value, path, nullable = true) {
      if (nullable && value === null) return;
      check(typeof value === "number" && Number.isFinite(value),
        path, "유한한 숫자 또는 허용된 null이 필요합니다.");
    }
    function count(value, path, nullable = true) {
      if (nullable && value === null) return;
      finite(value, path, false);
      check(Number.isInteger(value) && value >= 0,
        path, "0 이상의 정수가 필요합니다.");
    }
    function scalar(value, path) {
      if (value === null) return;
      if (typeof value === "number") finite(value, path, false);
      else text(value, path);
    }
    function choice(value, choices, path) {
      check(choices.includes(value), path, "지원하지 않는 값입니다.");
    }
    function day(value, path, nullable = true) {
      if (nullable && value === null) return;
      check(typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value),
        path, "YYYY-MM-DD 날짜가 필요합니다.");
      const stamp = Date.parse(`${value}T00:00:00Z`);
      check(Number.isFinite(stamp) &&
        new Date(stamp).toISOString().slice(0, 10) === value,
      path, "유효하지 않은 날짜입니다.");
    }
    function timestamp(value, path) {
      if (value === null) return;
      check(
        typeof value === "string" &&
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
        Number.isFinite(Date.parse(value)),
        path, "시간대가 포함된 ISO 시각 또는 null이 필요합니다."
      );
      day(value.slice(0, 10), path, false);
    }
    function unique(items, path) {
      const seen = new Set();
      items.forEach((item, index) => {
        object(item, `${path}[${index}]`);
        id(item.id, `${path}[${index}].id`);
        check(!seen.has(item.id), path, "중복 ID가 있습니다.");
        seen.add(item.id);
      });
      return seen;
    }
    object(data, "data");
    check(data.schemaVersion === 1, "schemaVersion", "버전 1만 지원합니다.");
    object(data.meta, "meta");
    const meta = data.meta;
    texts(meta, [
      "title", "edition", "timezone", "currentRevisionId", "publicationState",
      "notice", "historyPolicy", "priorityPolicy", "missingValuePolicy",
      "sourcePolicy", "updatePolicy"
    ], "meta");
    check(meta.timezone === "Asia/Seoul", "meta.timezone",
      "이 판은 Asia/Seoul 기준입니다.");
    day(meta.preparedOn, "meta.preparedOn", false);
    for (const key of ["isRealtime", "automationConnected"]) {
      check(typeof meta[key] === "boolean", `meta.${key}`, "불리언이 필요합니다.");
    }
    stringArray(meta.limitations, "meta.limitations");
    object(meta.reportedCorpus, "meta.reportedCorpus");
    day(meta.reportedCorpus.from, "meta.reportedCorpus.from", false);
    day(meta.reportedCorpus.through, "meta.reportedCorpus.through", false);
    check(meta.reportedCorpus.from <= meta.reportedCorpus.through,
      "meta.reportedCorpus", "수집 시작일과 종료일을 확인하세요.");
    count(meta.reportedCorpus.messageCount, "meta.reportedCorpus.messageCount", false);
    check(typeof meta.reportedCorpus.importedIntoThisFile === "boolean",
      "meta.reportedCorpus.importedIntoThisFile", "불리언이 필요합니다.");
    text(meta.reportedCorpus.note, "meta.reportedCorpus.note");
    array(data.sources, "sources");
    const sourceIds = unique(data.sources, "sources");
    data.sources.forEach((source, index) => {
      const p = `sources[${index}]`;
      texts(source, ["title", "kind", "sourceGroup", "description", "limitation"], p);
      text(source.messageId, `${p}.messageId`, true);
      timestamp(source.verifiedAt, `${p}.verifiedAt`);
      check(source.url === null || safeURL(source.url) !== null,
        `${p}.url`, "인증정보 없는 HTTPS 주소 또는 null이 필요합니다.");
    });
    function references(value, path) {
      stringArray(value, path);
      check(new Set(value).size === value.length, path, "중복 출처 ID가 있습니다.");
      value.forEach(v => check(sourceIds.has(v), path, "존재하지 않는 출처 ID입니다."));
    }
    array(data.revisions, "revisions", 100);
    check(data.revisions.length > 0, "revisions", "기록판이 하나 이상 필요합니다.");
    const revisionIds = unique(data.revisions, "revisions");
    check(revisionIds.has(meta.currentRevisionId), "meta.currentRevisionId",
      "해당 기록판이 없습니다.");
    const preceding = new Set();
    data.revisions.forEach((revision, index) => {
      const p = `revisions[${index}]`;
      texts(revision, ["label", "summary"], p);
      day(revision.createdOn, `${p}.createdOn`, false);
      day(revision.marketDataThrough, `${p}.marketDataThrough`);
      choice(revision.kind, ["reconstructed", "published"], `${p}.kind`);
      check(revision.previousId === null || preceding.has(revision.previousId),
        `${p}.previousId`, "앞에 있는 기록판 ID 또는 null이 필요합니다.");
      preceding.add(revision.id);
      array(revision.issues, `${p}.issues`);
      const issueIds = unique(revision.issues, `${p}.issues`);
      revision.issues.forEach((issue, n) => {
        const q = `${p}.issues[${n}]`;
        texts(issue, [
          "title", "question", "priorityReason", "summary", "changed", "nextCheck"
        ], q);
        stringArray(issue.assets, `${q}.assets`, 100);
        choice(issue.status, ISSUE_STATES, `${q}.status`);
        count(issue.baseOrder, `${q}.baseOrder`, false);
        count(issue.priority, `${q}.priority`, false);
        check(issue.priority >= 1, `${q}.priority`, "1 이상이어야 합니다.");
        for (const key of [
          "facts", "reports", "interpretations", "counterpoints", "unknowns"
        ]) stringArray(issue[key], `${q}.${key}`);
        timestamp(issue.lastCheckedAt, `${q}.lastCheckedAt`);
        day(issue.lastChangedOn, `${q}.lastChangedOn`, false);
        references(issue.sourceIds, `${q}.sourceIds`);
        stringArray(issue.viewIds, `${q}.viewIds`, 9);
        check(new Set(issue.viewIds).size === issue.viewIds.length,
          `${q}.viewIds`, "화면 ID가 중복됐습니다.");
        issue.viewIds.forEach(v => check(VIEW_MAP.has(v),
          `${q}.viewIds`, "존재하지 않는 화면 ID입니다."));
      });
      for (const key of ROW_KEYS) {
        array(revision[key], `${p}.${key}`);
        unique(revision[key], `${p}.${key}`);
        revision[key].forEach((row, n) => {
          const q = `${p}.${key}[${n}]`;
          references(row.sourceIds, `${q}.sourceIds`);
          if (key !== "connections") {
            check(row.issueId === null || issueIds.has(row.issueId),
              `${q}.issueId`, "현재 기록판의 사안 ID 또는 null이 필요합니다.");
          }
          switch (key) {
            case "changes":
              texts(row, ["kind", "title", "summary"], q);
              break;
            case "timeline":
              texts(row, ["dateLabel", "kind", "title", "summary"], q);
              day(row.date, `${q}.date`);
              for (const k of ["occurredAt", "knownAt", "revisedAt"]) {
                timestamp(row[k], `${q}.${k}`);
              }
              break;
            case "ledger":
              texts(row, ["claim", "reason"], q);
              choice(row.kind, [
                "prediction", "research_question", "descriptive_report"
              ], `${q}.kind`);
              choice(row.status, [
                "hit", "miss", "pending", "not_evaluable", "not_a_prediction"
              ], `${q}.status`);
              text(row.condition, `${q}.condition`, true);
              timestamp(row.deadline, `${q}.deadline`);
              scalar(row.evaluation, `${q}.evaluation`);
              if (["hit", "miss"].includes(row.status)) {
                check(row.kind === "prediction" && row.evaluation !== null &&
                  String(row.evaluation).trim() !== "" &&
                  typeof row.condition === "string" && row.condition.trim() !== "" &&
                  row.sourceIds.length > 0,
                q, "채점된 예측에는 조건·결과·출처가 필요합니다.");
              }
              break;
            case "corrections":
              texts(row, ["title", "original", "revision", "impact", "nextStep"], q);
              choice(row.status, [
                "reported_applied", "pending_source", "withdrawn", "verified"
              ], `${q}.status`);
              break;
            case "levels":
              texts(row, ["label", "reference", "validity"], q);
              stringArray(row.assets, `${q}.assets`, 100);
              finite(row.value, `${q}.value`);
              text(row.unit, `${q}.unit`, true);
              day(row.observedOn, `${q}.observedOn`);
              choice(row.status, ["unknown", "recheck", "expired", "verified"],
                `${q}.status`);
              break;
            case "attention":
              texts(row, ["asset", "label", "basis", "note"], q);
              day(row.periodStart, `${q}.periodStart`);
              day(row.periodEnd, `${q}.periodEnd`);
              if (row.periodStart !== null && row.periodEnd !== null) {
                check(row.periodStart <= row.periodEnd, q, "집계 기간을 확인하세요.");
              }
              for (const k of ["uniqueDays", "bullish", "bearish", "mixed", "neutral"]) {
                count(row[k], `${q}.${k}`);
              }
              finite(row.priceChangePct, `${q}.priceChangePct`);
              choice(row.status, ["reported", "verified"], `${q}.status`);
              break;
            case "catalysts":
              texts(row, ["title", "trigger", "note"], q);
              choice(row.kind, [
                "research_check", "scheduled_event", "unexpected_event"
              ], `${q}.kind`);
              choice(row.status, [
                "unscheduled", "scheduled", "completed", "cancelled"
              ], `${q}.status`);
              timestamp(row.dueAt, `${q}.dueAt`);
              timestamp(row.knownAt, `${q}.knownAt`);
              for (const k of ["expected", "actual", "reaction"]) {
                scalar(row[k], `${q}.${k}`);
              }
              break;
            case "signals":
              texts(row, ["label", "test", "missing"], q);
              stringArray(row.assets, `${q}.assets`, 100);
              choice(row.status, ["unknown", "stale", "pass", "fail"], `${q}.status`);
              finite(row.value, `${q}.value`);
              text(row.unit, `${q}.unit`, true);
              timestamp(row.checkedAt, `${q}.checkedAt`);
              if (["pass", "fail"].includes(row.status)) {
                check(row.value !== null && row.checkedAt !== null &&
                  row.sourceIds.length > 0 && row.test.trim() !== "",
                q, "조건 판정에는 값·확인 시각·기준·출처가 필요합니다.");
              }
              break;
            case "connections":
              texts(row, ["title", "summary", "whatWouldConfirm", "alternative"], q);
              check(issueIds.has(row.from) && issueIds.has(row.to),
                q, "연결 양끝의 사안이 현재 기록판에 있어야 합니다.");
              choice(row.kind, ["hypothesis", "co_movement", "mechanical"],
                `${q}.kind`);
              choice(row.status, ["unverified", "reported", "verified"],
                `${q}.status`);
              if (row.status === "verified") {
                check(row.sourceIds.length > 0, q, "검증 기록에는 출처가 필요합니다.");
              }
              break;
          }
        });
      }
    });
    return data;
  }
  function makeContext(s) {
    const revision = s.data.revisions.find(r => r.id === s.revisionId);
    const c = {
      s,
      data: s.data,
      revision,
      issueMap: new Map(revision.issues.map(i => [i.id, i])),
      sourceMap: new Map(s.data.sources.map(source => [source.id, source]))
    };
    c.issues = revision.issues.filter(issue => issueMatches(c, issue));
    c.issues.sort((a, b) => {
      if (s.order === "stable") {
        return a.baseOrder - b.baseOrder || a.id.localeCompare(b.id);
      }
      return Number(s.pins.has(b.id)) - Number(s.pins.has(a.id)) ||
        a.priority - b.priority ||
        a.baseOrder - b.baseOrder ||
        a.id.localeCompare(b.id);
    });
    return c;
  }
  function baseMatches(c, issue) {
    return (c.s.asset === "all" || issue.assets.includes(c.s.asset)) &&
      (c.s.status === "all" || issue.status === c.s.status);
  }
  function sourceText(c, sourceIds) {
    return sourceIds.map(id => flatText(c.sourceMap.get(id))).join(" ");
  }
  function queryMatches(c, ...parts) {
    const query = normalize(c.s.query.trim());
    return !query || normalize(parts.join(" ")).includes(query);
  }
  function issueMatches(c, issue) {
    return baseMatches(c, issue) &&
      queryMatches(c, flatText(issue), sourceText(c, issue.sourceIds));
  }
  function rows(c, key) {
    return c.revision[key].filter(row => {
      const issue = row.issueId ? c.issueMap.get(row.issueId) : null;
      if (key === "connections") {
        const ends = [c.issueMap.get(row.from), c.issueMap.get(row.to)];
        if (!ends.some(i => baseMatches(c, i))) return false;
        return queryMatches(
          c, flatText(row), ...ends.map(flatText), sourceText(c, row.sourceIds)
        );
      }
      if (issue && !baseMatches(c, issue)) return false;
      if (!issue && (c.s.asset !== "all" || c.s.status !== "all")) return false;
      if (c.s.asset !== "all") {
        if (row.asset && row.asset !== c.s.asset) return false;
        if (Array.isArray(row.assets) && row.assets.length > 0 &&
          !row.assets.includes(c.s.asset)) return false;
      }
      return queryMatches(
        c, flatText(row), issue ? flatText(issue) : "",
        sourceText(c, row.sourceIds)
      );
    });
  }
  function assetsFor(revision) {
    return [...new Set([
      ...revision.issues.flatMap(i => i.assets),
      ...revision.levels.flatMap(i => i.assets),
      ...revision.signals.flatMap(i => i.assets),
      ...revision.attention.map(i => i.asset)
    ])].sort((a, b) => a.localeCompare(b));
  }
  function issueButton(c, id, label = "사안과 근거") {
    if (!id || !c.issueMap.has(id)) return null;
    return h("button", {
      type: "button", class: "text-link", "data-issue": id
    }, label);
  }
  function sourceButton(sourceIds) {
    return sourceIds.length
      ? h("button", {
        type: "button", class: "text-link",
        "data-sources": sourceIds.join(" ")
      }, "출처·검증 한계")
      : h("small", { class: "muted" }, "연결된 근거 미확보");
  }
  function viewButton(id, label) {
    return h("button", {
      type: "button", class: "button secondary", "data-view": id
    }, label || VIEW_MAP.get(id)[1]);
  }
  function bullet(items, emptyText = "수록된 항목이 없습니다.") {
    return h("ul", { class: "clean-list" },
      items.length
        ? items.map(item => h("li", {}, item))
        : h("li", { class: "muted" }, emptyText)
    );
  }
  function fields(items) {
    return h("dl", { class: "field-list" },
      items.map(([label, value]) =>
        h("div", { class: "field" },
          h("dt", {}, label),
          h("dd", {}, value === null || value === undefined ? "미확인" : value)
        )
      )
    );
  }
  function heading(title, note = "") {
    return h("div", { class: "section-heading" },
      h("h2", {}, title),
      note ? h("p", {}, note) : null
    );
  }
  function empty(message = "현재 필터에 맞는 기록이 없습니다.") {
    return h("section", { class: "empty-state" },
      h("span", { class: "eyebrow" }, "NO RECORD, NOT ZERO"),
      h("h2", {}, message),
      h("p", {}, "자료 없음은 0이나 정상 판정으로 바꾸지 않습니다. 필터와 기록판을 확인하세요.")
    );
  }
  function notice(text, danger = false) {
    return h("div", { class: `notice${danger ? " danger" : ""}` }, text);
  }
  function table(headers, bodyRows, label) {
    return h("div", {
      class: "table-wrap", tabindex: "0",
      role: "region", "aria-label": `${label} · 가로 스크롤 가능`
    }, h("table", { class: "data-table" },
      h("caption", { class: "sr-only" }, label),
      h("thead", {}, h("tr", {},
        headers.map(text => h("th", { scope: "col" }, text))
      )),
      h("tbody", {}, bodyRows.map(cells =>
        h("tr", {}, cells.map(cell => h("td", {}, cell)))
      ))
    ));
  }
  function foot(c, row) {
    return h("div", { class: "card-bottom" },
      issueButton(c, row.issueId),
      sourceButton(row.sourceIds)
    );
  }
  function issueCard(c, issue, featured = false) {
    return h("article", { class: `card${featured ? " featured" : ""}` },
      h("div", { class: "card-top" },
        h("div", { class: "badges" },
          statusBadge(issue.status),
          badge(`편집 우선순위 ${issue.priority}`, "outline"),
          issue.assets.map(asset => badge(asset, "outline"))
        ),
        h("button", {
          type: "button", class: "pin-button", "data-pin": issue.id,
          "aria-pressed": String(c.s.pins.has(issue.id)),
          "aria-label": `${issue.title} 추천 순서 고정`
        }, c.s.pins.has(issue.id) ? "고정됨" : "위에 고정")
      ),
      h(featured ? "h2" : "h3", {
        class: featured ? "question" : null
      }, issue.question),
      h("p", { class: featured ? "lead" : null }, issue.summary),
      h("div", { class: "reason" }, "앞에 놓은 이유 · ", issue.priorityReason),
      issue.counterpoints.length
        ? h("div", { class: "counterpoint" },
          h("strong", {}, "반대·유보 · "), issue.counterpoints[0])
        : null,
      fields([
        ["다음 확인", issue.nextCheck],
        ["원문·값 확인 시각", date(issue.lastCheckedAt)]
      ]),
      h("div", { class: "card-bottom" },
        issueButton(c, issue.id, "사실·해석·반대 근거 펼치기"),
        h("small", {}, `기록 변경일 ${date(issue.lastChangedOn)}`)
      )
    );
  }
  function differences(c) {
    const previous = c.data.revisions.find(r => r.id === c.revision.previousId);
    if (!previous) return null;
    const before = new Map(previous.issues.map(i => [i.id, i]));
    const after = c.issueMap;
    const ids = [...new Set([...before.keys(), ...after.keys()])];
    const compareKeys = [
      "question", "summary", "facts", "reports", "interpretations",
      "counterpoints", "unknowns", "nextCheck", "sourceIds", "assets", "viewIds"
    ];
    const results = [];
    for (const id of ids) {
      const oldIssue = before.get(id);
      const newIssue = after.get(id);
      const issue = newIssue || oldIssue;
      if (!issueMatches(c, issue)) continue;
      const notes = [];
      if (!oldIssue) notes.push("새 질문");
      else if (!newIssue) notes.push("이전판에만 있음 · 종결을 의미하지 않음");
      else {
        if (oldIssue.priority !== newIssue.priority) {
          notes.push(`편집 우선순위 ${oldIssue.priority} → ${newIssue.priority}`);
        }
        if (oldIssue.status !== newIssue.status) {
          notes.push(`상태 ${STATUS[oldIssue.status][0]} → ${STATUS[newIssue.status][0]}`);
        }
        if (compareKeys.some(key =>
          JSON.stringify(oldIssue[key]) !== JSON.stringify(newIssue[key])
        )) notes.push("질문·요약·근거 또는 확인 항목 변경");
        if (oldIssue.lastCheckedAt !== newIssue.lastCheckedAt) {
          notes.push("확인 시각 변경");
        }
      }
      if (notes.length) results.push({ issue, notes, inCurrent: Boolean(newIssue) });
    }
    return { previous, results };
  }
  function renderHome(c) {
    const body = h("div", { class: "stack" });
    body.append(heading("지금 풀어야 할 질문",
      "고정은 추천 순서에만 적용 · 이 브라우저의 보기 설정"));
    if (!c.issues.length) {
      body.append(empty("조건에 맞는 질문이 없습니다."));
    } else {
      body.append(issueCard(c, c.issues[0], true));
      if (c.issues.length > 1) {
        body.append(h("div", { class: "grid" },
          c.issues.slice(1).map(issue => issueCard(c, issue))
        ));
      }
    }
    const changes = rows(c, "changes");
    const diff = differences(c);
    const changeCard = h("article", { class: "card" },
      h("h3", {}, "이 기록판에 남긴 변경"),
      changes.length
        ? h("ul", { class: "compact-list" }, changes.map(change =>
          h("li", {},
            badge(kindName(change.kind), change.kind === "priority" ? "watch" : "neutral"),
            h("p", {}, h("strong", {}, change.title)),
            h("p", {}, change.summary),
            foot(c, change)
          )))
        : h("p", { class: "muted" }, "필터에 맞는 변경 기록이 없습니다.")
    );
    const diffCard = h("article", { class: "card" },
      h("h3", {}, "이전 기록판과 실제 데이터 비교"),
      diff
        ? h("p", { class: "muted" }, `비교 대상 · ${diff.previous.label}`)
        : h("p", { class: "muted" }, "첫 기록판입니다. 비교 대상이 없습니다."),
      diff && diff.results.length
        ? h("ul", { class: "compact-list" }, diff.results.map(result =>
          h("li", {},
            result.inCurrent
              ? issueButton(c, result.issue.id, result.issue.title)
              : h("strong", {}, result.issue.title),
            h("p", {}, result.notes.join(" · "))
          )))
        : diff
          ? h("p", {}, "선택 범위에서 사안 필드의 차이를 찾지 못했습니다.")
          : null
    );
    body.append(heading("지난 기록판 이후", "작성된 변경 설명과 자동 비교를 함께 표시"));
    body.append(h("div", { class: "grid" }, changeCard, diffCard));
    const recommendations = VIEWS.filter(v => v[0] !== "home").map((view, index) => ({
      id: view[0],
      title: view[1],
      index,
      count: c.issues.filter(issue => issue.viewIds.includes(view[0])).length
    })).filter(view => view.count > 0)
      .sort((a, b) => b.count - a.count || a.index - b.index)
      .slice(0, 3);
    body.append(heading("다음에 펼칠 곳", "시장 중요도 점수가 아니라 선택한 질문의 연결 수"));
    body.append(recommendations.length
      ? h("div", { class: "grid three" }, recommendations.map(view =>
        h("article", { class: "card" },
          h("span", { class: "eyebrow" }, "RECOMMENDED ROUTE"),
          h("h3", {}, view.title),
          h("p", { class: "muted" }, `선택한 사안 ${view.count}개와 연결됩니다.`),
          viewButton(view.id, "이 화면 열기")
        )))
      : empty("연결된 추천 화면이 없습니다.")
    );
    body.append(notice(c.data.meta.priorityPolicy));
    return body;
  }
  function renderTimeline(c) {
    const items = rows(c, "timeline").slice().sort((a, b) =>
      (a.date || "9999").localeCompare(b.date || "9999") ||
      a.id.localeCompare(b.id)
    );
    if (!items.length) return empty();
    return h("section", { class: "card" },
      h("div", { class: "timeline" }, items.map(item =>
        h("article", { class: "timeline-item" },
          h("div", {},
            item.date
              ? h("time", { datetime: item.date }, date(item.date))
              : h("small", { class: "muted" }, "시각 미확보"),
            h("p", { class: "muted" }, item.dateLabel)
          ),
          h("div", {},
            badge(kindName(item.kind), "outline"),
            h("h3", {}, item.title),
            h("p", {}, item.summary),
            fields([
              ["사건 발생", date(item.occurredAt)],
              ["최초 인지", date(item.knownAt)],
              ["판단 수정", date(item.revisedAt)]
            ]),
            foot(c, item)
          )
        )
      ))
    );
  }
  function renderLedger(c) {
    const items = rows(c, "ledger");
    const predictions = items.filter(item => item.kind === "prediction");
    const scored = predictions.filter(item => ["hit", "miss"].includes(item.status));
    const body = h("div", { class: "stack" },
      notice(
        `예측 ${predictions.length}건 · 채점 결과 있는 예측 ${scored.length}건. ` +
        "검증 질문과 논조 집계는 적중률의 분모에 넣지 않습니다. " +
        "성격이 다른 예측을 합친 단일 적중률도 표시하지 않습니다."
      )
    );
    body.append(items.length
      ? table(
        ["주장 또는 질문", "유형·상태", "조건·기한", "결과·제외 이유", "근거"],
        items.map(item => [
          h("strong", {}, item.claim),
          h("div", { class: "stack" },
            badge(kindName(item.kind), "outline"), statusBadge(item.status)),
          h("div", {},
            h("p", {}, item.condition === null ? "조건 미확보" : item.condition),
            h("p", {}, `기한 · ${date(item.deadline)}`)),
          h("div", {},
            h("strong", {}, `결과 · ${number(item.evaluation)}`),
            h("p", {}, item.reason)),
          h("div", { class: "stack" },
            issueButton(c, item.issueId), sourceButton(item.sourceIds))
        ]),
        "판정 원장"
      )
      : empty("표시할 예측·질문 기록이 없습니다.")
    );
    return body;
  }
  function renderRadar(c) {
    const items = rows(c, "corrections");
    return items.length
      ? h("div", { class: "grid" }, items.map(item =>
        h("article", { class: "card" },
          h("div", { class: "card-top" }, statusBadge(item.status)),
          h("h3", {}, item.title),
          fields([
            ["원 주장·문제", item.original],
            ["수정·철회 내용", item.revision],
            ["영향", item.impact],
            ["다음 확인", item.nextStep]
          ]),
          foot(c, item)
        )))
      : empty("이 기록판에 연결된 정정 기록이 없습니다.");
  }
  function renderLadder(c) {
    const items = rows(c, "levels");
    return h("div", { class: "stack" },
      notice(
        "원본 값이 없으면 가격선을 그리지 않습니다. " +
        "만료는 당시 자료의 상태이며, 현재 시장에서 그 가격이 무의미하다는 판정은 아닙니다."
      ),
      items.length
        ? table(
          ["조건·자료", "값", "상태", "관측일", "유효 조건", "근거"],
          items.map(item => [
            h("div", {}, h("strong", {}, item.label),
              h("p", {}, item.reference)),
            h("span", { class: "price" }, number(item.value, item.unit)),
            statusBadge(item.status),
            date(item.observedOn),
            item.validity,
            h("div", { class: "stack" },
              issueButton(c, item.issueId), sourceButton(item.sourceIds))
          ]),
          "가격과 조건"
        )
        : empty("선택 범위에 가격 조건 자료가 없습니다.")
    );
  }
  function scoreRow(label, value, maximum) {
    return h("div", { class: "score-row" },
      h("span", {}, label),
      value === null
        ? h("span", { class: "muted" }, "자료 없음")
        : h("meter", {
          min: "0", max: String(maximum), value: String(value),
          "aria-label": `${label} ${value}건`
        }, `${value}건`),
      h("span", { class: "number" }, value === null ? "—" : value)
    );
  }
  function renderNarratives(c) {
    const items = rows(c, "attention");
    if (!items.length) return empty("관심·논조 집계가 아직 없습니다.");
    const maximum = Math.max(1, ...items.flatMap(item =>
      [item.bullish, item.bearish, item.mixed, item.neutral]
        .filter(value => value !== null)
    ));
    return h("div", { class: "stack" },
      notice(
        "막대는 수록된 분류 건수입니다. 혼합·중립이 비어 있으면 전체 비율을 계산하지 않습니다. " +
        "강세 0건과 미확인은 다르며, 채널 표본은 시장 전체 여론이 아닙니다."
      ),
      h("div", { class: "grid" }, items.map(item =>
        h("article", { class: "card" },
          h("div", { class: "card-top" },
            badge(item.asset, "outline"), statusBadge(item.status)),
          h("h3", {}, item.label),
          h("p", { class: "muted" },
            `집계 기간 · ${date(item.periodStart)} ~ ${date(item.periodEnd)}`),
          scoreRow("강세", item.bullish, maximum),
          scoreRow("약세", item.bearish, maximum),
          scoreRow("혼합", item.mixed, maximum),
          scoreRow("중립", item.neutral, maximum),
          fields([
            ["집계 단위", item.basis],
            ["중복 제거한 다룬 날", number(item.uniqueDays)],
            ["기간 가격 변화", number(item.priceChangePct, "%")]
          ]),
          h("p", { class: "reason" }, item.note),
          foot(c, item)
        )))
    );
  }
  function renderCatalysts(c) {
    const items = rows(c, "catalysts");
    return h("div", { class: "stack" },
      notice(
        "‘리서치 확인’은 실제 경제 발표 일정이 아닙니다. " +
        "예정 시각이나 당시 예상이 없으면 임의로 채우지 않습니다."
      ),
      items.length
        ? h("div", { class: "grid" }, items.map(item =>
          h("article", { class: "card" },
            h("div", { class: "card-top" },
              badge(kindName(item.kind), "outline"), statusBadge(item.status)),
            h("h3", {}, item.title),
            h("p", { class: "reason" }, `확인 조건 · ${item.trigger}`),
            fields([
              ["예정·확인 시각", date(item.dueAt)],
              ["사전에 알게 된 시각", date(item.knownAt)],
              ["당시 예상", number(item.expected)],
              ["실제 결과", number(item.actual)],
              ["이후 반응", number(item.reaction)]
            ]),
            h("p", { class: "muted" }, item.note),
            foot(c, item)
          )))
        : empty("등록된 일정이나 다음 확인 항목이 없습니다.")
    );
  }
  function renderSignals(c) {
    const items = rows(c, "signals");
    const unknown = items.filter(item => ["unknown", "stale"].includes(item.status)).length;
    return h("div", { class: "stack" },
      notice(
        `확인 불가·자료 낡음 ${unknown}개. ` +
        "충족·불충족은 기록된 확인 시점의 결과이며 현재 상태를 보장하지 않습니다. " +
        "서로 다른 주기의 기준선을 하나의 신호로 합산하지 않습니다."
      ),
      items.length
        ? h("div", { class: "grid" }, items.map(item =>
          h("article", { class: "card" },
            h("div", { class: "card-top" },
              statusBadge(item.status),
              h("div", { class: "badges" },
                item.assets.map(asset => badge(asset, "outline")))),
            h("h3", {}, item.label),
            fields([
              ["값", number(item.value, item.unit)],
              ["확인 시각", date(item.checkedAt)],
              ["판정 기준", item.test],
              ["부족한 자료", item.missing]
            ]),
            foot(c, item)
          )))
        : empty("연결된 판단 조건이 없습니다.")
    );
  }
  function renderContagion(c) {
    const items = rows(c, "connections");
    if (!items.length) return empty("등록된 연결 관계가 없습니다.");
    const nodeIds = [...new Set(items.flatMap(item => [item.from, item.to]))];
    return h("div", { class: "stack" },
      notice(
        "점선 연결은 검증할 질문입니다. 동행은 인과관계의 증명이 아니며, " +
        "구조적 경로가 존재해도 특정 사건에서 실제 작동했는지는 별도 확인이 필요합니다."
      ),
      h("div", { class: "flow-grid" }, nodeIds.map(id => {
        const issue = c.issueMap.get(id);
        return h("article", { class: "flow-node hypothesis" },
          statusBadge(issue.status),
          h("h3", {}, issue.title),
          h("p", { class: "muted" }, issue.question),
          issueButton(c, id, "연결된 사안 보기")
        );
      })),
      h("section", { class: "card" }, items.map(item =>
        h("article", {
          class: `connection ${item.kind === "mechanical" ? "mechanical" : "hypothesis"}`
        },
          h("div", { class: "badges" },
            badge(kindName(item.kind), "outline"), statusBadge(item.status)),
          h("p", { class: "mono" },
            c.issueMap.get(item.from).title,
            item.kind === "co_movement" ? " ↔ " : " → ",
            c.issueMap.get(item.to).title),
          h("strong", {}, item.title),
          h("p", {}, item.summary),
          fields([
            ["검증에 필요한 것", item.whatWouldConfirm],
            ["대안 설명", item.alternative]
          ]),
          h("div", { class: "card-bottom" }, sourceButton(item.sourceIds))
        )
      ))
    );
  }
  const RENDERERS = {
    home: renderHome,
    timeline: renderTimeline,
    ledger: renderLedger,
    radar: renderRadar,
    ladder: renderLadder,
    narratives: renderNarratives,
    catalysts: renderCatalysts,
    signals: renderSignals,
    contagion: renderContagion
  };
  function stat(value, label) {
    return h("div", { class: "stat" },
      h("span", { class: "number" }, number(value)),
      h("span", { class: "label" }, label)
    );
  }
  // 新 데이터와 화면을 메모리에서 먼저 준비한 뒤 현재 화면에 반영합니다.
  function prepare(s) {
    const c = makeContext(s);
    const levelRows = rows(c, "levels");
    const scored = rows(c, "ledger").filter(item =>
      item.kind === "prediction" && ["hit", "miss"].includes(item.status)
    ).length;
    const body = h("div", { class: "stack" },
      h("p", { class: "lead" }, VIEW_MAP.get(s.view)[2]),
      c.revision.kind === "reconstructed"
        ? notice("비교용 재구성본입니다. 당시 실제 게시 화면이나 당시 정보 집합을 재현한 판본이 아닙니다.")
        : null,
      RENDERERS[s.view](c)
    );
    return {
      c,
      body,
      assets: assetsFor(c.revision),
      stats: [
        stat(c.issues.length, "필터에 맞는 사안"),
        stat(c.issues.filter(i => i.status === "gap").length, "사안의 확인 공백"),
        stat(levelRows.filter(i => ["recheck", "expired"].includes(i.status)).length,
          "재확인·만료 자료"),
        stat(scored, "채점 기록 있는 예측")
      ]
    };
  }
  function updateNavigation() {
    for (const button of document.querySelectorAll(".navigation [data-view]")) {
      if (button.dataset.view === state.view) {
        button.setAttribute("aria-current", "page");
      } else {
        button.removeAttribute("aria-current");
      }
    }
    dom.viewTitle.textContent = VIEW_MAP.get(state.view)[1];
    document.title = `${VIEW_MAP.get(state.view)[1]} — 시장 기억장치 · GPT`;
  }
  function paint(ui) {
    const { c } = ui;
    const meta = state.data.meta;
    const revision = c.revision;
    updateNavigation();
    dom.revisionSelect.replaceChildren(...state.data.revisions.map(item =>
      h("option", {
        value: item.id, selected: item.id === state.revisionId
      }, item.label)
    ));
    dom.revisionSelect.disabled = false;
    dom.assetFilter.replaceChildren(
      h("option", { value: "all" }, "전체 자산"),
      ...ui.assets.map(asset => h("option", { value: asset }, asset))
    );
    dom.assetFilter.value = state.asset;
    dom.statusFilter.value = state.status;
    dom.orderSelect.value = state.order;
    if (dom.searchInput.value !== state.query) dom.searchInput.value = state.query;
    dom.publicationState.textContent = meta.publicationState;
    dom.publicationState.className = "tag report";
    dom.snapshotMeta.textContent =
      `${state.sourceName} · ${revision.label} · 편집일 ${date(revision.createdOn)}` +
      ` · 시장 원본 참조 종료 ${date(revision.marketDataThrough)}`;
    dom.datasetNote.textContent = [
      meta.notice,
      meta.reportedCorpus.note,
      "실시간 시세 화면이 아닙니다."
    ].join(" ");
    dom.latestButton.title = "현재 읽은 JSON에서 지정한 최신 기록판으로 이동";
    dom.stats.replaceChildren(...ui.stats);
    dom.stats.hidden = false;
    dom.content.replaceChildren(ui.body);
    dom.content.setAttribute("aria-busy", "false");
    dom.feedback.textContent =
      `${c.issues.length} / ${revision.issues.length}개 사안 · 필터는 화면을 이동해도 유지됩니다.` +
      ((state.asset !== "all" || state.status !== "all")
        ? " 사안이 연결되지 않은 전역 기록은 이 필터에서 제외됩니다."
        : "") +
      (!pinPersistence ? " 고정 설정은 이 창에서만 유지됩니다." : "");
  }
  function update(patch) {
    const next = { ...state, ...patch };
    if (!VIEW_MAP.has(next.view)) next.view = "home";
    if (!next.data) {
      state = next;
      updateNavigation();
      return;
    }
    const revision = next.data.revisions.find(r => r.id === next.revisionId);
    if (!revision) throw new Error("선택한 기록판을 찾을 수 없습니다.");
    if (next.asset !== "all" && !assetsFor(revision).includes(next.asset)) {
      next.asset = "all";
    }
    const ui = prepare(next);
    const closeOldDrawer = state.data !== next.data ||
      state.revisionId !== next.revisionId;
    if (closeOldDrawer) closeDrawer();
    state = next;
    paint(ui);
  }
  function sourceList(c, sourceIds) {
    const sources = sourceIds.map(id => c.sourceMap.get(id));
    const groups = new Set(sources.map(source => source.sourceGroup));
    return h("div", {},
      h("p", { class: "muted" },
        `출처 항목 ${sources.length}개 · 출처 계열 ${groups.size}개. ` +
        "이 개수만큼 독립 근거가 검증됐다는 뜻은 아닙니다."),
      sources.length
        ? sources.map(source => {
          const url = safeURL(source.url);
          return h("article", { class: "source-item" },
            badge(kindName(source.kind), source.kind === "reported_summary" ? "report" : "outline"),
            h("h3", {}, source.title),
            h("p", {}, source.description),
            h("p", { class: "counterpoint" }, source.limitation),
            url
              ? h("a", {
                href: url, target: "_blank", rel: "noopener noreferrer"
              }, "공개 출처 열기")
              : h("span", { class: "muted" }, "직접 열 수 있는 공개 링크 없음"),
            h("small", {},
              `출처 ID ${source.id} · 계열 ${source.sourceGroup}`),
            h("small", {},
              `원문 메시지 ID ${source.messageId === null ? "미확보" : source.messageId}`),
            h("small", {},
              `출처에 기록된 확인 시각 ${date(source.verifiedAt)}`)
          );
        })
        : h("p", { class: "muted" }, "연결된 출처를 아직 확보하지 못했습니다."),
      notice(c.data.meta.sourcePolicy)
    );
  }
  function openDrawer(title, content) {
    dom.evidenceTitle.textContent = title;
    dom.drawerContent.replaceChildren(content);
    if (!dom.evidenceDialog.open) dom.evidenceDialog.showModal();
    else dom.closeDialog.focus();
  }
  function closeDrawer() {
    if (dom.evidenceDialog.open) dom.evidenceDialog.close();
  }
  function openIssue(id) {
    if (!state.data) return;
    const c = makeContext(state);
    const issue = c.issueMap.get(id);
    if (!issue) throw new Error("현재 기록판에 없는 사안입니다.");
    const section = (title, items, fallback) =>
      h("section", {}, h("h3", {}, title), bullet(items, fallback));
    openDrawer(issue.title, h("div", {},
      h("div", { class: "badges" },
        statusBadge(issue.status),
        issue.assets.map(asset => badge(asset, "outline"))),
      h("p", { class: "lead" }, issue.question),
      h("p", {}, issue.summary),
      h("div", { class: "reason" }, "편집 이유 · ", issue.priorityReason),
      fields([
        ["이번 기록 변경", issue.changed],
        ["다음 확인", issue.nextCheck],
        ["원문·값 확인 시각", date(issue.lastCheckedAt)],
        ["기록 변경일", date(issue.lastChangedOn)]
      ]),
      section("사실로 분류해 수록한 항목", issue.facts,
        "직접 검증된 사실로 수록한 항목이 없습니다."),
      section("전달받은 관측·요약", issue.reports,
        "연결된 관측 요약이 없습니다."),
      section("해석", issue.interpretations, "수록한 해석이 없습니다."),
      section("반대 근거·유보", issue.counterpoints,
        "반대 근거가 없다는 뜻이 아니라, 아직 수록하지 않았습니다."),
      section("아직 모르는 것", issue.unknowns, "별도로 적힌 확인 공백이 없습니다."),
      h("section", {},
        h("h3", {}, "연결된 고정 화면"),
        h("div", { class: "badges" },
          issue.viewIds.map(view => viewButton(view)))),
      h("section", {},
        h("h3", {}, "출처와 검증 한계"),
        sourceList(c, issue.sourceIds))
    ));
  }
  function showSources(sourceIds) {
    if (!state.data) return;
    const c = makeContext(state);
    const available = [...new Set(sourceIds)].filter(id => c.sourceMap.has(id));
    openDrawer("출처와 검증 한계", sourceList(c, available));
  }
  function showError(error) {
    dom.loadError.hidden = false;
    dom.errorText.textContent = error instanceof Error
      ? error.message.slice(0, 800)
      : "기록을 적용하지 못했습니다.";
    dom.content.setAttribute("aria-busy", "false");
    dom.feedback.textContent = state.data
      ? "새 입력은 적용하지 않았습니다. 이 창에서 읽은 마지막 정상 기록을 유지합니다."
      : "아직 적용한 기록이 없습니다.";
    if (!state.data) {
      dom.publicationState.textContent = "기록 읽기 실패";
      dom.publicationState.className = "tag failed";
      dom.content.replaceChildren(empty("공개용 JSON을 읽지 못했습니다."));
    }
  }
  function clearError() {
    dom.loadError.hidden = true;
    dom.errorText.textContent = "";
  }
  function applyText(raw, sourceName) {
    if (new TextEncoder().encode(raw).length > MAX_BYTES) {
      throw new Error("기록 파일은 2MiB 이하로 나눠 주세요.");
    }
    let parsed;
    try {
      parsed = JSON.parse(raw.replace(/^\uFEFF/, ""));
    } catch {
      throw new Error("JSON 문법 오류입니다. 코드블록 표시와 파일 제목을 제외하고 저장했는지 확인하세요.");
    }
    const data = validate(parsed);
    const wasCurrent = !state.data ||
      state.revisionId === state.data.meta.currentRevisionId;
    const preserve = !wasCurrent &&
      data.revisions.some(revision => revision.id === state.revisionId);
    update({
      data,
      revisionId: preserve ? state.revisionId : data.meta.currentRevisionId,
      sourceName
    });
    clearError();
  }
  function beginLoad() {
    loadSequence += 1;
    if (pendingController) pendingController.abort();
    pendingController = null;
    dom.feedback.textContent = state.data
      ? "새 기록을 검사하는 중입니다. 기존 화면은 유지합니다."
      : "공개용 기록을 읽는 중입니다.";
    if (!state.data) dom.content.setAttribute("aria-busy", "true");
    return loadSequence;
  }
  async function loadRemote() {
    const sequence = beginLoad();
    const controller = new AbortController();
    pendingController = controller;
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 12000);
    try {
      const url = new URL("./data/terminal.json", document.baseURI);
      const response = await fetch(url, {
        cache: "no-store",
        credentials: "omit",
        redirect: "error",
        mode: "same-origin",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error(`기록 파일 요청 실패 · HTTP ${response.status}`);
      }
      const length = Number(response.headers.get("content-length"));
      if (Number.isFinite(length) && length > MAX_BYTES) {
        throw new Error("배포된 기록 파일이 2MiB를 넘습니다.");
      }
      const raw = await response.text();
      if (sequence !== loadSequence) return;
      applyText(raw, "배포 JSON");
    } catch (error) {
      if (sequence !== loadSequence) return;
      showError(timedOut
        ? new Error("12초 안에 기록을 읽지 못했습니다. 다시 읽거나 로컬 JSON을 선택하세요.")
        : error);
    } finally {
      clearTimeout(timeout);
      if (sequence === loadSequence) pendingController = null;
    }
  }
  async function loadLocal(file) {
    const sequence = beginLoad();
    try {
      if (file.size > MAX_BYTES) {
        throw new Error("로컬 기록 파일은 2MiB 이하로 선택하세요.");
      }
      const raw = await file.text();
      if (sequence !== loadSequence) return;
      applyText(raw, `로컬 미리보기 · ${file.name.slice(0, 80)}`);
    } catch (error) {
      if (sequence === loadSequence) showError(error);
    }
  }
  function listen(id, eventName, handler) {
    dom[id].addEventListener(eventName, event => {
      try {
        handler(event);
      } catch (error) {
        showError(error);
      }
    });
  }
  function navigate(view) {
    if (!VIEW_MAP.has(view)) return;
    closeDrawer();
    if (location.hash !== `#${view}`) location.hash = view;
    else update({ view });
    dom.main.focus({ preventScroll: true });
  }
  document.addEventListener("click", event => {
    if (!(event.target instanceof Element)) return;
    const button = event.target.closest(
      "button[data-view], button[data-issue], button[data-sources], button[data-pin]"
    );
    if (!button) return;
    try {
      if (button.hasAttribute("data-view")) {
        navigate(button.dataset.view);
      } else if (button.hasAttribute("data-issue")) {
        openIssue(button.dataset.issue);
      } else if (button.hasAttribute("data-sources")) {
        showSources(button.dataset.sources.split(" ").filter(Boolean));
      } else if (button.hasAttribute("data-pin")) {
        const id = button.dataset.pin;
        if (!state.data || !makeContext(state).issueMap.has(id)) return;
        const pins = new Set(state.pins);
        if (pins.has(id)) pins.delete(id);
        else if (pins.size < 200) pins.add(id);
        else throw new Error("고정 항목은 200개까지 저장할 수 있습니다.");
        update({ pins });
        savePins();
        if (!pinPersistence) {
          dom.feedback.textContent += " 고정 설정을 디스크에 저장하지 못해 이 창에서만 유지합니다.";
        }
        dom.content.querySelector(`[data-pin="${id}"]`)?.focus({ preventScroll: true });
      }
    } catch (error) {
      showError(error);
    }
  });
  listen("searchInput", "input", event => {
    update({ query: event.target.value.slice(0, 160) });
  });
  listen("assetFilter", "change", event => {
    update({ asset: event.target.value });
  });
  listen("statusFilter", "change", event => {
    update({ status: event.target.value });
  });
  listen("orderSelect", "change", event => {
    update({ order: event.target.value });
  });
  listen("revisionSelect", "change", event => {
    update({ revisionId: event.target.value });
  });
  listen("latestButton", "click", () => {
    if (state.data) update({ revisionId: state.data.meta.currentRevisionId });
  });
  listen("resetFilters", "click", () => {
    update({ query: "", asset: "all", status: "all", order: "priority" });
    dom.searchInput.value = "";
    dom.assetFilter.value = "all";
    dom.statusFilter.value = "all";
    dom.orderSelect.value = "priority";
  });
  listen("retryButton", "click", () => {
    void loadRemote();
  });
  listen("dataFile", "change", event => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void loadLocal(file);
  });
  listen("closeDialog", "click", closeDrawer);
  dom.evidenceDialog.addEventListener("click", event => {
    if (event.target !== dom.evidenceDialog) return;
    const rect = dom.evidenceDialog.getBoundingClientRect();
    if (event.clientX < rect.left || event.clientX > rect.right ||
      event.clientY < rect.top || event.clientY > rect.bottom) {
      closeDrawer();
    }
  });
  window.addEventListener("hashchange", () => {
    try {
      closeDrawer();
      update({ view: hashView() });
    } catch (error) {
      showError(error);
    }
  });
  updateNavigation();
  void loadRemote();
})();
