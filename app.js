"use strict";
// ה-CFO שלי — סוכן פיננסי אישי לפי ה-AI Wealth Guide.
// כל הנתונים נשמרים ב-localStorage בלבד. הסוכן קורא ומחשב; המשתמש מחליט ופועל.

const KEY = "cfo-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

// ---------- state ----------
const DEFAULT = {
  tx: [], rules: {}, keys: {}, leakAct: {}, checklist: {}, debts: [],
  settings: {}, apiKey: "", chat: []
};
let S = load();
function load() {
  try { return Object.assign(structuredClone(DEFAULT), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { return structuredClone(DEFAULT); }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch { toast("שגיאה בשמירה — ייתכן שהאחסון מלא"); }
}

// ---------- helpers ----------
const ILS = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });
const money = (n) => (n < 0 ? "-" : "") + "₪" + ILS.format(Math.abs(Math.round(n || 0)));
const pct = (n, d = 1) => (n * 100).toFixed(d) + "%";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2400);
}
const HE_MONTHS = ["ינו׳", "פבר׳", "מרץ", "אפר׳", "מאי", "יוני", "יולי", "אוג׳", "ספט׳", "אוק׳", "נוב׳", "דצמ׳"];
const monthLabel = (ym) => { const [y, m] = ym.split("-"); return HE_MONTHS[+m - 1] + " " + y.slice(2); };

// ---------- categories ----------
const CATS = {
  income: "הכנסה", housing: "דיור", food: "מזון", transport: "תחבורה", kids: "ילדים/חינוך",
  health: "בריאות", insurance: "ביטוח", subs: "מנויים ותקשורת", dining: "בילוי ומסעדות",
  shopping: "קניות", fees: "ריבית ועמלות", savings: "חיסכון והשקעות", other: "אחר",
  card: "חיוב כרטיס (כפילות)", transfer: "העברה בין חשבונות"
};
const EXCLUDED = new Set(["card", "transfer"]);
const NON_SPEND = new Set(["income", "savings", "card", "transfer"]);
// order matters: first match wins
const KW = [
  ["fees", "עמלה,עמלת,ריבית,דמי כרטיס,ריבית חובה,commission,fee,דמי טיפול,דמי ניהול חשבון"],
  ["card", "ישראכרט,isracard,מקס איט,max it,לאומי קארד,כאל,cal,ויזה כאל,אמריקן אקספרס,american express,דיינרס,חיוב כרטיס,כרטיסי אשראי"],
  ["savings", "פיקדון,פקדון,קרן השתלמות,קופת גמל,גמל להשקעה,ניירות ערך,ני\"ע,מניות,אקסלנס,מיטב,פסגות,interactive brokers,חיסכון"],
  ["income", "משכורת,שכר עבודה,ביטוח לאומי גמלה,קצבת,החזר מס"],
  ["insurance", "ביטוח,הראל,מגדל,כלל,הפניקס,מנורה,איילון,הכשרה,ליברה,wesure,ווישור,aig,שומרה"],
  ["subs", "netflix,נטפליקס,spotify,ספוטיפיי,apple.com,icloud,youtube,disney,hbo,yes,הוט,hot,פרטנר,partner,סלקום,cellcom,פלאפון,pelephone,גולן טלקום,golan,בזק,bezeq,חדר כושר,הולמס,holmes,גו אקטיב,openai,chatgpt,anthropic,claude.ai,microsoft,adobe,dropbox,sting,סטינג,we4g,xfone,019,012,017,google one,amazon prime"],
  ["housing", "שכר דירה,משכנתא,ארנונה,עיריית,עירית,חברת החשמל,חברת חשמל,חשמל,תאגיד מים,מי אביבים,הגיחון,מי שבע,מי כרמל,ועד בית,פזגז,אמישראגז,סופרגז,גז"],
  ["food", "שופרסל,רמי לוי,ויקטורי,יוחננוף,מגה,טיב טעם,אושר עד,חצי חינם,יינות ביתן,am:pm,סופר,מכולת,קרפור,carrefour,מעדני,מאפיית,מאפה,ירקות,פירות,קצביית,סטופ מרקט,פרש מרקט,מחסני השוק,קשת טעמים,נתיב החסד"],
  ["transport", "פז,דלק,סונול,ten,דור אלון,yellow,רב קו,רב-קו,מונית,gett,יאנגו,yango,רכבת ישראל,אגד,דן,חניון,חניה,פנגו,pango,cellopark,סלופארק,כביש 6,כביש חוצה,מוסך,צמיגים,moovit,מובייל פארק"],
  ["kids", "גן,צהרון,בית ספר,חוג,מעון,אוניברסיט,מכללה,צעצוע,שפיר"],
  ["health", "מכבי,כללית,מאוחדת,לאומית,סופר-פארם,סופר פארם,super-pharm,be,בית מרקחת,רופא,שיניים,אופטיקה,פיזיותרפ"],
  ["dining", "מסעדת,מסעדה,קפה,cafe,coffee,ארומה,לנדוור,גרג,מקדונלד,mcdonald,בורגר,burger,פיצה,pizza,wolt,וולט,10bis,תן ביס,סושי,שווארמה,בר,פאב,סינמה,קולנוע,cinema,eventim,booking,airbnb,אל על,elal,ryanair,wizz,easyjet,מלון,hotel"],
  ["shopping", "אמזון,amazon,aliexpress,עלי אקספרס,shein,שיין,איקאה,ikea,זארה,zara,h&m,קסטרו,fox,פוקס,ace,אייס,ksp,באג,bug,ebay,next,terminal x,טרמינל,מחסני חשמל,שקם אלקטריק,גולף,רנואר,nike,נייקי,adidas,אדידס,המשביר"]
].map(([c, s]) => [c, s.split(",").map((k) => k.trim().toLowerCase())]);

const words = (s) => s.split(/[^\p{L}\p{N}&.:+"-]+/u).filter(Boolean);
function matchKw(text, kw) {
  if (kw.length <= 3) return words(text).includes(kw);
  return text.includes(kw);
}
const mkey = (m) => String(m).toLowerCase().replace(/\d+/g, "").replace(/[*#\/\\_.,-]+/g, " ").replace(/\s+/g, " ").trim();
function autoCat(t) {
  const key = mkey(t.merchant);
  if (S.rules[key]) return S.rules[key];
  const text = String(t.merchant).toLowerCase();
  for (const [cat, kws] of KW) {
    if (kws.some((k) => matchKw(text, k))) {
      if (cat === "card" && t.src !== "bank") continue;
      if (cat === "income" && t.amount < 0) continue;
      return cat;
    }
  }
  if (t.amount > 0 && t.src === "bank") return "income";
  return "other";
}

// ---------- import ----------
let pending = null;
const HDR = {
  date: [/תאריך עסקה/, /תאריך רכישה/, /^תאריך$/, /תאריך/, /date/i],
  merchant: [/שם בית ה?עסק/, /בית עסק/, /תיאור|תאור/, /פרטים/, /הפעולה/, /description|merchant/i],
  amount: [/סכום חיוב|סכום החיוב/, /סכום בש"ח/, /^סכום/, /סכום/, /amount/i],
  debit: [/חובה|debit/i],
  credit: [/זכות|credit/i]
};
function strip(s) { return String(s ?? "").replace(/\d{6,}/g, "").replace(/\s+/g, " ").trim(); }
function parseAmount(v) {
  if (typeof v === "number") return v;
  let s = String(v ?? "").replace(/[₪\s,]/g, "").replace(/[‎‏]/g, "");
  if (!s) return NaN;
  let neg = false;
  if (/-$/.test(s)) { neg = true; s = s.slice(0, -1); }
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1); }
  const n = parseFloat(s);
  return neg ? -Math.abs(n) : n;
}
function parseDate(v) {
  if (v instanceof Date && !isNaN(v)) { const d = new Date(v.getTime() + 12 * 36e5); return iso(d.getFullYear(), d.getMonth() + 1, d.getDate()); }
  if (typeof v === "number" && v > 20000 && v < 80000) {
    const d = new Date(Math.round((v - 25569) * 864e5));
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }
  const s = String(v ?? "").trim();
  let m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{2,4})/);
  if (m) { let y = +m[3]; if (y < 100) y += 2000; return iso(y, +m[2], +m[1]); }
  m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return iso(+m[1], +m[2], +m[3]);
  return null;
}
function iso(y, m, d) {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

async function readFile(file) {
  const name = file.name.toLowerCase();
  if (name.endsWith(".csv")) {
    const buf = await file.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("�")) text = new TextDecoder("windows-1255").decode(buf);
    if (window.XLSX) {
      // raw: keep dd/mm/yyyy as text so it isn't misread as a US date
      const wb = XLSX.read(text, { type: "string", raw: true });
      return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    }
    return text.split(/\r?\n/).map((l) => l.split(","));
  }
  if (!window.XLSX) throw new Error("ספריית האקסל עוד נטענת — נסה שוב בעוד רגע");
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array", cellDates: true });
  // pick the sheet with the most rows
  let best = null;
  for (const n of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1, raw: true, defval: "" });
    if (!best || rows.length > best.length) best = rows;
  }
  return best || [];
}

