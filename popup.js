function initializePriceSelects() {
  // 初始化宝石价格下拉菜单
  const gemSelect = document.getElementById("gemPriceSelect");
  for (let i = 190; i <= 210; i++) {
    const option = document.createElement("option");
    option.value = (i / 100).toFixed(2);
    option.textContent = `¥${(i / 100).toFixed(2)}`;
    gemSelect.appendChild(option);
  }

  // 初始化补充包价格下拉菜单
  const packSelect = document.getElementById("packPriceSelect");
  for (let i = 242; i <= 270; i++) {
    const option = document.createElement("option");
    option.value = (i / 100).toFixed(2);
    option.textContent = `¥${(i / 100).toFixed(2)}`;
    packSelect.appendChild(option);
  }
}

function renderPackLinks(packs) {
  const container = document.getElementById("packLinks");
  if (!container) return;

  container.replaceChildren();

  packs.forEach((pack) => {
    const item = document.createElement("div");
    item.className = "pack-item";

    const marketLink = document.createElement("a");
    marketLink.href = pack.href;
    marketLink.target = "_blank";
    marketLink.rel = "noopener noreferrer";
    marketLink.className = pack.deletedLine
      ? "pack-link strike-through"
      : "pack-link";
    marketLink.textContent = `${pack.name} [${pack.cardNum}]`;
    item.appendChild(marketLink);

    if (pack.link) {
      const craftLink = document.createElement("a");
      craftLink.href = pack.link;
      craftLink.target = "_blank";
      craftLink.rel = "noopener noreferrer";
      craftLink.className = "pack-craft-link";
      craftLink.style.fontSize = "10px";
      craftLink.textContent = "合成";
      item.appendChild(craftLink);
    }

    container.appendChild(item);
  });
}

let packsCache = [];
let pageMarketQuote = {
  highPrice: 0,
  lowPrice: 0,
};

function getListingAppId(href) {
  const match = decodeURIComponent(String(href || "")).match(
    /\/listings\/753\/(\d+)-/i
  );
  return match ? match[1] : "";
}

function calcValueDiscount(gemPrice, gemAmount, packPrice) {
  if (!gemPrice || !gemAmount || !packPrice) return null;
  return ((gemPrice * (gemAmount / 1000)) / (packPrice / 1.15)) * 100;
}

function extractMarketPricesFromPage() {
  function parsePrice(text) {
    const match = String(text || "")
      .replace(/,/g, "")
      .match(/[¥￥$€]\s*(\d+(?:\.\d+)?)/);
    return match ? parseFloat(match[1]) : 0;
  }

  function classify(text) {
    const value = String(text || "");
    if (/起价|starting at/i.test(value)) return "high";
    if (/或更低价格购买|购买的请求|or lower|or less/i.test(value)) return "low";
    return "";
  }

  const found = [];
  document.querySelectorAll("span").forEach((span) => {
    const children = [...span.children];
    const childSpans = children.filter((el) => el.tagName === "SPAN");
    if (childSpans.length < 2) return;

    let price = 0;
    for (let i = childSpans.length - 1; i >= 0; i--) {
      price = parsePrice(childSpans[i].textContent);
      if (price) break;
    }
    if (!price) return;

    found.push({
      price,
      kind: classify(span.textContent),
      exactTwo: children.length === 2 && childSpans.length === 2,
    });
  });

  const prefer = found.filter((item) => item.exactTwo);
  const pool = prefer.length ? prefer : found;
  let highPrice = 0;
  let lowPrice = 0;

  pool.forEach((item) => {
    if (item.kind === "high" && !highPrice) highPrice = item.price;
    if (item.kind === "low" && !lowPrice) lowPrice = item.price;
  });

  if (!highPrice || !lowPrice) {
    const bodyText = document.body?.innerText || "";
    if (!highPrice) {
      const sellMatch = bodyText.match(
        /(?:出售中[\s\S]{0,30})?起价[\s\S]{0,12}[¥￥]\s*(\d+(?:\.\d+)?)/
      );
      if (sellMatch) highPrice = parseFloat(sellMatch[1]);
    }
    if (!lowPrice) {
      const buyMatch = bodyText.match(
        /[¥￥]\s*(\d+(?:\.\d+)?)[\s\S]{0,12}或更低价格购买/
      );
      if (buyMatch) lowPrice = parseFloat(buyMatch[1]);
    }
  }

  if ((!highPrice || !lowPrice) && pool.length >= 2) {
    const prices = pool.map((item) => item.price);
    if (!highPrice) highPrice = Math.max(...prices);
    if (!lowPrice) lowPrice = Math.min(...prices);
  }

  return { highPrice, lowPrice };
}

