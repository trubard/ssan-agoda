// 아고다 가격 비교기 — 결과 창(새 창)에서 수집·렌더링
// 팝업이 저장한 job을 읽어 자동 실행한다. 새 창이라 포커스를 잃어도 중단되지 않는다.

const $ = (id) => document.getElementById(id);

const LOAD_TIMEOUT = 20000;   // 탭 로딩 최대 대기(ms)
const SCRAPE_TIMEOUT = 16000; // 가격 엘리먼트 폴링 최대 대기(ms)
const BETWEEN_DELAY = 1200;   // 탭 사이 간격(ms)

(async function main() {
  const { job } = await chrome.storage.local.get("job");
  if (!job || !job.srcUrl) {
    setStatus("실행할 작업이 없습니다. 확장 팝업에서 분석을 시작하세요.");
    return;
  }
  await chrome.storage.local.remove("job"); // 1회성 작업
  $("src").textContent = job.srcUrl;
  await run(job);
})();

// ── 메인 ──
async function run(job) {
  const { srcUrl, locales, currencies, full, auto } = job;

  let combos;
  if (auto) {
    // 1순위: URL 경로의 국가코드(예: .../hotel/seoul-kr.html → KR)
    let cc = normalizeCountry(countryFromUrl(srcUrl));
    // 폴백: URL로 못 잡으면 페이지를 한 번 열어 JSON-LD에서 감지
    if (!cc) {
      setStatus("숙소 국가 감지 중…");
      await clearAgodaCookies();
      let probe = null;
      try { probe = await collect(srcUrl); } catch (e) {}
      cc = normalizeCountry(probe && probe.country);
    }
    combos = buildAutoCombos(cc);
    setStatus(`${cc ? cc + " 감지" : "국가 미감지 — 기본 세트"} · ${combos.length}개 비교`);
  } else {
    combos = buildCombos(locales, currencies, full);
  }

  if (!combos.length) {
    setStatus("비교할 로케일/통화가 없습니다.");
    return;
  }

  setStatus("환율 불러오는 중…");
  let fx = null;
  try { fx = await fetchRates(); } catch (e) { setStatus("환율 API 실패 — 표시가만 비교합니다."); }

  const results = [];
  for (let i = 0; i < combos.length; i++) {
    const c = combos[i];
    setStatus(`수집 중 ${i + 1}/${combos.length} — ${c.locale} / ${c.cur} (쿠키 초기화)`);
    const url = buildVariant(srcUrl, c.locale, c.cur);
    let scraped = null;
    try {
      await clearAgodaCookies(); // 시크릿 모드: 이전 선호 제거 후 접속
      scraped = await collect(url);
    } catch (e) {
      scraped = { error: String((e && e.message) || e) };
    }
    results.push({ ...c, url, ...scraped });
    render(results, fx); // 한 건씩 즉시 갱신
    if (i < combos.length - 1) await sleep(BETWEEN_DELAY);
  }

  setStatus(`완료 — ${combos.length}개 수집`);
}

// ── 탭 열고 가격 수집 ──
async function collect(url) {
  const tab = await chrome.tabs.create({ url, active: false });
  try {
    await waitForLoad(tab.id, LOAD_TIMEOUT);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: scrapePrice,
      args: [SCRAPE_TIMEOUT],
    });
    return res?.result || { error: "가격을 찾지 못함" };
  } finally {
    try { await chrome.tabs.remove(tab.id); } catch (e) {}
  }
}

// 아고다 쿠키 전부 삭제 → 저장된 언어/통화 선호가 URL을 덮어쓰지 못하게 함
async function clearAgodaCookies() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "agoda.com" });
    await Promise.all(
      cookies.map((c) => {
        const url =
          (c.secure ? "https://" : "http://") +
          c.domain.replace(/^\./, "") +
          c.path;
        return chrome.cookies.remove({ url, name: c.name });
      })
    );
  } catch (e) {}
}

function waitForLoad(tabId, timeout) {
  return new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      chrome.tabs.onUpdated.removeListener(listener);
      resolve();
    };
    const listener = (id, info) => {
      if (id === tabId && info.status === "complete") finish();
    };
    chrome.tabs.onUpdated.addListener(listener);
    setTimeout(finish, timeout);
  });
}