function detect(rows) {
  let hi = 0, bestScore = -1;
  for (let i = 0; i < Math.min(rows.length, 40); i++) {
    const r = rows[i].map((c) => String(c));
    let score = 0;
    for (const res of Object.values(HDR)) if (r.some((c) => res.some((re) => re.test(c.trim())))) score++;
    if (score > bestScore) { bestScore = score; hi = i; }
  }
  const header = rows[hi].map((c) => String(c).trim());
  const find = (res, skip = []) => {
    for (const re of res) {
      const i = header.findIndex((c, j) => c && re.test(c) && !skip.includes(j));
      if (i >= 0) return i;
    }
    return -1;
  };
  const date = find(HDR.date);
  const merchant = find(HDR.merchant, [date]);
  const debit = find(HDR.debit);
  const credit = find(HDR.credit);
  const amount = find(HDR.amount, [date, merchant]);
  const mode = debit >= 0 && credit >= 0 ? "dc" : "amt";
  return { hi, header, date, merchant, amount, debit, credit, mode };
}

function showMapper(rows, src, fname) {
  const d = detect(rows);
  pending = { rows, src, fname, ...d };
  const opts = (sel) => `<option value="-1">—</option>` + d.header.map((h, i) => `<option value="${i}" ${i === sel ? "selected" : ""}>${esc(h || "עמודה " + (i + 1))}</option>`).join("");
  const sample = rows.slice(d.hi, d.hi + 6);
  $("#mapper").innerHTML = `
    <div class="result">
      <b>${esc(fname)}</b> · <span class="muted small">בדוק שהעמודות זוהו נכון</span>
      <div class="mapper-grid">
        <label>תאריך<select data-k="date">${opts(d.date)}</select></label>
        <label>בית עסק / תיאור<select data-k="merchant">${opts(d.merchant)}</select></label>
        <label>מבנה סכום<select data-k="mode"><option value="amt" ${d.mode === "amt" ? "selected" : ""}>עמודת סכום אחת</option><option value="dc" ${d.mode === "dc" ? "selected" : ""}>חובה / זכות</option></select></label>
        <label class="m-amt">סכום<select data-k="amount">${opts(d.amount)}</select></label>
        <label class="m-dc">חובה<select data-k="debit">${opts(d.debit)}</select></label>
        <label class="m-dc">זכות<select data-k="credit">${opts(d.credit)}</select></label>
      </div>
      ${src === "card" ? `<p class="muted small">בקובץ אשראי סכום חיובי נרשם כהוצאה, וסכום שלילי כזיכוי.</p>` : `<p class="muted small">בעמודת סכום אחת: שלילי = הוצאה. חיובי כרטיס האשראי בבנק יסומנו כ"כפילות" ולא ייספרו פעמיים.</p>`}
      <div class="preview"><table>${sample.map((r) => `<tr>${r.map((c) => `<td>${esc(c instanceof Date ? c.toLocaleDateString("he-IL") : c)}</td>`).join("")}</tr>`).join("")}</table></div>
      <div class="row"><button class="btn primary grow" id="do-import">ייבא</button><button class="btn" id="cancel-import">ביטול</button></div>
    </div>`;
  const sync = () => {
    const dc = $('[data-k="mode"]').value === "dc";
    $$(".m-dc").forEach((e) => (e.style.display = dc ? "" : "none"));
    $$(".m-amt").forEach((e) => (e.style.display = dc ? "none" : ""));
  };
  $('[data-k="mode"]').onchange = sync; sync();
  $("#cancel-import").onclick = () => { pending = null; $("#mapper").innerHTML = ""; };
  $("#do-import").onclick = doImport;
}

function doImport() {
  const g = (k) => $(`[data-k="${k}"]`).value;
  const c = { date: +g("date"), merchant: +g("merchant"), amount: +g("amount"), debit: +g("debit"), credit: +g("credit"), mode: g("mode") };
  if (c.date < 0 || c.merchant < 0 || (c.mode === "amt" ? c.amount < 0 : c.debit < 0 && c.credit < 0)) return toast("בחר עמודות תאריך, תיאור וסכום");
  const { rows, hi, src } = pending;
  const seen = {};
  let added = 0, skipped = 0;
  for (const r of rows.slice(hi + 1)) {
    const date = parseDate(r[c.date]);
    const merchant = strip(r[c.merchant]);
    let amount;
    if (c.mode === "dc") amount = (parseAmount(r[c.credit]) || 0) - (parseAmount(r[c.debit]) || 0);
    else { amount = parseAmount(r[c.amount]); if (src === "card") amount = -amount; }
    if (!date || !merchant || !isFinite(amount) || amount === 0) continue;
    amount = Math.round(amount * 100) / 100;
    const base = `${src}|${date}|${merchant}|${amount}`;
    seen[base] = (seen[base] || 0) + 1;
    const k = base + "#" + seen[base];
    if (S.keys[k]) { skipped++; continue; }
    S.keys[k] = 1;
    const t = { id: k, date, merchant, amount, src };
    t.cat = autoCat(t);
    S.tx.push(t); added++;
  }
  S.tx.sort((a, b) => b.date.localeCompare(a.date));
  save(); pending = null; $("#mapper").innerHTML = "";
  toast(`יובאו ${added} תנועות` + (skipped ? ` · ${skipped} כפולות דולגו` : ""));
  renderAll();
}