function isMarketListingUrl(url) {
  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === "steamcommunity.com" &&
      parsed.pathname.startsWith("/market/listings")
    );
  } catch {
    return false;
  }
}

async function copyTextToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return;
  } catch (error) {
    console.warn("navigator.clipboard 不可用，尝试降级复制:", error);
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();
  if (!copied) {
    throw new Error("复制到剪贴板失败");
  }
}

function setAddPackStatus(message, type) {
  const status = document.getElementById("addPackStatus");
  if (!status) return;
  status.hidden = !message;
  status.textContent = message || "";
  status.classList.remove("success", "error");
  if (type) status.classList.add(type);
}

function extractPackFromPage() {
  const url = window.location.href.split("#")[0].split("?")[0];
  const match = url.match(/\/market\/listings\/753\/(\d+)-(.+)$/i);
  if (!match) {
    return { error: "not_item" };
  }

  const appid = match[1];
  const href = `https://steamcommunity.com/market/listings/753/${match[1]}-${match[2]}`;
  const decodedPathName = decodeURIComponent(match[2].replace(/\+/g, " "));
  const itemName =
    document.getElementById("largeiteminfo_item_name")?.textContent?.trim() ||
    decodedPathName;

  const isBooster =
    /booster\s*pack/i.test(itemName) ||
    itemName.includes("补充包") ||
    /booster\s*pack/i.test(decodedPathName);

  if (!isBooster) {
    return { error: "not_booster" };
  }

  function hasChinese(text) {
    return /[\u4e00-\u9fff]/.test(text || "");
  }

  function isJunkName(text) {
    return (
      !text ||
      /^steam$/i.test(text) ||
      /社区市场/.test(text) ||
      /^(商店|社区|市场|库存|首页|讨论|创意工坊|支持|关于)$/.test(text) ||
      /含有来自|集换式卡牌|出售中|购买的请求|上架信息/.test(text)
    );
  }

  function cleanPackName(text) {
    let value = String(text || "").replace(/\s+/g, " ").trim();
    if (value.includes("::")) {
      value = value.split("::").pop().trim();
    }
    if (value.includes(">")) {
      value = value.split(">").pop().trim();
    }
    return value
      .replace(/^Listings for\s+/i, "")
      .replace(/\s*的上架信息.*$/i, "")
      .replace(/[【\[\]]/g, " ")
      .replace(/Booster Pack/gi, " ")
      .replace(/补充包/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function namesFromPackTitle(text) {
    const value = String(text || "").replace(/\s+/g, " ").trim();
    if (!value || !value.includes("补充包")) return [];

    const names = [];
    const bracket = value.match(/[【\[]\s*([^【】\[\]]+?)\s*补充包\s*[】\]]/);
    if (bracket) names.push(cleanPackName(bracket[1]));

    const labeled = value.match(
      /([\u4e00-\u9fff][\u4e00-\u9fffA-Za-z0-9：:·\-—&' ]{0,30}?)\s*补充包/
    );
    if (labeled && !labeled[1].trim().startsWith("补充包")) {
      names.push(cleanPackName(labeled[1]));
    }

    return names.filter((name) => name && !isJunkName(name) && hasChinese(name));
  }

  function findChinesePackTitles() {
    const names = [];
    const seen = new Set();
    const add = (name) => {
      if (!name || seen.has(name)) return;
      seen.add(name);
      names.push(name);
    };

    const shortNodes = document.querySelectorAll("h1, h2, h3, title, span, a");
    shortNodes.forEach((node) => {
      const text = (node.textContent || "").replace(/\s+/g, " ").trim();
      if (!text || text.length > 80) return;
      namesFromPackTitle(text).forEach(add);
    });

    if (!names.length) {
      namesFromPackTitle(document.title).forEach(add);
      namesFromPackTitle(document.body?.innerText?.slice(0, 2500)).forEach(add);
    }

    return names;
  }

  function collectFallbackNames() {
    const titles = [];
    const push = (value) => {
      const cleaned = cleanPackName(value);
      if (cleaned && !isJunkName(cleaned)) titles.push(cleaned);
    };

    document
      .querySelectorAll(`a[href*="store.steampowered.com/app/${appid}"]`)
      .forEach((link) => push(link.textContent));
    document
      .querySelectorAll(`a[href*="/app/${appid}"]`)
      .forEach((link) => push(link.textContent));
    document.querySelectorAll("h1").forEach((heading) => push(heading.textContent));
    push(document.title);
    push(document.querySelector('meta[property="og:title"]')?.content);
    push(document.getElementById("largeiteminfo_game_name")?.textContent);
    push(document.getElementById("largeiteminfo_item_name")?.textContent);
    push(document.querySelector(".market_listing_nav")?.textContent);
    push(itemName);
    push(decodedPathName);
    return titles;
  }

  function pickPackName() {
    const chineseTitles = findChinesePackTitles().filter(hasChinese);
    if (chineseTitles.length) return chineseTitles[0];

    const fallbacks = collectFallbackNames();
    return fallbacks.find(hasChinese) || fallbacks[0] || "";
  }

  const name = pickPackName();

  function countDirectListItems(ul) {
    return ul.querySelectorAll(":scope > li").length;
  }

  function collectCardNumCandidates() {
    const candidates = [];

    document.querySelectorAll("div").forEach((div) => {
      const children = [...div.children];
      for (let i = 0; i < children.length; i++) {
        if (children[i].tagName !== "UL") continue;

        const hasSpanBefore = children
          .slice(0, i)
          .some((el) => el.tagName === "SPAN");
        const hasSpanAfter = children
          .slice(i + 1)
          .some((el) => el.tagName === "SPAN");
        if (!hasSpanBefore || !hasSpanAfter) continue;

        const count = countDirectListItems(children[i]);
        if (count > 0) {
          candidates.push({
            count,
            adjacent:
              children[i - 1]?.tagName === "SPAN" &&
              children[i + 1]?.tagName === "SPAN",
          });
        }
      }
    });

    return candidates;
  }

  function getCardNumFromPage() {
    const candidates = collectCardNumCandidates();
    if (!candidates.length) return 0;

    const adjacent = candidates.filter((item) => item.adjacent);
    const pool = adjacent.length ? adjacent : candidates;
    const typical = pool.filter((item) => item.count >= 5 && item.count <= 15);
    return (typical[0] || pool[0]).count;
  }

  async function getCardNumFromApi() {
    const api =
      "https://steamcommunity.com/market/search/render/" +
      `?start=0&count=1&norender=1&search_descriptions=0&appid=753` +
      `&category_753_Game[]=tag_app_${appid}` +
      `&category_753_item_class[]=tag_item_class_2` +
      `&category_753_cardborder[]=tag_cardborder_0`;
    const response = await fetch(api);
    const data = await response.json();
    return Number(data.total_count) || 0;
  }

  return (async () => {
    let cardNum = getCardNumFromPage();
    if (!cardNum) {
      try {
        cardNum = await getCardNumFromApi();
      } catch (error) {
        cardNum = 0;
      }
    }

    return {
      href,
      deletedLine: false,
      name,
      cardNum,
      link: `https://steamcommunity.com/tradingcards/boostercreator/#${appid}`,
    };
  })();
}

function getCopyPageError() {
  if (typeof chrome === "undefined" || !chrome.runtime?.id) {
    return "请点击浏览器工具栏里的插件图标打开，不要直接用浏览器打开 popup.html";
  }
  if (!chrome.scripting?.executeScript) {
    return "页面读取权限未生效，请打开 chrome://extensions，找到「卡包计算器」后点击「重新加载」";
  }
  if (!chrome.tabs?.query) {
    return "标签页权限未生效，请打开 chrome://extensions 重新加载本插件";
  }
  return "";
}

async function addCurrentListingPack() {
  const button = document.getElementById("addPackBtn");
  if (button) button.disabled = true;
  setAddPackStatus("正在读取当前页面…", "");

  try {
    const setupError = getCopyPageError();
    if (setupError) {
      throw new Error(setupError);
    }

    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id || !tab.url) {
      throw new Error("无法获取当前标签页，请刷新 Steam 页面后重试");
    }

    if (!isMarketListingUrl(tab.url)) {
      throw new Error(
        "当前不是 Steam 市场页，请打开 steamcommunity.com/market/listings 下的补充包商品页"
      );
    }

    let result;
    try {
      const injected = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: extractPackFromPage,
      });
      result = injected?.[0]?.result;
    } catch (error) {
      throw new Error("无法读取当前页面，请刷新 Steam 市场页后重试");
    }

    if (!result || result.error === "not_item") {
      throw new Error(
        "请打开具体的补充包商品页（地址类似 /market/listings/753/游戏ID-名称）"
      );
    }
    if (result.error === "not_booster") {
      throw new Error("当前商品不是补充包，请打开 Booster Pack 页面");
    }
    if (result.error) {
      throw new Error("无法从当前页面提取补充包信息");
    }

    const pack = {
      href: result.href,
      deletedLine: false,
      name: result.name,
      cardNum: result.cardNum,
      link: result.link,
    };

    await copyTextToClipboard(JSON.stringify(pack, null, 2) + ",");
    setAddPackStatus(
      `已复制「${pack.name}」到剪贴板，请自行粘贴到 packs.json`,
      "success"
    );
  } catch (error) {
    console.error("添加当前页补充包失败:", error);
    setAddPackStatus(error.message || "添加失败", "error");
  } finally {
    if (button) button.disabled = false;
  }
}

async function loadPackLinks() {
  try {
    const response = await fetch("packs.json");
    if (!response.ok) {
      throw new Error(`加载 packs.json 失败: ${response.status}`);
    }
    const packs = await response.json();
    packsCache = Array.isArray(packs) ? packs : [];
    renderPackLinks(packsCache);
  } catch (error) {
    console.error("加载热门补充包失败:", error);
  }
}

function applyCardNum(cardNum) {
  if (!cardNum) return false;
  const radio = document.getElementById(`card${cardNum}`);
  if (!radio) return false;
  radio.checked = true;
  return true;
}

async function restoreStoredInputs() {
  if (!chrome?.storage?.local) return;

  const result = await chrome.storage.local.get([
    "cardCount",
    "gemPrice",
    "packPrice",
  ]);
  const error = chrome.runtime.lastError;
  if (error) {
    console.error("Error restoring data:", error);
    return;
  }

  if (result.cardCount) {
    const radio = document.querySelector(
      `input[name="cardCount"][value="${result.cardCount}"]`
    );
    if (radio) radio.checked = true;
  }
  if (result.gemPrice) {
    document.getElementById("gemPrice").value = result.gemPrice;
  }
  if (result.packPrice) {
    document.getElementById("packPrice").value = result.packPrice;
    updateActualPrice(result.packPrice);
  }
}

async function loadPageMarketQuote() {
  pageMarketQuote = { highPrice: 0, lowPrice: 0 };
  if (getCopyPageError()) return;

  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    if (!tab?.id || !tab.url || !isMarketListingUrl(tab.url)) return;

    const appId = getListingAppId(tab.url);
    const matched = packsCache.find(
      (pack) => getListingAppId(pack.href) === appId
    );
    if (matched) {
      applyCardNum(matched.cardNum);
    }

    const injected = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: extractMarketPricesFromPage,
    });
    const prices = injected?.[0]?.result;
    pageMarketQuote = {
      highPrice: Number(prices?.highPrice) || 0,
      lowPrice: Number(prices?.lowPrice) || 0,
    };
  } catch (error) {
    console.warn("读取当前页市场价格失败:", error);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  initializePriceSelects();

  document.getElementById("addPackBtn")?.addEventListener("click", addCurrentListingPack);

  // 监听所有输入变化
  const inputs = document.querySelectorAll('input[type="number"]');
  inputs.forEach((input) => {
    input.addEventListener("input", function () {
      if (this.value < 0) this.value = 0;

      // 实时计算到手价格
      if (this.id === "packPrice") {
        updateActualPrice(this.value);
      }

      updateDiscountRate();
      autoCalculate();
    });
  });

  // 监听单选框变化
  const radioInputs = document.querySelectorAll('input[type="radio"]');
  radioInputs.forEach((radio) => {
    radio.addEventListener("change", autoCalculate);
  });

  // 下拉菜单事件监听
  document
    .getElementById("gemPriceSelect")
    .addEventListener("change", function () {
      if (this.value) {
        document.getElementById("gemPrice").value = this.value;
        updateDiscountRate();
        autoCalculate();
      }
    });

  document
    .getElementById("packPriceSelect")
    .addEventListener("change", function () {
      if (this.value) {
        document.getElementById("packPrice").value = this.value;
        updateActualPrice(this.value);
        updateDiscountRate();
        autoCalculate();
      }
    });

  // 清除按钮功能
  document.querySelectorAll(".clear-input").forEach((button) => {
    button.addEventListener("click", function () {
      const inputId = this.getAttribute("data-for");
      const input = document.getElementById(inputId);
      if (input) {
        input.value = "";

        if (inputId === "packPrice") {
          updateActualPrice("");
        }

        updateDiscountRate();
        autoCalculate();
      }
    });
  });

  loadPackLinks()
    .then(restoreStoredInputs)
    .then(loadPageMarketQuote)
    .then(() => {
      updateDiscountRate();
      autoCalculate();
      calculateGemCost();
      calculateProfit();
    });
});