// ── 페이지 안에서 실행되는 가격 추출기 (직렬화되어 주입됨) ──
async function scrapePrice(timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  function parseMoney(text) {
    if (!text) return null;
    const symbolMap = {
      "₩": "KRW", "￦": "KRW", "€": "EUR", "£": "GBP", "฿": "THB",
      "₫": "VND", "₱": "PHP", "₹": "INR", "¥": "JPY", "$": "USD",
    };
    let cur = null;
    const code = text.match(
      /\b(KRW|USD|JPY|SGD|EUR|GBP|HKD|THB|TWD|CNY|AUD|VND|IDR|MYR|PHP|INR|NZD|CAD|CHF|RUB)\b/
    );
    if (code) cur = code[1];
    if (!cur) for (const s in symbolMap) if (text.includes(s)) { cur = symbolMap[s]; break; }
    const num = text.replace(/[^\d.,]/g, "");
    const m = num.match(/\d[\d.,]*/);
    if (!m) return null;
    const value = parseAmount(m[0]);
    if (value == null || !isFinite(value) || value <= 0) return null;
    return { price: value, currency: cur, raw: text.trim().slice(0, 40) };
  }

  // 숫자 구분자 자동 판별: "1,234.56"(미국), "1.234,56"(유럽), "1.234.567"(베트남) 모두 처리
  function parseAmount(s) {
    const lastComma = s.lastIndexOf(",");
    const lastDot = s.lastIndexOf(".");
    let decimalSep = null;
    if (lastComma !== -1 && lastDot !== -1) {
      decimalSep = lastComma > lastDot ? "," : "."; // 더 뒤에 오는 쪽이 소수점
    } else if (lastComma !== -1) {
      decimalSep = guessSingle(s, ",");
    } else if (lastDot !== -1) {
      decimalSep = guessSingle(s, ".");
    }
    let cleaned;
    if (decimalSep) {
      const thousands = decimalSep === "," ? "." : ",";
      cleaned = s.split(thousands).join("").replace(decimalSep, ".");
    } else {
      cleaned = s.replace(/[.,]/g, ""); // 구분자 전부 천단위 → 제거
    }
    const v = parseFloat(cleaned);
    return isFinite(v) ? v : null;
  }

  // 구분자가 한 종류만 있을 때: 소수점인지 천단위인지 추정
  function guessSingle(s, sep) {
    const parts = s.split(sep);
    if (parts.length > 2) return null;           // 여러 번 등장 → 천단위
    const after = parts[1] || "";
    return after.length === 1 || after.length === 2 ? sep : null; // 1~2자리면 소수점
  }

  function tryDom() {
    // 실측 검증된 선택자 우선(시작가). 나머지는 DOM 변경 대비 폴백.
    const selectors = [
      '[data-element-name="cheapest-room-price-property-nav-bar"]',
      '[data-selenium="display-price"]',
      '[data-selenium="hotel-room-price"]',
      '[data-element-name="final-price"]',
      ".PropertyPriceDisplay",
      ".pd-price",
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      if (el) {
        const p = parseMoney(el.textContent);
        if (p) return p;
      }
    }
    return null;
  }

  function tryJsonLd() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const arr = Array.isArray(data) ? data : [data];
        for (const d of arr) {
          const offer = d.offers || (d.makesOffer && d.makesOffer[0]) || null;
          const o = Array.isArray(offer) ? offer[0] : offer;
          if (o && (o.price || o.lowPrice)) {
            const value = parseFloat(o.price || o.lowPrice);
            if (isFinite(value) && value > 0) {
              return { price: value, currency: o.priceCurrency || null, raw: "json-ld" };
            }
          }
        }
      } catch (e) {}
    }
    return null;
  }

  function getCountry() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const arr = Array.isArray(data) ? data : [data];
        for (const d of arr) {
          const c = d && d.address && d.address.addressCountry;
          if (c) return typeof c === "object" ? (c.name || c.identifier) : c;
        }
      } catch (e) {}
    }
    return null;
  }

  const country = getCountry();
  while (Date.now() < deadline) {
    const r = tryDom() || tryJsonLd();
    if (r) return { ...r, country };
    await new Promise((res) => setTimeout(res, 500));
  }
  return { error: "가격 미발견(선택자 조정 필요)", country };
}