// ---------- analysis ----------
function analyze() {
  const tx = S.tx.filter((t) => !EXCLUDED.has(t.cat));
  const months = [...new Set(S.tx.map((t) => t.date.slice(0, 7)))].sort();
  const n = months.length || 1;
  const byMonth = Object.fromEntries(months.map((m) => [m, { income: 0, spend: 0, savings: 0, cats: {} }]));
  const catTot = {};
  for (const t of tx) {
    const M = byMonth[t.date.slice(0, 7)];
    if (t.cat === "income") M.income += t.amount;
    else if (t.cat === "savings") M.savings += -t.amount;
    else {
      M.spend += -t.amount;
      M.cats[t.cat] = (M.cats[t.cat] || 0) - t.amount;
      catTot[t.cat] = (catTot[t.cat] || 0) - t.amount;
    }
  }
  // merchant groups for spending
  const groups = {};
  for (const t of tx) {
    if (NON_SPEND.has(t.cat) || t.amount >= 0) continue;
    const k = mkey(t.merchant) || t.merchant;
    (groups[k] ||= { key: k, name: t.merchant, cat: t.cat, items: [] }).items.push(t);
  }
  let fixed = 0, variable = 0, yearly = 0;
  const recurring = [];
  for (const g of Object.values(groups)) {
    g.items.sort((a, b) => a.date.localeCompare(b.date));
    const amts = g.items.map((t) => -t.amount);
    const total = amts.reduce((a, b) => a + b, 0);
    const ms = new Set(g.items.map((t) => t.date.slice(0, 7)));
    const mean = total / amts.length;
    const sd = Math.sqrt(amts.reduce((a, b) => a + (b - mean) ** 2, 0) / amts.length);
    const cv = mean ? sd / mean : 1;
    g.months = ms.size; g.total = total; g.mean = mean;
    if (g.cat === "fees") continue;
    if (ms.size >= Math.max(3, 0.75 * n) && cv < 0.25) { fixed += total; g.kind = "fixed"; }
    else if (n >= 6 && ms.size <= 2 && mean >= 400) { yearly += total; g.kind = "yearly"; }
    else { variable += total; g.kind = "variable"; }
    // leaks = steady repeat charges (subscriptions, bills), not variable shopping like groceries
    const leakCat = !["housing", "food", "transport"].includes(g.cat);
    if (leakCat && ((ms.size >= 3 && (cv < 0.35 || ["subs", "insurance"].includes(g.cat))) || (g.cat === "subs" && ms.size >= 2))) {
      const perMonth = total / ms.size;
      const first = amts.slice(0, 2), last = amts.slice(-2);
      const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;
      const inc = avg(first) ? avg(last) / avg(first) - 1 : 0;
      recurring.push({ key: g.key, name: g.name, cat: g.cat, months: ms.size, perMonth, yearly: perMonth * 12, inc, last: amts[amts.length - 1], firstMonth: g.items[0].date.slice(0, 7) });
    }
  }
  recurring.sort((a, b) => b.yearly - a.yearly);
  const fees = catTot.fees || 0;
  const income = months.reduce((a, m) => a + byMonth[m].income, 0);
  const spend = months.reduce((a, m) => a + byMonth[m].spend, 0);
  const savings = months.reduce((a, m) => a + byMonth[m].savings, 0);
  return {
    months, n, byMonth, catTot, recurring, groups,
    avg: { income: income / n, spend: spend / n, savings: savings / n, fixed: fixed / n, variable: variable / n, yearly: yearly / n, fees: fees / n, free: (income - spend) / n }
  };
}
let A = analyze();

// ---------- calculators ----------
function sweepCalc() {
  const st = S.settings;
  const bal = num(st.swBalance), spend = num(st.swSpend) || A.avg.spend, fixedM = num(st.swFixed) || (A.avg.fixed + A.avg.yearly);
  const months = num(st.swMonths) || 4, cushion = st.swCushion === undefined ? 2000 : num(st.swCushion);
  const r = num(st.swRate ?? 3) / 100, infl = num(st.swInfl ?? 1.5) / 100;
  const buffer = spend + cushion;
  const emergency = fixedM * months;
  const idle = Math.max(0, bal - buffer);
  const toEmergency = Math.min(idle, emergency);
  const toPlanned = Math.max(0, idle - emergency);
  const depositNet = r * 0.85;
  const real = (1 + r) / (1 + infl) - 1;
  const mmfNet = r - 0.25 * Math.max(0, real);
  return { bal, spend, fixedM, buffer, emergency, idle, toEmergency, toPlanned, r, infl, depositNet, mmfNet, gainIdle: idle * (Math.max(depositNet, mmfNet) - 0.001) };
}
function pensionFV(bal, dep, fd, fs, years, R) {
  const g = Math.pow(1 + R, 1 / 12) - 1, f = fs / 12;
  let v = bal;
  for (let i = 0; i < years * 12; i++) v = v * (1 + g) * (1 - f) + dep * (1 - fd);
  return v;
}
function pensionCalc() {
  const st = S.settings;
  const bal = num(st.pnBal ?? 100000), dep = num(st.pnDep ?? 2000), fd = num(st.pnFd ?? 2) / 100, fs = num(st.pnFs ?? 0.5) / 100;
  const years = Math.max(0, 67 - num(st.pnAge ?? 35)), R = num(st.pnR ?? 7) / 100;
  const mine = pensionFV(bal, dep, fd, fs, years, R);
  const bench = pensionFV(bal, dep, 0.01, 0.0022, years, R);
  return { years, mine, bench, gap: bench - mine };
}
function debtPlan(extra) {
  const debts = S.debts.map((d) => ({ ...d, bal: num(d.balance), r: num(d.rate) / 100 / 12, min: num(d.min) }));
  if (!debts.length) return null;
  const sim = (extraPay) => {
    const ds = debts.map((d) => ({ ...d })).sort((a, b) => b.r - a.r);
    let interest = 0, m = 0;
    const order = [];
    while (ds.some((d) => d.bal > 0.5) && m < 600) {
      m++;
      let pool = extraPay;
      for (const d of ds) if (d.bal > 0) { const i = d.bal * d.r; interest += i; d.bal += i; }
      for (const d of ds) if (d.bal > 0) { const p = Math.min(d.min, d.bal); d.bal -= p; pool += d.min - p; }
      else pool += d.min;
      for (const d of ds) {
        if (d.bal <= 0 || pool <= 0) continue;
        const p = Math.min(pool, d.bal); d.bal -= p; pool -= p;
        if (d.bal <= 0.5 && !order.find((o) => o.name === d.name)) order.push({ name: d.name, month: m });
      }
      for (const d of ds) if (d.bal <= 0.5 && d.bal > -1 && !order.find((o) => o.name === d.name)) { d.bal = 0; order.push({ name: d.name, month: m }); }
    }
    return { months: m, interest, done: m < 600, order };
  };
  const yearlyNow = debts.reduce((a, d) => a + d.bal * d.r * 12, 0);
  return { yearlyNow, plan: sim(extra), base: sim(0) };
}

// ---------- render: home ----------
function renderHome() {
  const a = A.avg, has = S.tx.length > 0;
  $("#free-cash").textContent = has ? money(a.free) : "—";
  $("#free-cash-sub").textContent = has
    ? `ממוצע על ${A.n} חודשים · ${S.tx.length} תנועות` + (A.n < 12 ? ` · מומלץ 12 חודשים כדי לתפוס חיובים שנתיים` : "")
    : "ייבא 12 חודשי תנועות כדי לראות את המספר האמיתי";
  $("#profile-table").innerHTML = has ? [
    ["הכנסה נטו", a.income], ["הוצאות קבועות", -a.fixed], ["הוצאות משתנות", -a.variable],
    ["שנתיות / חריגות ÷ 12", -a.yearly], ["דליפות: ריבית ועמלות", -a.fees]
  ].map(([k, v]) => `<div class="lr"><span>${k}</span><span class="mono">${money(v)}</span></div>`).join("")
    + `<div class="lr total"><span>כסף פנוי</span><span class="mono ${a.free >= 0 ? "good" : "bad"}">${money(a.free)}</span></div>`
    + (a.savings ? `<div class="lr"><span class="muted">מתוכו כבר הולך לחיסכון</span><span class="mono">${money(a.savings)}</span></div>` : "")
    : "";
  renderAdvisor(); renderChecklist();
}