// 更新折扣率计算函数
function updateDiscountRate() {
  const gemPrice = parseFloat(document.getElementById("gemPrice").value) || 0;
  const packPrice = parseFloat(document.getElementById("packPrice").value) || 0;

  let discountRate = 0;
  if (packPrice > 0) {
    // 计算折扣率 = (宝石市场价格 / (补充包市场价格 / 1.15)) * 100
    discountRate = (gemPrice / (packPrice / 1.15)) * 100;
  }

  document.getElementById("discountRate").textContent =
    discountRate > 0 ? `${discountRate.toFixed(2)}%` : "0%";
}

// 添加实时计算到手价格的函数
function updateActualPrice(marketPrice) {
  const actualPrice = marketPrice
    ? (parseFloat(marketPrice) / 1.15).toFixed(2)
    : "0.00";
  const actualPriceElement = document.getElementById("actualPrice");
  if (actualPriceElement) {
    actualPriceElement.textContent = `¥${actualPrice}元`;
  }
}

// 修改存储工具函数
function saveToStorage(data) {
  if (!chrome?.storage?.local) {
    console.error("Chrome storage API not available");
    return;
  }

  chrome.storage.local.set(data, () => {
    const error = chrome.runtime.lastError;
    if (error) {
      console.error("Storage error:", error);
    } else {
      console.log("Data saved successfully:", data);
    }
  });
}