// ── URL 변형 ──
// 검색 조건만 유지하고 세션/POS 고정 파라미터는 버린다.
// (countryId·cid·tag·searchrequestid·ds 등이 남으면 초기 접속 컨텍스트가 가격에 달라붙음)
const KEEP_PARAMS = [
  "checkIn", "checkOut", "los", "adults", "children",
  "childAges", "rooms", "numberOfBedrooms",
];

function buildVariant(srcUrl, locale, currency) {
  const u = new URL(srcUrl);
  const parts = u.pathname.split("/");
  if (/^[a-z]{2}-[a-z]{2}$/i.test(parts[1] || "")) {
    parts[1] = locale;
  } else {
    parts.splice(1, 0, locale);
  }
  u.pathname = parts.join("/");

  const lower = KEEP_PARAMS.map((k) => k.toLowerCase());
  const out = new URLSearchParams();
  for (const [k, v] of u.searchParams) {
    const i = lower.indexOf(k.toLowerCase());
    if (i !== -1) out.set(KEEP_PARAMS[i], v); // 표준 표기로 정규화
  }
  out.set("finalPriceView", "1"); // 모든 변형 동일: 세금포함 최종가 기준
  out.set("currencyCode", currency);
  out.set("currency", currency);
  u.search = out.toString();
  return u.toString();
}

// URL 경로 끝의 국가코드 추출: ".../hotel/seoul-kr.html" → "KR"
function countryFromUrl(srcUrl) {
  try {
    const last = new URL(srcUrl).pathname.split("/").pop().replace(/\.html$/i, "");
    const m = last.match(/-([a-z]{2})$/i);
    return m ? m[1].toUpperCase() : null;
  } catch (e) {
    return null;
  }
}

function buildCombos(locales, currencies, full) {
  const seen = new Set();
  const out = [];
  const push = (locale, cur) => {
    const k = locale + "|" + cur;
    if (!seen.has(k)) { seen.add(k); out.push({ locale, cur }); }
  };
  if (full) {
    for (const l of locales) for (const c of currencies) push(l, c);
  } else {
    const base = currencies.includes("KRW") ? "KRW" : currencies[0];
    for (const l of locales) push(l, base);
    for (const c of currencies) push(locales[0], c);
  }
  return out;
}

// 국가코드(ISO) → 현지 로케일·통화
const COUNTRY = {
  JP: { locale: "ja-jp", currency: "JPY" },
  TH: { locale: "th-th", currency: "THB" },
  VN: { locale: "vi-vn", currency: "VND" },
  ID: { locale: "id-id", currency: "IDR" },
  MY: { locale: "ms-my", currency: "MYR" },
  SG: { locale: "en-sg", currency: "SGD" },
  HK: { locale: "zh-hk", currency: "HKD" },
  TW: { locale: "zh-tw", currency: "TWD" },
  CN: { locale: "zh-cn", currency: "CNY" },
  PH: { locale: "en-ph", currency: "PHP" },
  KR: { locale: "ko-kr", currency: "KRW" },
  US: { locale: "en-us", currency: "USD" },
  GB: { locale: "en-gb", currency: "GBP" },
  AU: { locale: "en-au", currency: "AUD" },
  NZ: { locale: "en-nz", currency: "NZD" },
  DE: { locale: "de-de", currency: "EUR" },
  FR: { locale: "fr-fr", currency: "EUR" },
  ES: { locale: "es-es", currency: "EUR" },
  IT: { locale: "it-it", currency: "EUR" },
  IN: { locale: "en-in", currency: "INR" },
  AE: { locale: "en-ae", currency: "AED" },
};