function renderAdvisor() {
  const acts = [];
  if (!S.tx.length) acts.push({ v: 1e9, t: "ייבא 12 חודשים של תנועות מהבנק ומכל כרטיס אשראי (לשונית תנועות). זה הבסיס לכל השאר." });
  const dp = debtPlan(num(S.settings.debtExtra));
  if (dp && dp.yearlyNow > 0) {
    const top = [...S.debts].sort((x, y) => num(y.rate) - num(x.rate))[0];
    acts.push({ v: dp.yearlyNow, t: `אתה משלם כ-${money(dp.yearlyNow)} ריבית בשנה. כל שקל פנוי קודם ל"${top.name}" (${top.rate}%) — זו תשואה מובטחת.` });
  }
  const sw = sweepCalc();
  if (sw.idle > 1000) acts.push({ v: sw.gainIdle, t: `${money(sw.idle)} יושבים בעו"ש מעל הכרית. בפיקדון / קרן כספית זה בערך ${money(sw.gainIdle)} בשנה. את ההעברה אתה עושה בעצמך.` });
  const cancel = A.recurring.filter((r) => S.leakAct[r.key] === "cancel");
  const cancelSum = cancel.reduce((x, r) => x + r.yearly, 0);
  if (cancel.length) acts.push({ v: cancelSum, t: `סימנת ${cancel.length} חיובים לביטול = ${money(cancelSum)} בשנה. בטל הוראות קבע באפליקציית הבנק.` });
  else if (A.recurring.length) {
    const unreviewed = A.recurring.filter((r) => !S.leakAct[r.key]);
    if (unreviewed.length) acts.push({ v: unreviewed.slice(0, 3).reduce((x, r) => x + r.yearly, 0) * 0.3, t: `יש ${unreviewed.length} חיובים חוזרים שעוד לא בדקת. הגדול: ${unreviewed[0].name} (${money(unreviewed[0].yearly)} בשנה).` });
  }
  const fees = (A.catTot.fees || 0) / A.n * 12;
  if (fees > 100) acts.push({ v: fees, t: `${money(fees)} בשנה על ריבית ועמלות בנק. בקש ביטול/הנחה, או עבור בנק (אונליין, 7 ימי עסקים, חינם).` });
  const pn = pensionCalc();
  if (S.settings.pnTouched && pn.gap > 1000) acts.push({ v: pn.gap / Math.max(1, pn.years), t: `דמי הניהול שלך עולים כ-${money(pn.gap)} עד גיל 67 לעומת קרן ברירת מחדל. שלח לקרן בקשה להורדה.` });
  const rv = reviewData();
  if (rv && rv.flags.length) acts.push({ v: rv.flags[0].diff * 3, t: `ב${monthLabel(rv.month)} "${CATS[rv.flags[0].cat]}" היה ${pct(rv.flags[0].ratio - 1, 0)} מעל הממוצע (${money(rv.flags[0].diff)}).` });
  if (S.tx.length && A.avg.free > 0 && !S.checklist.payfirst) acts.push({ v: A.avg.free * 12 * 0.8 * 0.03, t: `קבע הוראת קבע "שלם לעצמך קודם" ביום המשכורת: ${money(Math.floor(A.avg.free * 0.8 / 100) * 100)} לחודש.` });
  acts.sort((a, b) => b.v - a.v);
  $("#advisor").innerHTML = acts.slice(0, 5).map((a) => `<li>${esc(a.t)}</li>`).join("") || `<li>הכל נראה מסודר. תריץ את הבדיקה החודשית ב-1 לחודש.</li>`;
}

const PLAN = [
  ["שבוע 1 · לראות את האמת (שלבים 0–1)", [
    ["privacy", "לכבות אימון וזיכרון באפליקציית ה-AI", "agent"],
    ["export", "לייצא 12 חודשים: בנק + כל כרטיס אשראי", "tx"],
    ["strip", "להסיר ת\"ז, מספרי חשבון וכרטיס מהקבצים (האפליקציה עושה אוטומטית)", "tx"],
    ["profile", "להריץ פרומפט 1 ← פרופיל הכנסות מול הוצאות", "home"],
    ["freecash", "לרשום את מספר הכסף הפנוי החודשי", "home"]]],
  ["שבועות 2–3 · לשחרר מזומן (שלבים 2–4)", [
    ["leaks3", "פרומפט 2 ← לבטל לפחות 3 דליפות", "leaks"],
    ["renego", "לנהל מו\"מ על סלולר / אינטרנט / ביטוח", "leaks"],
    ["debtplan", "פרומפט 3 ← להתחיל תוכנית החזר חובות", "leaks"],
    ["overdraft", "לבקש מהבנק להוריד את מסגרת המינוס", "leaks"],
    ["buffer", "לקבוע כרית ולהעביר את השאר מהעו\"ש", "money"]]],
  ["שבוע 4 · לגרום לזה להתרבות (שלבים 5–7)", [
    ["mislaka", "להוציא דוח מסלקה פנסיונית ← פרומפט 5", "money"],
    ["pnfees", "לבקש הורדת דמי ניהול בפנסיה", "money"],
    ["harim", "לחפש בהר הכסף + הר הביטוח", "money"],
    ["taxref", "לבדוק החזרי מס 6 שנים אחורה", "money"],
    ["payfirst", "הוראת קבע \"שלם לעצמך קודם\" ביום המשכורת", "home"],
    ["monthly", "ביומן: פרומפט 7 ב-1 לכל חודש", "agent"]]]
];
function renderChecklist() {
  let done = 0, total = 0;
  $("#checklist").innerHTML = PLAN.map(([title, items]) => `<div class="week"><h3>${title}</h3>` + items.map(([id, label, view]) => {
    total++; const on = !!S.checklist[id]; if (on) done++;
    return `<label class="check ${on ? "done" : ""}"><input type="checkbox" data-c="${id}" ${on ? "checked" : ""}><span>${esc(label)}</span><a class="go" data-go="${view}">פתח ←</a></label>`;
  }).join("") + `</div>`).join("");
  $("#plan-progress").textContent = `${done}/${total}`;
}

// ---------- render: transactions ----------
function catOptions(sel) { return Object.entries(CATS).map(([k, v]) => `<option value="${k}" ${k === sel ? "selected" : ""}>${v}</option>`).join(""); }
function renderTx() {
  $("#tx-count").textContent = S.tx.length;
  const fm = $("#f-month"), fc = $("#f-cat");
  const mv = fm.value, cv = fc.value;
  fm.innerHTML = `<option value="">כל החודשים</option>` + [...A.months].reverse().map((m) => `<option value="${m}">${monthLabel(m)}</option>`).join("");
  fc.innerHTML = `<option value="">כל הקטגוריות</option>` + catOptions("");
  fm.value = mv; fc.value = cv;
  const q = $("#f-q").value.trim().toLowerCase();
  const list = S.tx.filter((t) => (!mv || t.date.startsWith(mv)) && (!cv || t.cat === cv) && (!q || t.merchant.toLowerCase().includes(q)));
  const shown = list.slice(0, 300);
  $("#tx-list").innerHTML = shown.length ? shown.map((t) => `
    <div class="tx ${EXCLUDED.has(t.cat) ? "excluded" : ""}">
      <span class="m">${esc(t.merchant)}</span>
      <span class="a mono ${t.amount > 0 ? "pos" : "neg"}">${money(t.amount)}</span>
      <div class="meta"><span class="mono">${t.date.split("-").reverse().join("/")}</span><span>${t.src === "card" ? "אשראי" : t.src === "bank" ? "בנק" : "ידני"}</span>
        <select data-tx="${esc(t.id)}">${catOptions(t.cat)}</select></div>
    </div>`).join("") + (list.length > 300 ? `<div class="empty">מציג 300 מתוך ${list.length}. סנן לפי חודש.</div>` : "")
    : `<div class="empty">אין תנועות עדיין</div>`;
}