// 添加计算利润的函数
function calculateProfit() {
  const actualPrice =
    parseFloat(
      document
        .getElementById("actualPrice")
        .textContent.replace("¥", "")
        .replace("元", "")
    ) || 0;
  const gemCost =
    parseFloat(
      document
        .getElementById("gemCost")
        .textContent.replace("¥", "")
        .replace("元", "")
    ) || 0;

  const cardCount =
    parseFloat(
      document.querySelector('input[name="cardCount"]:checked')?.value
    ) || 0;
  const profit = actualPrice - gemCost;
  document.getElementById("profitValue").textContent = `¥${profit.toFixed(
    2
  )}元`;
}

// 在适当的事件中调用 calculateProfit，例如在输入框或单选框变化时
document.getElementById("packPrice").addEventListener("input", function () {
  updateActualPrice(this.value);
  calculateProfit(); // 计算利润
});

document.getElementById("gemPrice").addEventListener("input", calculateProfit);
document.querySelectorAll('input[name="cardCount"]').forEach((input) => {
  input.addEventListener("change", calculateProfit);
});

// 自动计算函数
function autoCalculate() {
  const cardCount =
    parseFloat(
      document.querySelector('input[name="cardCount"]:checked')?.value
    ) || 0;
  const gemPrice = parseFloat(document.getElementById("gemPrice").value) || 0;
  const packPrice = parseFloat(document.getElementById("packPrice").value) || 0;
  const hasRange =
    gemPrice &&
    cardCount &&
    (pageMarketQuote.highPrice > 0 || pageMarketQuote.lowPrice > 0);

  if (!cardCount || !gemPrice || !packPrice) {
    if (hasRange) {
      showResult(null);
    } else {
      hideResult();
    }
    return;
  }

  saveToStorage({
    cardCount: cardCount,
    gemPrice: gemPrice,
    packPrice: packPrice,
  });

  const total = ((gemPrice * (cardCount / 1000)) / (packPrice / 1.15)) * 100;
  showResult(total);
  calculateProfit();
}