const NAME2CC = {
  japan: "JP", thailand: "TH", vietnam: "VN", "viet nam": "VN",
  indonesia: "ID", malaysia: "MY", singapore: "SG", "hong kong": "HK",
  taiwan: "TW", china: "CN", philippines: "PH", "south korea": "KR",
  korea: "KR", "united states": "US", usa: "US", america: "US",
  "united kingdom": "GB", uk: "GB", england: "GB", australia: "AU",
  "new zealand": "NZ", germany: "DE", france: "FR", spain: "ES",
  italy: "IT", india: "IN", "united arab emirates": "AE", uae: "AE",
};

function normalizeCountry(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  const up = s.toUpperCase();
  if (COUNTRY[up]) return up;
  return NAME2CC[s.toLowerCase()] || null;
}

// 할인은 통화가 아니라 언어(로케일=POS)로 걸린다는 실측에 따라,
// 통화는 KRW로 고정하고 다양한 로케일을 훑는다(환율 노이즈 없이 원화로 직접 비교).
const SWEEP_LOCALES = [
  "ko-kr", "en-us", "en-gb", "ja-jp", "zh-cn", "zh-tw",
  "th-th", "vi-vn", "id-id", "en-sg", "en-au",
];

function buildAutoCombos(cc) {
  const seen = new Set();
  const out = [];
  const add = (locale, cur) => {
    const k = locale + "|" + cur;
    if (!seen.has(k)) { seen.add(k); out.push({ locale, cur }); }
  };
  const FIX = "KRW"; // 통화 고정
  const locales = [...SWEEP_LOCALES];
  const local = cc && COUNTRY[cc]; // 숙소 현지 로케일도 포함
  if (local && !locales.includes(local.locale)) locales.unshift(local.locale);
  for (const l of locales) add(l, FIX);
  return out;
}

// ── 환율 ──
async function fetchRates() {
  const r = await fetch("https://open.er-api.com/v6/latest/USD");
  const j = await r.json();
  if (!j || !j.rates) throw new Error("rates 없음");
  return j.rates;
}

function toKRW(value, currency, rates) {
  if (!rates || !currency || !rates[currency] || !rates.KRW) return null;
  return value * (rates.KRW / rates[currency]);
}

// ── 출력 ──
function render(results, rates) {
  const tbody = $("results").querySelector("tbody");
  tbody.innerHTML = "";

  const enriched = results.map((r) => {
    const krw = (r.price && (r.currency || r.cur))
      ? toKRW(r.price, r.currency || r.cur, rates)
      : null;
    return { ...r, krw };
  });

  const valid = enriched.filter((r) => r.krw != null);
  const minKrw = valid.length ? Math.min(...valid.map((r) => r.krw)) : null;

  for (const r of enriched) {
    const tr = document.createElement("tr");
    const isBest = r.krw != null && r.krw === minKrw;
    if (isBest) tr.className = "best";

    const cur = r.currency || r.cur;
    const shown = r.price != null
      ? `${cur} ${Number(r.price).toLocaleString("en-US")}`
      : (r.raw || "");
    const disp = r.error
      ? `<td class="err" colspan="2">${esc(r.error)}</td>`
      : `<td title="${esc(r.raw || "")}">${esc(shown)}</td>
         <td>${r.krw != null ? fmtKRW(r.krw) : "—"}${isBest ? '<span class="badge">최저</span>' : ""}</td>`;

    tr.innerHTML = `
      <td>${esc(r.locale)}</td>
      <td>${esc(r.cur)}</td>
      ${disp}
      <td><a href="${esc(r.url)}" class="open-btn" data-url="${esc(r.url)}"
             title="아고다 쿠키를 비우고 해당 로케일/통화로 엽니다">열기</a></td>`;
    tbody.appendChild(tr);
  }

  tbody.querySelectorAll(".open-btn").forEach((a) => {
    a.addEventListener("click", async (e) => {
      e.preventDefault();
      await clearAgodaCookies();
      chrome.tabs.create({ url: a.dataset.url, active: true });
    });
  });

  $("results").hidden = false;
  if (rates) {
    $("fxnote").textContent =
      "원화 환산: 실시간 환율(open.er-api.com) 기준 · 아고다 자체 환전과 다를 수 있음";
  }
}

// ── 유틸 ──
function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }
function setStatus(s) { $("status").textContent = s; }
function fmtKRW(v) { return "₩" + Math.round(v).toLocaleString("ko-KR"); }
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