// ---------- render: leaks & debts ----------
function renderLeaks() {
  const rec = A.recurring;
  const total = rec.reduce((a, r) => a + r.yearly, 0);
  const saving = rec.filter((r) => S.leakAct[r.key] === "cancel").reduce((a, r) => a + r.yearly, 0);
  $("#leak-total").textContent = rec.length ? money(total) : "—";
  $("#leak-saving").textContent = money(saving);
  $("#fees-total").textContent = money((A.catTot.fees || 0) / A.n * 12);
  const feeGroups = Object.values(A.groups).filter((g) => g.cat === "fees").sort((a, b) => b.total - a.total);
  $("#leaks").innerHTML = (rec.length ? rec.map((r) => {
    const act = S.leakAct[r.key] || "";
    return `<div class="leak">
      <div class="leak-top"><b>${esc(r.name)}</b><span class="mono">${money(r.yearly)}/שנה</span></div>
      <div class="leak-meta">${CATS[r.cat]} · ${r.months} חודשים · ממוצע ${money(r.perMonth)} לחודש${r.inc > 0.05 ? ` · <span class="bad">התייקר ${pct(r.inc, 0)}</span>` : ""}</div>
      <div class="leak-acts" data-k="${esc(r.key)}">
        <button data-a="keep" class="${act === "keep" ? "on" : ""}">להשאיר</button>
        <button data-a="cancel" class="${act === "cancel" ? "on" : ""}">לבטל</button>
        <button data-a="renegotiate" class="${act === "renegotiate" ? "on" : ""}">מו"מ</button>
        ${act === "renegotiate" ? `<button data-msg="${esc(r.name)}|${Math.round(r.perMonth)}">העתק הודעת מו"מ</button>` : ""}
      </div></div>`;
  }).join("") : `<div class="card empty">אחרי ייבוא של כמה חודשים יופיעו כאן כל החיובים החוזרים, ממוינים לפי עלות שנתית.</div>`)
    + (feeGroups.length ? `<div class="card"><b>עמלות וריבית שזוהו</b>${feeGroups.map((g) => `<div class="lr" style="display:flex;justify-content:space-between"><span>${esc(g.name)}</span><span class="mono">${money(g.total / A.n * 12)}/שנה</span></div>`).join("")}</div>` : "");
  renderDebts();
}
function renderDebts() {
  $("#debts").innerHTML = S.debts.map((d, i) => `<div class="debt"><span><b>${esc(d.name)}</b> · <span class="mono">${d.rate}%</span></span><span class="mono">${money(num(d.balance))}</span><button class="btn sm danger" data-del-debt="${i}">✕</button></div>`).join("");
  const ex = $("#debt-extra");
  if (document.activeElement !== ex) ex.value = S.settings.debtExtra ?? (A.avg.free > 0 ? Math.round(A.avg.free) : "");
  const dp = debtPlan(num(ex.value));
  if (!dp) { $("#debt-plan").innerHTML = ""; return; }
  const when = (m) => { const d = new Date(); d.setMonth(d.getMonth() + m); return HE_MONTHS[d.getMonth()] + " " + d.getFullYear(); };
  const p = dp.plan, b = dp.base;
  $("#debt-plan").innerHTML = `<div class="result">
    <div class="lr"><span>ריבית שנתית היום</span><span class="mono bad">${money(dp.yearlyNow)}</span></div>
    <div class="lr"><span>חופשי מחובות</span><span class="mono big">${p.done ? when(p.months) + ` (${p.months} ח׳)` : "לא בטווח 50 שנה — הגדל את ההחזר"}</span></div>
    <div class="lr"><span>סך ריבית עד הסוף</span><span class="mono">${money(p.interest)}</span></div>
    <div class="lr"><span>חיסכון בריבית לעומת מינימום בלבד</span><span class="mono good">${b.done ? money(b.interest - p.interest) : "המינימום לא מכסה את הריבית"}</span></div>
    ${p.order.length ? `<p class="muted small">סדר הסגירה: ${p.order.map((o) => `${esc(o.name)} (חודש ${o.month})`).join(" ← ")}</p>` : ""}
    <p class="muted small">שאל את הבנק: האם הלוואה לאיחוד חובות בריבית נמוכה יותר זולה מהמינוס? ובקש להוריד את מסגרת המינוס.</p>
  </div>`;
}

// ---------- render: money ----------
const SW_FIELDS = { "sw-balance": "swBalance", "sw-spend": "swSpend", "sw-fixed": "swFixed", "sw-months": "swMonths", "sw-cushion": "swCushion", "sw-rate": "swRate", "sw-infl": "swInfl", "pn-bal": "pnBal", "pn-dep": "pnDep", "pn-fd": "pnFd", "pn-fs": "pnFs", "pn-age": "pnAge", "pn-r": "pnR" };
function renderMoney() {
  for (const [id, k] of Object.entries(SW_FIELDS)) {
    const el = $("#" + id);
    if (document.activeElement === el) continue;
    if (S.settings[k] !== undefined) el.value = S.settings[k];
    else if (id === "sw-spend" && A.avg.spend) el.placeholder = Math.round(A.avg.spend);
    else if (id === "sw-fixed" && A.avg.fixed) el.placeholder = Math.round(A.avg.fixed + A.avg.yearly);
  }
  const s = sweepCalc();
  $("#sweep-out").innerHTML = `<div class="result">
    <div class="layer"><span class="n">1</span><div class="t">כרית תפעולית בעו"ש<small>חודש הוצאות + כרית מעל השפל השנתי</small></div><b class="mono">${money(s.buffer)}</b></div>
    <div class="layer"><span class="n">2</span><div class="t">קרן חירום — קרן כספית / פיקדון קצר<small>${num(S.settings.swMonths) || 4} חודשי הוצאות קבועות</small></div><b class="mono">${money(s.emergency)}</b></div>
    <div class="layer"><span class="n">3</span><div class="t">כסף מתוכנן (6–24 חודשים)<small>סולם פיקדונות או מק"מ קצר</small></div><b class="mono">${s.toPlanned ? money(s.toPlanned) : "—"}</b></div>
    ${s.bal ? `<div class="lr"><span>להעביר מהעו"ש עכשיו</span><span class="mono big ${s.idle ? "good" : ""}">${money(s.idle)}</span></div>
    <div class="lr"><span>תוספת ריבית שנתית משוערת (נטו)</span><span class="mono good">${money(s.gainIdle)}</span></div>` : `<p class="muted small">הזן את יתרת העו"ש כדי לראות כמה כסף יושב בטל.</p>`}
    <table class="cmp" style="margin-top:8px">
      <tr><th>אפיק</th><th>מס</th><th>תשואה נטו</th></tr>
      <tr><td>פיקדון שקלי</td><td>15% על הריבית הנומינלית</td><td class="mono">${pct(s.depositNet, 2)}</td></tr>
      <tr><td>קרן כספית</td><td>25% על הרווח הריאלי</td><td class="mono">${pct(s.mmfNet, 2)}</td></tr>
    </table>
    <p class="muted small">נקודת איזון: אינפלציה ≈ 0.4 × הריבית ≈ ${pct(0.4 * s.r, 1)}. ${s.mmfNet > s.depositNet ? "באינפלציה שהזנת הקרן הכספית מעט עדיפה." : "באינפלציה שהזנת הפיקדון מעט עדיף."} לפני דמי ניהול. ריבית בנק ישראל 3.25% ויורדת.</p>
  </div>`;
  const p = pensionCalc();
  $("#pension-out").innerHTML = `<div class="result">
    <div class="lr"><span>צבירה בגיל 67 בדמי הניהול שלך</span><span class="mono">${money(p.mine)}</span></div>
    <div class="lr"><span>בדמי ניהול של קרן ברירת מחדל</span><span class="mono">${money(p.bench)}</span></div>
    <div class="lr"><span>מה דמי הניהול עולים לך</span><span class="mono big ${p.gap > 0 ? "bad" : "good"}">${money(p.gap)}</span></div>
  </div>`;
}

// ---------- monthly review ----------
function reviewData() {
  if (A.months.length < 2) return null;
  const month = A.months[A.months.length - 1] === new Date().toISOString().slice(0, 7) && A.months.length > 2 ? A.months[A.months.length - 2] : A.months[A.months.length - 1];
  const M = A.byMonth[month];
  const rows = Object.keys(CATS).filter((c) => !NON_SPEND.has(c)).map((c) => {
    const avg = (A.catTot[c] || 0) / A.n, cur = M.cats[c] || 0;
    return { cat: c, avg, cur, ratio: avg ? cur / avg : 0, diff: cur - avg };
  }).filter((r) => r.avg || r.cur);
  const flags = rows.filter((r) => r.avg > 50 && r.ratio > 1.15).sort((a, b) => b.diff - a.diff);
  const newRec = A.recurring.filter((r) => r.firstMonth >= A.months[Math.max(0, A.months.length - 3)]);
  const incRec = A.recurring.filter((r) => r.inc > 0.05);
  return { month, M, rows, flags, newRec, incRec };
}
function renderReview() {
  const r = reviewData();
  if (!r) { $("#review").innerHTML = `<div class="card empty">צריך לפחות חודשיים של נתונים. ב-1 לכל חודש: ייבא את החודש שעבר וחזור לכאן.</div>`; return; }
  const free = r.M.income - r.M.spend;
  const sw = sweepCalc();
  $("#review").innerHTML = `<div class="card">
    <b>${monthLabel(r.month)} מול הממוצע</b>
    <div class="result" style="margin-top:6px;border:0;padding:0">
      <div class="lr"><span>הכנסה</span><span class="mono">${money(r.M.income)} <span class="muted">/ ${money(A.avg.income)}</span></span></div>
      <div class="lr"><span>הוצאה</span><span class="mono">${money(r.M.spend)} <span class="muted">/ ${money(A.avg.spend)}</span></span></div>
      <div class="lr"><span>כסף פנוי</span><span class="mono ${free >= A.avg.free ? "good" : "bad"}">${money(free)} <span class="muted">/ ${money(A.avg.free)}</span></span></div>
      <div class="lr"><span>הועבר לחיסכון</span><span class="mono">${money(r.M.savings)}</span></div>
      ${sw.bal ? `<div class="lr"><span>מזומן בטל מעל הכרית</span><span class="mono ${sw.idle ? "bad" : "good"}">${money(sw.idle)}</span></div>` : ""}
    </div>
    <table class="cmp"><tr><th>קטגוריה</th><th>החודש</th><th>ממוצע</th></tr>
    ${r.rows.sort((a, b) => b.cur - a.cur).map((x) => `<tr><td>${CATS[x.cat]}${x.avg > 50 && x.ratio > 1.15 ? ` <span class="flag">+${pct(x.ratio - 1, 0)}</span>` : ""}</td><td class="mono">${money(x.cur)}</td><td class="mono">${money(x.avg)}</td></tr>`).join("")}</table>
    ${r.newRec.length ? `<p class="small"><b>חיובים חוזרים חדשים:</b> ${r.newRec.map((x) => esc(x.name)).join(", ")}</p>` : ""}
    ${r.incRec.length ? `<p class="small"><b>התייקרויות:</b> ${r.incRec.map((x) => `${esc(x.name)} (+${pct(x.inc, 0)})`).join(", ")}</p>` : ""}
  </div>`;
}

// ---------- summary for the agent (aggregated, anonymized) ----------
function summaryText() {
  if (!S.tx.length) return "אין עדיין נתוני תנועות.";
  const L = [];
  L.push(`תקופה: ${A.months[0]} עד ${A.months[A.months.length - 1]} (${A.n} חודשים).`);
  L.push(`ממוצע חודשי: הכנסה נטו ${money(A.avg.income)}, הוצאות ${money(A.avg.spend)} (קבועות ${money(A.avg.fixed)}, משתנות ${money(A.avg.variable)}, שנתיות÷12 ${money(A.avg.yearly)}, ריבית ועמלות ${money(A.avg.fees)}), חיסכון ${money(A.avg.savings)}, כסף פנוי ${money(A.avg.free)}.`);
  L.push("\nלפי חודש (הכנסה / הוצאה / חיסכון):");
  for (const m of A.months) { const M = A.byMonth[m]; L.push(`${m}: ${Math.round(M.income)} / ${Math.round(M.spend)} / ${Math.round(M.savings)}`); }
  L.push("\nממוצע חודשי לפי קטגוריה:");
  Object.entries(A.catTot).sort((a, b) => b[1] - a[1]).forEach(([c, v]) => L.push(`${CATS[c]}: ${Math.round(v / A.n)}`));
  if (A.recurring.length) {
    L.push("\nחיובים חוזרים (בית עסק · חודשים · ממוצע לחודש · שינוי מחיר · החלטה):");
    A.recurring.slice(0, 40).forEach((r) => L.push(`${r.name} · ${r.months} · ${Math.round(r.perMonth)} · ${r.inc ? pct(r.inc, 0) : "0%"} · ${S.leakAct[r.key] || "לא נבדק"}`));
  }
  if (S.debts.length) {
    L.push("\nחובות:");
    S.debts.forEach((d) => L.push(`${d.name}: יתרה ${d.balance}, ריבית ${d.rate}%, מינימום ${d.min || 0}`));
  }
  const sw = sweepCalc();
  if (sw.bal) L.push(`\nיתרת עו"ש: ${Math.round(sw.bal)}. כרית: ${Math.round(sw.buffer)}. מזומן בטל: ${Math.round(sw.idle)}.`);
  if (S.settings.pnTouched) { const p = pensionCalc(); L.push(`פנסיה: צבירה ${S.settings.pnBal}, הפקדה ${S.settings.pnDep}/ח', דמי ניהול ${S.settings.pnFd}% מהפקדה ו-${S.settings.pnFs}% מצבירה, גיל ${S.settings.pnAge}. פער מול ברירת מחדל עד 67: ${Math.round(p.gap)}.`); }
  return L.join("\n");
}

// ---------- prompts (from the guide, in Hebrew) ----------
const SUFFIX = "\n\nחשב עם קוד, אל תעריך. ציין אילו עובדות עשויות להיות לא מעודכנות לישראל ב-2026.";
const PROMPTS = [
  ["פרומפט 1 · פרופיל הכנסות מול הוצאות", `אתה ה-CFO האישי שלי. מצורפים 12 חודשים של תנועות בנק ואשראי (תאריך, בית עסק, סכום ב-₪) ותלושי השכר שלי.
1. השתמש בקוד (לא בהערכות) כדי לשייך כל תנועה לקטגוריה: דיור, מזון, תחבורה, ילדים/חינוך, בריאות, ביטוח, מנויים, בילוי/מסעדות, קניות, חוב/ריבית/עמלות, חיסכון/השקעות, אחר.
2. הסר ספירה כפולה: החיוב החודשי של כרטיס האשראי בחשבון הבנק = עסקאות הכרטיס.
3. פצל כל קטגוריה לקבועה (זהה כל חודש), משתנה, ושנתית/חריגה (המר לחודשי).
4. בנה טבלה חודשית: הכנסה נטו, סך הוצאות, תזרים נטו, וממוצע 12 חודשים.
5. תגיד לי מה ה"כסף הפנוי" האמיתי שלי בחודש ומה היתרה הנמוכה ביותר שלי בשנה.
6. סמן את 10 ההפתעות הגדולות: דברים שגדלו, חיובים חוזרים, עמלות וריבית.
שאל אותי על כל מה שאתה לא מצליח לסווג במקום לנחש.`],
  ["פרומפט 2 · צייד הדליפות", `מתוך התנועות המסווגות שלי:
1. מצא כל חיוב שחוזר חודשית או שנתית מאותו בית עסק. טבלה: בית עסק, תדירות, סכום ממוצע, עלות שנתית, וכל התייקרות במהלך השנה. מיין לפי עלות שנתית.
2. רשום את כל עמלות הבנק, עמלות הכרטיס והריבית שחויבתי, עם סכומים שנתיים.
3. רשום את חשבונות הטלפון, האינטרנט, הטלוויזיה והביטוח עם סכומים שנתיים.
4. לכל פריט: להשאיר / לבטל / לנהל מו"מ, עם נימוק והחיסכון ב-₪ לשנה.
5. כתוב הודעה קצרה ומנומסת בעברית שאוכל לשלוח כדי לנהל מו"מ על כל פריט כזה.`],
  ["פרומפט 3 · תוכנית יציאה מחובות", `אלה כל החובות שלי: מינוס (מסגרת, יתרה ממוצעת, ריבית), אשראי/תשלומים בכרטיס, הלוואות (יתרה, ריבית, חודשים שנותרו). עם כסף פנוי חודשי של ₪___:
1. חשב עם קוד כמה ריבית אני משלם היום בשנה.
2. בנה תוכנית החזר בשיטת "המפולת" (הריבית הגבוהה קודם) והראה באיזה חודש אהיה חופשי מחובות ואת סך הריבית שנחסכה.
3. בדוק אם הלוואה לאיחוד חובות זולה יותר מהמינוס, ורשום את השאלות שעליי לשאול את הבנק.
4. קבע יעד למסגרת המינוס שעליי לבקש מהבנק להוריד אליה.`],
  ["פרומפט 5 · ביקורת פנסיה", `מצורף דוח המסלקה הפנסיונית שלי (בלי פרטים אישיים). לכל מוצר (פנסיה, השתלמות, גמל, ביטוח מנהלים): רשום יתרה, דמי ניהול מהפקדה, דמי ניהול מצבירה, מסלול השקעה וכיסוי ביטוחי.
1. השווה את דמי הניהול שלי לקרן ברירת המחדל (1% מהפקדות / 0.22% מצבירה) וחשב עם קוד את העלות ב-₪ עד גיל 67 של דמי הניהול הנוכחיים.
2. סמן חשבונות לא פעילים או כפולים וכל ביטוח שאני משלם עליו פעמיים.
3. בדוק אם המסלול מתאים לגיל ולאופק שלי, והסבר את האפשרויות בלי להמליץ על קרן ספציפית.
4. נסח בקשה בעברית לקרן שלי להורדת דמי הניהול.`],
  ["פרומפט 7 · הבדיקה החודשית", `זה הייצוא של התנועות מהחודש שעבר. השווה אותו לפרופיל הבסיס שלי:
1. הכנסה, הוצאה לפי קטגוריה וכסף פנוי מול הממוצע של 12 החודשים. כל דבר שגבוה ביותר מ-15% מהממוצע — לסמן.
2. חיובים חוזרים חדשים או התייקרויות.
3. האם ההעברה האוטומטית לחיסכון בוצעה? כמה כסף בטל יש בעו"ש מעל הכרית?
4. התקדמות בהחזר חובות וביעדי חיסכון.
5. תן לי שלוש פעולות לחודש הזה, מדורגות לפי ההשפעה ב-₪.`],
  ["פרומפט נגד · מה יפיל את התוכנית?", `הנה התוכנית הפיננסית שלי. תפקידך לתקוף אותה, לא לבחור לי מניות: מה יגרום לתוכנית הזו להיכשל? אילו הנחות חלשות? מה הסיכון הגדול ביותר שאני לא רואה?`]
];
function renderPrompts() {
  $("#prompts").innerHTML = PROMPTS.map(([t, p], i) => `<div class="card prompt"><b>${t}</b><pre>${esc(p + SUFFIX)}</pre>
    <div class="row"><button class="btn sm" data-copy="${i}">העתק</button><button class="btn sm primary" data-copy="${i}" data-with="1">העתק עם הנתונים שלי</button></div></div>`).join("");
}

// ---------- Claude agent ----------
const SYSTEM = `אתה "ה-CFO שלי": אנליסט פיננסי אישי למשק בית בישראל, לפי שיטת 7 השלבים: (0) מעקות בטיחות, (1) פרופיל אמיתי של הכנסות מול הוצאות, (2) עצירת דליפות, (3) חיסול חוב יקר, (4) חניית מזומן נכונה בשכבות (כרית, קרן חירום, כסף מתוכנן), (5) תיקון חיסכון ארוך טווח ודמי ניהול, (6) מימוש כספים שמגיעים (הר הכסף, הר הביטוח, החזרי מס), (7) טייס אוטומטי ובדיקה חודשית.
כללים:
- אתה קורא וחושב; המשתמש מחליט ולוחץ. לעולם אל תבקש סיסמאות, קודי SMS או מספרי חשבון.
- חשב במדויק מהנתונים שקיבלת; אם חסר נתון, שאל במקום לנחש.
- אל תמליץ על קרן, מניה או מוצר ספציפי (חוק הייעוץ בישראל). הסבר אפשרויות ועלויות.
- ציין אילו עובדות (שיעורי מס, תקרות, ריביות) עשויות להיות לא מעודכנות לישראל 2026, והפנה לאימות ב-gov.il / כל זכות / רשות המסים.
- כשמבקשים ממך — תקוף את התוכנית ("מה יגרום לה להיכשל?").
- ענה בעברית, קצר ומעשי. כשמתאים: פעולות מדורגות לפי השפעה ב-₪.
- נתוני רקע (ספטמבר 2026, לאימות): ריבית בנק ישראל 3.25%, פריים 4.75%; מינוס במסגרת ~11.9%, חריגה עד 18.55%; אשראי בכרטיס 14–15.5%; פיקדון שקלי: 15% מס על ריבית נומינלית; קרן כספית: 25% על רווח ריאלי; קרן ברירת מחדל: עד 1% מהפקדה / 0.22% מצבירה; מקסימום חוקי 6% / 0.5%.`;
function renderChat() {
  $("#api-key").value = S.apiKey ? "••••••••" + S.apiKey.slice(-4) : "";
  $("#chat").innerHTML = S.chat.map((m) => `<div class="msg ${m.role === "user" ? "u" : "a"}">${esc(m.text)}</div>`).join("");
  $("#chat").scrollTop = 1e6;
  $("#quick-asks").innerHTML = ["תן לי 3 פעולות לחודש הזה לפי השפעה ב-₪", "מה יגרום לתוכנית שלי להיכשל?", "איפה הדליפה הכי גדולה שלי?", "כמה כסף פנוי אמיתי יש לי?"].map((q) => `<button data-q="${esc(q)}">${esc(q)}</button>`).join("");
}
async function callClaude(body) {
  return fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": S.apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
      ...(body.fallbacks ? { "anthropic-beta": "server-side-fallback-2026-07-01" } : {})
    },
    body: JSON.stringify(body)
  });
}
async function ask(q) {
  if (!S.apiKey) return toast("הזן מפתח API כדי לשאול את הסוכן ישירות, או השתמש בספריית הפרומפטים");
  S.chat.push({ role: "user", text: q }); S.chat = S.chat.slice(-20); save(); renderChat();
  const pend = document.createElement("div"); pend.className = "msg a"; pend.textContent = "חושב…"; $("#chat").appendChild(pend);
  const body = {
    model: "claude-opus-5-5",
    max_tokens: 16000,
    output_config: { effort: "medium" },
    fallbacks: "default",
    system: SYSTEM + "\n\nנתוני המשתמש (סיכום מצטבר):\n" + summaryText(),
    messages: S.chat.map((m) => ({ role: m.role, content: m.text }))
  };
  try {
    let res = await callClaude(body);
    if (res.status === 400) {
      const t = await res.clone().text();
      if (/fallback/i.test(t)) { delete body.fallbacks; res = await callClaude(body); }
    }
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || "HTTP " + res.status);
    let text;
    if (data.stop_reason === "refusal") text = "הסוכן סירב לענות על השאלה הזו. נסח אותה מחדש.";
    else text = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").trim() || "(אין תשובה)";
    S.chat.push({ role: "assistant", text });
  } catch (e) {
    S.chat.pop();
    pend.className = "msg a err"; pend.textContent = "שגיאה: " + e.message; save(); return;
  }
  save(); renderChat();
}