function formatDiscount(value, price) {
  const discountText = value == null ? "--" : `${value.toFixed(2)}折`;
  const priceText = price > 0 ? `（¥${price.toFixed(2)}）` : "";
  return `<span class="result-range-number">${discountText}${priceText}</span>`;
}

function renderRangeLine() {
  const gemPrice = parseFloat(document.getElementById("gemPrice").value) || 0;
  const gemAmount =
    parseFloat(
      document.querySelector('input[name="cardCount"]:checked')?.value
    ) || 0;
  const highDiscount = calcValueDiscount(
    gemPrice,
    gemAmount,
    pageMarketQuote.highPrice
  );
  const lowDiscount = calcValueDiscount(
    gemPrice,
    gemAmount,
    pageMarketQuote.lowPrice
  );

  if (highDiscount == null && lowDiscount == null) return "";

  return `<div class="result-range">最高性价比折扣：${formatDiscount(
    highDiscount,
    pageMarketQuote.highPrice
  )}　最低性价比折扣：${formatDiscount(
    lowDiscount,
    pageMarketQuote.lowPrice
  )}</div>`;
}

function showResult(total) {
  const resultDiv = document.getElementById("result");
  resultDiv.style.display = "block";
  const main =
    total == null
      ? ""
      : `
      <span class="result-label">性价比折扣：</span>
      <span class="result-number">${total.toFixed(2)}折</span>
    `;
  resultDiv.innerHTML = `
    <div class="result-value">
      ${main}
      ${renderRangeLine()}
    </div>
  `;
}

function hideResult() {
  const resultDiv = document.getElementById("result");
  resultDiv.style.display = "none";
}

function calculateGemCost() {
  const gemPrice = parseFloat(document.getElementById("gemPrice").value) || 0;
  const cardCount =
    parseFloat(
      document.querySelector('input[name="cardCount"]:checked')?.value
    ) || 0;

  const gemCost = gemPrice * (cardCount / 1000);
  document.getElementById("gemCost").textContent = `¥${gemCost.toFixed(2)}元`;
}

// 在适当的事件中调用 calculateGemCost，例如在输入框或单选框变化时
document.getElementById("gemPrice").addEventListener("input", calculateGemCost);
document.querySelectorAll('input[name="cardCount"]').forEach((input) => {
  input.addEventListener("change", calculateGemCost);
});
