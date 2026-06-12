// 아고다 가격 비교기 — 팝업(런처)
// 입력값을 job으로 저장하고 새 창(results.html)을 열어 거기서 수집·표시한다.

const $ = (id) => document.getElementById(id);

(async function init() {
  const stored = await chrome.storage.local.get(["locales", "currencies", "full", "auto"]);
  if (stored.locales) $("locales").value = stored.locales;
  if (stored.currencies) $("currencies").value = stored.currencies;
  if (stored.full) $("full").checked = stored.full;
  if (typeof stored.auto === "boolean") $("auto").checked = stored.auto;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && /:\/\/www\.agoda\.com\//.test(tab.url)) {
    $("url").value = tab.url;
  }
})();

$("start").addEventListener("click", launch);

async function launch() {
  const srcUrl = $("url").value.trim();
  if (!/agoda\.com\//.test(srcUrl)) {
    $("status").textContent = "아고다 URL을 입력하세요.";
    return;
  }

  const job = {
    srcUrl,
    locales: splitList($("locales").value),
    currencies: splitList($("currencies").value),
    full: $("full").checked,
    auto: $("auto").checked,
  };

  await chrome.storage.local.set({
    job,
    locales: $("locales").value,
    currencies: $("currencies").value,
    full: job.full,
    auto: job.auto,
  });

  await chrome.windows.create({
    url: chrome.runtime.getURL("results.html"),
    type: "popup",
    width: 600,
    height: 760,
  });

  window.close(); // 팝업 닫기 — 작업은 새 창에서 계속
}

function splitList(s) {
  return s.split(",").map((x) => x.trim()).filter(Boolean);
}