// ---------- wiring ----------
function renderAll() {
  A = analyze();
  renderHome(); renderTx(); renderLeaks(); renderMoney(); renderReview(); renderChat();
}
function go(view) {
  $$(".view").forEach((v) => v.classList.toggle("active", v.id === "view-" + view));
  $$(".tabs button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
  window.scrollTo(0, 0);
  try { sessionStorage.setItem("cfo-view", view); } catch {}
}
$$(".tabs button").forEach((b) => (b.onclick = () => go(b.dataset.view)));

$("#file-input").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  try {
    const rows = await readFile(f);
    if (!rows.length) return toast("הקובץ ריק");
    showMapper(rows, $('input[name="src"]:checked').value, f.name);
  } catch (err) { toast(err.message || "לא הצלחתי לקרוא את הקובץ"); }
};
$("#manual-form").onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const t = { id: "m" + Date.now(), date: f.get("date"), merchant: strip(f.get("merchant")), amount: num(f.get("amount")), src: "manual" };
  t.cat = autoCat(t);
  S.tx.push(t); S.tx.sort((a, b) => b.date.localeCompare(a.date)); save(); e.target.reset(); renderAll(); toast("נוסף");
};
["#f-month", "#f-cat"].forEach((s) => ($(s).onchange = renderTx));
$("#f-q").oninput = renderTx;
$("#tx-list").addEventListener("change", (e) => {
  const id = e.target.dataset.tx; if (!id) return;
  const t = S.tx.find((x) => x.id === id); if (!t) return;
  const key = mkey(t.merchant), cat = e.target.value;
  S.rules[key] = cat;
  let n = 0;
  for (const x of S.tx) if (mkey(x.merchant) === key) { x.cat = cat; n++; }
  save(); renderAll(); toast(n > 1 ? `עודכנו ${n} תנועות של "${t.merchant}"` : "עודכן");
});
$("#checklist").addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) { e.preventDefault(); go(g.dataset.go); }
});
$("#checklist").addEventListener("change", (e) => {
  const c = e.target.dataset.c; if (!c) return;
  S.checklist[c] = e.target.checked; save(); renderHome();
});
$("#leaks").addEventListener("click", (e) => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.msg) {
    const [name, amt] = b.dataset.msg.split("|");
    copy(`שלום,\nאני לקוח/ה שלכם ומשלם/ת כיום כ-${amt} ₪ בחודש עבור ${name}. בדקתי ומצאתי הצעות זולות משמעותית בשוק. אשמח לשמוע איזו הצעה משופרת תוכלו להציע לי כדי שאמשיך איתכם, אחרת אאלץ לעבור.\nתודה!`);
    return;
  }
  const k = b.parentElement.dataset.k, a = b.dataset.a;
  S.leakAct[k] = S.leakAct[k] === a ? "" : a; save(); renderLeaks(); renderHome();
});
$("#debt-form").onsubmit = (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  S.debts.push({ name: f.get("name"), balance: num(f.get("balance")), rate: num(f.get("rate")), min: num(f.get("min")) });
  save(); e.target.reset(); renderLeaks(); renderHome();
};
$("#debts").addEventListener("click", (e) => {
  const i = e.target.dataset.delDebt; if (i === undefined) return;
  S.debts.splice(+i, 1); save(); renderLeaks(); renderHome();
});
$("#debt-extra").oninput = (e) => { S.settings.debtExtra = e.target.value; save(); renderDebts(); renderAdvisor(); };
for (const [id, k] of Object.entries(SW_FIELDS)) {
  $("#" + id).addEventListener("input", (e) => {
    S.settings[k] = e.target.value === "" ? undefined : e.target.value;
    if (id.startsWith("pn-")) S.settings.pnTouched = true;
    save(); renderMoney(); renderAdvisor();
  });
}
function copy(text) {
  (navigator.clipboard?.writeText(text) || Promise.reject()).then(() => toast("הועתק"), () => {
    const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand("copy"); toast("הועתק"); } catch { toast("ההעתקה נכשלה"); } ta.remove();
  });
}
$("#prompts").addEventListener("click", (e) => {
  const b = e.target.closest("[data-copy]"); if (!b) return;
  const [, p] = PROMPTS[+b.dataset.copy];
  copy(p + SUFFIX + (b.dataset.with ? "\n\n--- הנתונים שלי (סיכום מצטבר, ללא פרטים מזהים) ---\n" + summaryText() : ""));
});
$("#save-key").onclick = () => {
  const v = $("#api-key").value.trim();
  if (v.startsWith("••")) return toast("המפתח כבר שמור");
  S.apiKey = v; save(); renderChat(); toast(v ? "המפתח נשמר במכשיר" : "המפתח נמחק");
};
$("#ask-form").onsubmit = (e) => { e.preventDefault(); const q = $("#ask-input").value.trim(); if (!q) return; $("#ask-input").value = ""; ask(q); };
$("#quick-asks").addEventListener("click", (e) => { const q = e.target.dataset.q; if (q) ask(q); });
$("#export-json").onclick = () => {
  const data = { ...S, apiKey: "" };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(data)], { type: "application/json" }));
  a.download = `cfo-backup-${new Date().toISOString().slice(0, 10)}.json`; a.click();
};
$("#import-json").onchange = async (e) => {
  const f = e.target.files[0]; e.target.value = ""; if (!f) return;
  try { const d = JSON.parse(await f.text()); const key = S.apiKey; S = Object.assign(structuredClone(DEFAULT), d, { apiKey: key }); save(); renderAll(); toast("שוחזר"); }
  catch { toast("קובץ גיבוי לא תקין"); }
};
$("#wipe").onclick = () => {
  if (!confirm("למחוק את כל הנתונים מהמכשיר? אין דרך לשחזר בלי גיבוי.")) return;
  S = structuredClone(DEFAULT); save(); renderAll(); toast("הנתונים נמחקו");
};

renderPrompts();
renderAll();
try { const v = sessionStorage.getItem("cfo-view"); if (v) go(v); } catch {}
if ("serviceWorker" in navigator) addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
