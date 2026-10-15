
/* ===== واجهة منشئ خطط المتون ===== */
(() => {
  const $ = (id) => document.getElementById(id);
  // نسخة الموقع المستقل (GitHub Pages): لا قاعدة بيانات فيها، فلا خطط محفوظة ولا لوحة تحكم
  const SITE_MODE = typeof SITE !== "undefined" && !!(SITE && SITE.standalone);
  const AR = PlanCore.toArabicDigits;
  const ASCII = PlanCore.toAscii;
  const ROWS = DocxBuilder.ROWS_PER_SHEET;
  const LEVEL_NAMES = { 1: "المستوى الأول", 2: "المستوى الثاني", 3: "المستوى الثالث", 4: "المستوى الرابع", 5: "المستوى الخامس", 6: "المستوى السادس", 7: "المتون الإضافية" };
  const HALAQAT = ["أبو هريرة", "أنس بن مالك", "عبدالله بن عباس", "عبدالله بن عمر", "عبدالله بن مسعود", "عمر بن الخطاب", "أبو بكر الصديق", "أحمد بن حنبل"];
  // المعلمون: يُختار أحدهم عند اعتماد الخطة فيُحفظ معها في «الخطط المحفوظة»، ولا يظهر في ورقة الخطة ولا في ملفاتها
  const TEACHERS = ["فيصل الرشيد", "محمد الضويان", "علي الدهلاوي", "فيصل الخربوش", "عبدالعزيز الخليوي", "خالد الباهلي", "فواز الدهامي"];
  const ORDINALS = ["الأول", "الثاني", "الثالث", "الرابع", "الخامس", "السادس", "السابع", "الثامن", "التاسع", "العاشر", "الحادي عشر", "الثاني عشر", "الثالث عشر", "الرابع عشر", "الخامس عشر", "السادس عشر", "السابع عشر", "الثامن عشر", "التاسع عشر", "العشرون"];
  // عدد أيام الربط في خططك الأصلية لكل متن، يتكيّف مع المدة الجديدة عند الربط بالأيام
  const LINK_ORIG = {
    mukhtasar41: 6, mukhtasar45: 6, adhkar: 3, arbaeen: 3, nawaqid: 4, qawaid: 4, usul: 4,
    tuhfa: 5, shurut: 5, tawheed: 3, bayquni: 5, ilbiri: 5, ajurrumiya: 5, wasitiya: 5,
    waraqat: 6, unwan: 6, rahbiya: 6, tahawiya: 6,
  };
  const STORE_KEY = "khutat-mutun-v1";
  let prefsStamp = "";
  const MAX_REVIEW = ORDINALS.length;
  const DEFAULT_LINK = { enabled: true, mode: "pages", pages: 10, days: 3, daysManual: false, cont: true, prevId: null };
  // كتب المستوى الأول
  const LEVEL1_BOOKS = ["mukhtasar45", "mukhtasar41", "adhkar"];
  const MUKHTASAR_EDITIONS = ["mukhtasar45", "mukhtasar41"];
  // المستوى الأول: المختصر بإحدى طبعتيه ثم الأذكار والآداب، ما لم يُستبعد الأذكار والآداب
  const validLevel1 = (c) => ({
    edition: c && MUKHTASAR_EDITIONS.includes(c.edition) ? c.edition : MUKHTASAR_EDITIONS[0],
    adhkar: !(c && c.adhkar === false),
  });
  const level1Ids = (c = state.level1) => [c.edition].concat(c.adhkar ? ["adhkar"] : []);
  const RLM = "\u200F";
  // أسماء قصيرة تُكتب في خانة الملاحظات عند بدء مراجعة كل متن (الخانة ضيقة)
  const SHORT = {
    mukhtasar41: "المختصر", mukhtasar45: "المختصر", adhkar: "الأذكار والآداب", arbaeen: "الأربعون النووية",
    nawaqid: "نواقض الإسلام", qawaid: "القواعد الأربع", usul: "الأصول الثلاثة", tuhfa: "تحفة الأطفال",
    shurut: "شروط الصلاة", tawheed: "كتاب التوحيد", bayquni: "البيقونية", ilbiri: "الإلبيري",
    ajurrumiya: "الآجراميّة", wasitiya: "الواسطية", waraqat: "الورقات", unwan: "عنوان الحكم",
    rahbiya: "الرحبية", tahawiya: "الطحاوية",
    umda: "العمدة", bulugh: "بلوغ المرام", zad: "زاد المستقنع",
  };

  /* ---------- أدوات ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const stripMarks = (s) => String(s == null ? "" : s).replace(/[\u200e\u200f\u061c]/g, "");
  const norm = (s) => ASCII(stripMarks(s)).replace(/\s+/g, " ").trim();
  // المقدار كما يظهر في وورد: بعد الخط المائل علامة اتجاه تُبقي «٢/٧٩-٨٢» مقروءاً من اليمين
  const disp = (s) => AR(stripMarks(s)).replace(/\//g, "/" + RLM);
  // متن الخطة الأصلي (لمتن يبدأ من صفحة معيّنة رقمه «mix:…»، ولما قبل صفحة البدء «part:…»)
  const baseOf = (t) => (t ? t.base || t.id : "");
  const isMukhtasar = (t) => !!t && /^mukhtasar/.test(baseOf(t));
  function parseIntAny(v) {
    const n = parseInt(ASCII(String(v)).replace(/[^\d]/g, ""), 10);
    return Number.isFinite(n) ? n : NaN;
  }
  function clampInt(v, lo, hi, def) {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : def;
  }
  const fmtNum = (x) => AR(x.toFixed(1).replace(/\.0$/, "").replace(".", "٫"));
  // تمييز العدد: ٣–١٠ (وما زاد على المئة بها) جمع، ١١–٩٩ مفرد منصوب، والمئة وما زاد بواحد أو اثنين مفرد مجرور
  const form = (n) => (n === 1 ? "one" : n === 2 ? "two" : n % 100 >= 3 && n % 100 <= 10 ? "pl" : n % 100 >= 11 ? "acc" : "gen");
  const pick = (n, w) => w[form(n)];
  const daysWord = (n) => pick(n, { one: "يوم واحد", two: "يومان", pl: `${AR(n)} أيام`, acc: `${AR(n)} يوماً`, gen: `${AR(n)} يوم` });
  const daysAfter = (n) => pick(n, { one: "يوم واحد", two: "يومين", pl: `${AR(n)} أيام`, acc: `${AR(n)} يوماً`, gen: `${AR(n)} يوم` });
  const pagesWord = (n) => pick(n, { one: "صفحة واحدة", two: "صفحتان", pl: `${AR(n)} صفحات`, acc: `${AR(n)} صفحة`, gen: `${AR(n)} صفحة` });
  const pagesAfter = (n) => pick(n, { one: "صفحة", two: "صفحتين", pl: `${AR(n)} صفحات`, acc: `${AR(n)} صفحة`, gen: `${AR(n)} صفحة` });
  const plansWord = (n) => pick(n, { one: "خطة واحدة", two: "خطتان", pl: `${AR(n)} خطط`, acc: `${AR(n)} خطة`, gen: `${AR(n)} خطة` });
  const unitWord = (n) => pick(n, { one: "يوم", two: "يومان", pl: "أيام", acc: "يوماً", gen: "يوم" });
  const asciiDays = (n) => pick(n, { one: "يوم واحد", two: "يومان", pl: `${n} أيام`, acc: `${n} يوما`, gen: `${n} يوم` });

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.dataset.kind = kind || "";
  }

  /* ---------- تفضيلات العارض (في متصفحه فقط) ---------- */
  function loadPrefs() {
    try {
      return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
    } catch (e) {
      return {};
    }
  }
  function savePrefs() {
    try {
      const s = loadPrefs();
      if (!state.text.custom) {
        s.text = state.text.id;
        s.days = Object.assign(s.days || {}, { [state.text.id]: state.days });
        s.reviewItems = Object.assign(s.reviewItems || {}, { [state.text.id]: state.review.items });
      }
      // طريقة المراجعة وإعداد المستويات عامة لكل المتون
      s.review2 = { method: state.review.method, repeat: state.review.repeat, mergeShort: state.review.mergeShort, levels: state.review.levels };
      s.level1 = state.level1;
      delete s.reviews; // حفظ قديم كانت المراجعة فيه تبدأ بالمتن نفسه
      s.link = state.link;
      s.withReview = state.withReview;
      // الإعدادات التلقائية التي بُنيت عليها هذه التفضيلات
      s.settingsStamp = prefsStamp;
      s.halaqa = state.halaqa;
      s.teacher = state.teacher;
      s.student = { enabled: state.student.enabled };
      s.dates = {
        enabled: state.dates.enabled,
        weekdays: state.dates.weekdays,
        fill: state.dates.fill,
        start: state.dates.start ? Hijri.short(state.dates.start) : null,
      };
      localStorage.setItem(STORE_KEY, JSON.stringify(s));
    } catch (e) {
      /* التخزين غير متاح: لا بأس */
    }
  }

  /* ---------- المتون والمستويات ---------- */
  const customTexts = [];
  const allTexts = () => TEXTS.concat(customTexts);
  // خطة المستوى كاملاً: متونه بترتيب البرنامج كأنها متن واحد (كالخطط الجاهزة)
  const LEVEL_PLANS = [2, 3, 4, 5, 6].filter((lvl) => TEXTS.some((t) => t.level === lvl)).map((lvl) => {
    const parts = TEXTS.filter((t) => t.level === lvl);
    return {
      id: "level-" + lvl,
      isLevel: true,
      level: lvl,
      name: `${LEVEL_NAMES[lvl]} كاملاً`,
      title: `خطة ${LEVEL_NAMES[lvl]}`,
      qr: null,
      parts: parts.map((t) => t.id),
      days: parts.flatMap((t) => t.days),
      segments: parts.map((t) => ({ id: t.id, days: t.days.length })),
    };
  });
  // المستوى الأول كاملاً: المختصر بطبعته المختارة ثم الأذكار والآداب
  function level1Plan() {
    const parts = [state.level1.edition, "adhkar"].map((id) => TEXTS.find((t) => t.id === id));
    return {
      id: "level-1",
      isLevel: true,
      level: 1,
      name: `${LEVEL_NAMES[1]} كاملاً`,
      title: `خطة ${LEVEL_NAMES[1]}`,
      qr: null,
      parts: parts.map((t) => t.id),
      days: parts.flatMap((t) => t.days),
      segments: parts.map((t) => ({ id: t.id, days: t.days.length })),
    };
  }
  // خطة من بعض متون المستوى (ما عُلِّم منها في قائمة «المتون») بترتيب البرنامج، كخطة المستوى كاملاً
  const selCache = {};
  function selectionPlan(id) {
    if (selCache[id]) return selCache[id];
    const m = /^sel:(\d+):(.+)$/.exec(id || "");
    if (!m) return null;
    const lvl = +m[1];
    const want = m[2].split(",");
    const parts = TEXTS.filter((t) => t.level === lvl && want.includes(t.id));
    if (lvl < 2 || parts.length < 2 || parts.length !== new Set(want).size) return null;
    return (selCache[id] = {
      id,
      isLevel: true,
      isSel: true,
      level: lvl,
      name: `${LEVEL_NAMES[lvl]}: ${parts.map((t) => SHORT[t.id] || AR(t.name)).join("، ")}`,
      title: `خطة ${LEVEL_NAMES[lvl]}`,
      qr: null,
      parts: parts.map((t) => t.id),
      days: parts.flatMap((t) => t.days),
      segments: parts.map((t) => ({ id: t.id, days: t.days.length })),
    });
  }
  /* خطة من متون مختارة بترتيب يحدده المستخدم: «mix:~الورقات;الرحبية@100;الطحاوية;bulugh»
     كل متن فيها: من أوله، أو من صفحة معيّنة «@١٠٠» (ما قبلها محفوظ: يدخل في المراجعة، ويُتابَع منه الربط إن كان أول ما يُحفظ)،
     أو محفوظ كله «~» (للمراجعة فقط)؛ والمتون بعد متون المستوى قد تكون من أي مستوى ولو لم تكن تالية لها. */
  function daysFrom(days, from) {
    const out = [];
    for (const d of days) {
      const r = PlanCore.parseRange(d);
      if (r.b < from) continue;
      out.push(r.a >= from ? d : PlanCore.fmt(r.level, from, r.b));
    }
    return out;
  }
  function daysBefore(days, from) {
    const out = [];
    for (const d of days) {
      const r = PlanCore.parseRange(d);
      if (r.a >= from) break;
      out.push(r.b < from ? d : PlanCore.fmt(r.level, r.a, from - 1));
    }
    return out;
  }
  const pageSpan = (t) => ({ a: PlanCore.parseRange(t.days[0]).a, b: PlanCore.parseRange(t.days[t.days.length - 1]).b });
  function mixPlan(id) {
    if (selCache[id]) return selCache[id];
    const m = /^mix:(.+)$/.exec(id || "");
    if (!m) return null;
    // «~id» متن محفوظ (يُراجَع ولا يُحفظ في الخطة)، و«id@صفحة» يبدأ حفظه منها
    const all = m[1].split(";").map((x) => {
      const done = x.startsWith("~");
      const [tid, from] = x.replace(/^~/, "").split("@");
      return { t: TEXTS.find((t) => t.id === tid), from: done ? 0 : +from || 0, done };
    });
    if (!all.length || all.some((x) => !x.t) || new Set(all.map((x) => x.t.id)).size !== all.length) return null;
    const done = all.filter((x) => x.done).map((x) => x.t.id);
    const segs = all.filter((x) => !x.done);
    if (!segs.length) return null;
    for (const x of segs) {
      const span = pageSpan(x.t);
      if (x.from && (x.from <= span.a || x.from > span.b)) x.from = 0;
      x.days = x.from ? daysFrom(x.t.days, x.from) : x.t.days;
    }
    if (segs.length === 1 && !segs[0].from && !done.length) return segs[0].t;
    // مستوى الخطة مستوى أول متونها في القائمة (ولو كان محفوظاً قبل البدء)
    const L = all[0].t.level;
    const at = (x) => (x.from ? ` من صفحة ${AR(x.from)}` : "");
    let t;
    if (segs.length === 1) {
      const x = segs[0];
      t = { id, base: x.t.id, level: L, name: AR(x.t.name) + at(x), title: x.t.title, qr: x.t.qr, days: x.days };
    } else {
      const same = segs.every((x) => x.t.level === L);
      t = {
        id,
        isLevel: true,
        isSel: true,
        isMix: true,
        level: L,
        name: `${same ? LEVEL_NAMES[L] : "متون مختارة"}: ${segs.map((x) => (SHORT[x.t.id] || AR(x.t.name)) + at(x)).join("، ")}`,
        title: same ? `خطة ${LEVEL_NAMES[L]}` : "خطة المتون",
        qr: null,
        parts: segs.map((x) => x.t.id),
        days: segs.flatMap((x) => x.days),
        segments: segs.map((x) => ({ id: x.t.id, days: x.days.length })),
      };
    }
    t.segs = segs.map((x) => ({ id: x.t.id, from: x.from }));
    t.done = done;
    // متون الخطة كلها بترتيبها كما في قائمة «المتون»: من أوله، أو من صفحة، أو محفوظ
    t.entries = all.map((x) => ({ id: x.t.id, mode: x.done ? "done" : x.from ? "from" : "whole", from: x.from }));
    return (selCache[id] = t);
  }
  // ما حُفظ من متن قبل صفحة البدء: «part:الطحاوية@150»
  function partText(id) {
    if (selCache[id]) return selCache[id];
    const m = /^part:([^@]+)@(\d+)$/.exec(id || "");
    const t = m && TEXTS.find((x) => x.id === m[1]);
    const days = t ? daysBefore(t.days, +m[2]) : [];
    if (!days.length) return null;
    return (selCache[id] = { id, base: t.id, isPart: true, level: t.level, name: `${AR(t.name)} إلى صفحة ${AR(+m[2] - 1)}`, title: t.title, qr: t.qr, days });
  }
  const segsOf = (t) => (t && t.segs) || [];
  const partsOf = (t) => segsOf(t).filter((x) => x.from).map((x) => getText(`part:${x.id}@${x.from}`)).filter(Boolean);
  const getText = (id) =>
    id === "level-1"
      ? level1Plan()
      : allTexts().find((t) => t.id === id) || LEVEL_PLANS.find((t) => t.id === id) || selectionPlan(id) || mixPlan(id) || partText(id);
  // رقم الخطة من متونها [{id, mode: whole|from|done, from}]: كلها من المستوى ومن أولها ← رقم المستوى أو المتن أو بعض متونه كما كان؛ وإلا «mix:»
  function compositionId(lvl, entries) {
    const ids = entries.map((e) => e.id);
    const inLevel = levelTexts(lvl).map((t) => t.id);
    const plain = entries.every((e) => e.mode === "whole");
    if (plain && ids.every((id) => inLevel.includes(id))) return selectionId(lvl, ids);
    if (plain && ids.length === 1) return ids[0];
    return "mix:" + entries.map((e) => (e.mode === "done" ? "~" + e.id : e.mode === "from" && e.from ? `${e.id}@${e.from}` : e.id)).join(";");
  }
  // متون الخطة بترتيبها وطريقة بدء كل منها
  const entriesOf = (t) => (t.entries ? t.entries.map((e) => Object.assign({}, e)) : ownIds(t).map((id) => ({ id, mode: "whole", from: 0 })));
  // متون المستوى في قائمة «المتون» بترتيب البرنامج (المستوى الأول: المختصر بطبعته ثم الأذكار والآداب)
  const levelTexts = (lvl) => (lvl === 1 ? [state.level1.edition, "adhkar"].map(getText) : TEXTS.filter((t) => t.level === lvl));
  // ما عُلِّم من متون المستوى في الخطة
  const ownIds = (t = state.text) => (t.isLevel ? t.parts.slice() : [baseOf(t)]);
  // الخطة من المتون المعلَّمة: كلها خطة المستوى كاملاً، وواحد منها خطته، وغير ذلك خطة تجمعها
  function selectionId(lvl, ids) {
    const all = levelTexts(lvl).map((t) => t.id);
    const picked = all.filter((id) => ids.includes(id));
    if (picked.length <= 1) return picked[0] || null;
    if (lvl === 1) return "level-1";
    if (picked.length === all.length && LEVEL_PLANS.some((t) => t.level === lvl)) return "level-" + lvl;
    return `sel:${lvl}:${picked.join(",")}`;
  }
  // «المستوى الخامس: الورقات، الطحاوية» (اسم خطة بعض المتون في ملف اكسل) ← خطة تلك المتون
  function selectionByName(name) {
    const m = /^(.+?):\s*(.+)$/.exec(name || "");
    if (!m) return null;
    const lvl = +Object.keys(LEVEL_NAMES).find((l) => norm(LEVEL_NAMES[l]) === norm(m[1]));
    if (!lvl) return null;
    const ids = m[2].split("،").map((x) => {
      const t = TEXTS.find((t) => t.level === lvl && (norm(SHORT[t.id] || "") === norm(x) || norm(t.name) === norm(x)));
      return t && t.id;
    });
    const id = ids.every(Boolean) && ids.length > 1 ? selectionId(lvl, ids) : null;
    return id && id.startsWith("sel:") ? getText(id) : null;
  }
  // متون المستوى غير المعلَّمة: لا تدخل في الخطة ولا في المراجعة ولا يُتابَع منها الربط.
  // (والخطة الجاهزة لمتن واحد على ترتيب البرنامج: ما قبله من مستواه محفوظ يُراجَع.)
  // المعلَّم في القائمة: ما في الخطة، وما عُلِّم منها محفوظاً
  const checkedIds = (t = state.text) => entriesOf(t).map((e) => e.id);
  function excludedIds(t = state.text) {
    if (!t || t.custom || state.prevInLevel) return new Set();
    const own = new Set(checkedIds(t));
    return new Set(levelTexts(levelOf(t)).map((x) => x.id).filter((id) => !own.has(id)));
  }
  const levelOf = (t) => (t.custom ? 0 : t.level);
  const pagesCache = {};
  const pagesOf = (id) =>
    id === "level-1" ? PlanCore.buildUnits(getText(id).days).length : id in pagesCache ? pagesCache[id] : (pagesCache[id] = PlanCore.buildUnits(getText(id).days).length);

  // متن من ملف مرفوع أو من خطة محفوظة ليس في «خطط المتون»
  function registerCustom(spec) {
    const same = customTexts.find((t) => t.name === spec.name && t.days.join() === spec.days.join());
    if (same) return same;
    const t = {
      id: "custom-" + (customTexts.length + 1),
      custom: true,
      name: spec.name || "خطة مرفوعة",
      level: 0,
      title: spec.title || `خطة ${spec.name || "مرفوعة"}.`,
      qr: null,
      days: spec.days.slice(),
    };
    customTexts.push(t);
    fillLevelSelect();
    return t;
  }

  function fillTeacher() {
    const list = !state.teacher || TEACHERS.includes(state.teacher) ? TEACHERS : TEACHERS.concat([state.teacher]);
    $("teacher").innerHTML =
      `<option value="">اختر المعلم</option>` + list.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
    $("teacher").value = state.teacher || "";
  }
  function fillHalaqa() {
    const list = HALAQAT.includes(state.halaqa.name) ? HALAQAT : HALAQAT.concat(state.halaqa.name ? [state.halaqa.name] : []);
    $("halaqa").innerHTML = list.map((h) => `<option value="${esc(h)}">${esc(h)}</option>`).join("");
    $("halaqa").value = state.halaqa.name || HALAQAT[0];
  }
  function fillLevelSelect() {
    // المستوى السادس والمتون الإضافية (٧) يظهران إذا كان فيهما متون
    const lvls = [1, 2, 3, 4, 5, 6, 7].filter((l) => l <= 5 || TEXTS.some((t) => t.level === l)).concat(customTexts.length ? [0] : []);
    $("level").innerHTML = lvls.map((l) => `<option value="${l}">${l ? LEVEL_NAMES[l] : "خطط مرفوعة"}</option>`).join("");
    if (state.text) $("level").value = String(levelOf(state.text));
  }
  // «ط. ٤٥» من اسم طبعة المختصر
  const editionLabel = (id) => {
    const name = AR(getText(id).name);
    const m = /\(([^()]*ط[^()]*)\)\s*$/.exec(name);
    return m ? m[1] : name;
  };
  // قائمة «المتون»: علامة صح لكل متن من المستوى (والخطط المرفوعة تُختار من قائمة)
  function fillTextSelect(lvl) {
    const custom = lvl === 0;
    const box = $("textChecks");
    box.hidden = custom;
    $("text").hidden = !custom;
    $("textLabel").textContent = custom ? "الخطة المرفوعة" : "المتون";
    box.dataset.text = state.text ? state.text.id : "";
    if (custom) {
      $("text").innerHTML = customTexts.map((t) => `<option value="${t.id}">${esc(AR(t.name))}</option>`).join("");
      if (state.text) $("text").value = state.text.id;
      return;
    }
    const ents = composition(lvl).entries;
    const byId = Object.fromEntries(ents.map((e) => [e.id, e]));
    const inLevel = levelTexts(lvl);
    const levelIds = new Set(inLevel.map((t) => t.id));
    // أيام كل متن في الخطة: من صفحة البدء إن كانت، و«محفوظ» لما عُلِّم محفوظاً كله
    const daysOf = (t, e) => (e && e.mode === "done" ? "محفوظ" : daysWord(e && e.mode === "from" && e.from ? daysFrom(t.days, e.from).length : t.days.length));
    const rows = inLevel.map((t, i) => {
      const e = byId[t.id];
      const ed = lvl === 1 && isMukhtasar(t);
      const label = ed ? AR(t.name).replace(/\s*\([^()]*ط[^()]*\)\s*$/, "") : AR(t.name);
      const editions = ed
        ? `<select id="l1Edition" aria-label="طبعة المختصر">${MUKHTASAR_EDITIONS.map((id) => `<option value="${id}"${id === t.id ? " selected" : ""}>${esc(editionLabel(id))}</option>`).join("")}</select>`
        : "";
      return (
        `<div class="tcheck${e ? "" : " is-off"}${e && e.mode === "done" ? " is-done" : ""}"><input type="checkbox" id="tc-${i}" data-id="${t.id}"${e ? " checked" : ""}><label for="tc-${i}">${esc(label)}</label>${editions}<span class="tdays">${e ? daysOf(t, e) : daysWord(t.days.length)}</span></div>` +
        (e ? startLine(t, e) : "")
      );
    });
    // متون أُضيفت بعدها من مستويات أخرى (ومستوى أُضيف أكثر من متن منه له رأس يُزال به كله)
    const appended = ents.filter((e) => !levelIds.has(e.id));
    let added = "";
    appended.forEach((e, i) => {
      const t = getText(e.id);
      const prev = i > 0 ? getText(appended[i - 1].id) : null;
      if (!prev || prev.level !== t.level) {
        let run = 1;
        while (i + run < appended.length && getText(appended[i + run].id).level === t.level) run++;
        if (run > 1)
          added += `<div class="tadded-head"><span>${esc(LEVEL_NAMES[t.level] || "")}</span><button type="button" class="link-btn" data-unappend-level="${t.level}">إزالة ${esc(LEVEL_NAMES[t.level] || "")}</button></div>`;
      }
      added +=
        `<div class="tcheck tadded${e.mode === "done" ? " is-done" : ""}"><span class="tplus" aria-hidden="true">+</span><span class="tname">${esc(AR(t.name))} <small>${esc(LEVEL_NAMES[t.level] || "")}</small></span><span class="tdays">${daysOf(t, e)}</span><button type="button" class="link-btn" data-unappend="${t.id}" aria-label="إزالة ${esc(AR(t.name))} من الخطة">إزالة</button></div>` +
        startLine(t, e);
    });
    // إضافة متن أو مستوى كامل بعدها
    const own = new Set(ents.map((e) => e.id));
    const hasEdition = MUKHTASAR_EDITIONS.some((x) => own.has(x) || levelIds.has(x));
    const candidates = TEXTS.filter((t) => !levelIds.has(t.id) && !own.has(t.id) && !(hasEdition && MUKHTASAR_EDITIONS.includes(t.id)));
    const groups = {};
    candidates.forEach((t) => (groups[t.level] = groups[t.level] || []).push(t));
    const lvls = Object.keys(groups).map(Number).filter((l) => l !== lvl);
    const wholeLevels = lvls.filter((l) => levelAppendIds(l, ents).length > 1);
    const more = lvls.length
      ? `<div class="tmore"><select id="appendText" aria-label="إضافة متن أو مستوى بعدها"><option value="">+ إضافة متن أو مستوى بعدها</option>` +
        (wholeLevels.length ? `<optgroup label="مستوى كامل">${wholeLevels.map((l) => `<option value="level:${l}">${esc(LEVEL_NAMES[l] || "")} كاملاً</option>`).join("")}</optgroup>` : "") +
        lvls.map((l) => `<optgroup label="${esc(LEVEL_NAMES[l] || "")}">${groups[l].map((t) => `<option value="${t.id}">${esc(AR(t.name))}</option>`).join("")}</optgroup>`).join("") +
        `</select></div>`
      : "";
    box.innerHTML =
      rows.join("") + added + more +
      `<p class="hint" id="textChecksNote">ما لا تعلّمه لا يدخل في الخطة ولا في المراجعة. وما قبل صفحة البدء، وما كان «محفوظاً كله»، يدخل في المراجعة ولا يُحفظ من جديد.</p>`;
  }
  // سطر «البدء» تحت كل متن في الخطة: من أوله، أو من صفحة معيّنة، أو محفوظ كله
  let startPending = null;
  function startLine(t, e) {
    const span = pageSpan(t);
    const mode = startPending === t.id ? "from" : e.mode;
    const sid = "ts-" + t.id;
    const opt = (v, label) => `<option value="${v}"${mode === v ? " selected" : ""}>${label}</option>`;
    return (
      `<div class="tstart" data-for="${t.id}"><label for="${sid}">البدء</label>` +
      `<select id="${sid}" data-start="${t.id}">${opt("whole", "من أوله")}${opt("from", "من صفحة…")}${opt("done", "محفوظ كله")}</select>` +
      (mode === "from"
        ? `<input class="mini" data-page="${t.id}" type="text" inputmode="numeric" autocomplete="off" aria-label="صفحة البدء في ${esc(AR(t.name))}" placeholder="${AR(span.a + 1)}" value="${e.mode === "from" && e.from ? AR(e.from) : ""}">` +
          `<span class="hint" data-hint="${t.id}">من ${AR(span.a + 1)} إلى ${AR(span.b)}</span>`
        : "") +
      `</div>`
    );
  }
  // متون مستوى كامل تُضاف بعد الخطة (ما ليس فيها منه؛ والمستوى الأول: المختصر بطبعته المختارة ثم الأذكار والآداب)
  function levelAppendIds(l, ents) {
    const own = new Set(ents.map((e) => e.id));
    const ids = l === 1 ? (MUKHTASAR_EDITIONS.some((x) => own.has(x)) ? [] : [state.level1.edition]).concat(["adhkar"]) : TEXTS.filter((t) => t.level === l).map((t) => t.id);
    return ids.filter((id) => !own.has(id));
  }
  // متون الخطة الحالية بترتيبها (إن كانت الخطة من هذا المستوى)
  function composition(lvl) {
    const t = state.text;
    if (!t || levelOf(t) !== lvl) return { entries: [] };
    return { entries: entriesOf(t) };
  }
  // خطة جديدة من متون مختارة: متون المستوى بترتيب البرنامج، ثم ما أُضيف بعدها بترتيب إضافته (ومتن واحد على الأقل يُحفظ)
  function recompose(entries) {
    const lvl = +$("level").value;
    const inLevel = levelTexts(lvl).map((t) => t.id);
    const all = inLevel
      .map((id) => entries.find((e) => e.id === id))
      .filter(Boolean)
      .concat(entries.filter((e) => !inLevel.includes(e.id)));
    if (!all.some((e) => inLevel.includes(e.id)) || !all.some((e) => e.mode !== "done")) return false;
    state.loaded = null;
    state.approved = null;
    // تغيّرت متون الخطة: تبدأ بأيامها الأصلية
    selectText(compositionId(lvl, all));
    renderLibrary();
    return true;
  }

  /* ---------- الحالة ---------- */
  const state = {
    text: null,
    // الخطط الجاهزة لمتن واحد: ما قبله من مستواه محفوظ (يُراجَع ويُتابَع منه الربط)
    prevInLevel: false,
    days: 0,
    maxDays: 0,
    link: Object.assign({}, DEFAULT_LINK),
    withReview: true,
    review: null,
    level1: validLevel1(null),
    halaqa: { enabled: false, name: HALAQAT[0] },
    student: { enabled: false, name: "" },
    teacher: "",
    dates: { enabled: false, start: null, weekdays: [0, 1, 2, 3, 4], fill: true },
    studyDates: [],
    title: "",
    plan: null,
    edits: {},
    loaded: null,
    approved: null,
  };

  const clampDays = (n) => Math.max(1, Math.min(Math.round(n) || 1, state.maxDays));
  // عدد أيام الربط في الخطط الأصلية؛ لخطة المستوى متوسط متونه بحسب أيامها
  function linkOrig(t) {
    if (!t.isLevel) return LINK_ORIG[baseOf(t)] || 3;
    const total = t.segments.reduce((a, sg) => a + sg.days, 0);
    return t.segments.reduce((a, sg) => a + (LINK_ORIG[sg.id] || 3) * sg.days, 0) / total;
  }
  function autoLinkDays() {
    return Math.max(1, Math.round((linkOrig(state.text) * state.days) / state.text.days.length));
  }
  // المتن السابق الذي يُتابَع منه الربط: آخر متن قبل مستوى الخطة (فمتون مستواها غير المعلَّمة لا تُعدّ محفوظة)،
  // ولأول المستوى الثاني آخر المستوى الأول؛ وفي الخطة الجاهزة لمتن واحد: ما قبله في ترتيب البرنامج
  function defaultPrev(t) {
    if (!t || t.custom) return null;
    // أول ما يُحفظ في الخطة يبدأ من صفحة: يتابع الربط مما قبلها منه
    const ents = entriesOf(t);
    const k = ents.findIndex((e) => e.mode !== "done");
    const e0 = ents[k];
    if (e0 && e0.mode === "from" && e0.from) return getText(`part:${e0.id}@${e0.from}`);
    // وقبله متون محفوظة: يتابع الربط من آخرها
    const before = ents.slice(0, k).filter((e) => e.mode === "done");
    if (before.length) return getText(before[before.length - 1].id);
    const first = t.isLevel ? getText(t.parts[0]) : getText(baseOf(t));
    if (!first || first.level <= 1) return null;
    const rest = TEXTS.filter((x) => x.level > 1 && x.level <= 6);
    // المتون الإضافية بعد المستوى السادس، وكل منها مستقل عن غيره
    if (first.level > 6) return rest[rest.length - 1] || null;
    const i = state.prevInLevel ? rest.indexOf(first) : rest.findIndex((x) => x.level === first.level);
    const l1 = level1Ids();
    return i > 0 ? rest[i - 1] : getText(l1[l1.length - 1]) || null;
  }
  const prevText = () => (state.link.enabled && state.link.cont ? getText(state.link.prevId) || defaultPrev(state.text) : null);

  function selectText(id, days, preset = {}) {
    const t = getText(id) || getText("level-1");
    // طبعة المختصر في الخطة هي طبعة المستوى الأول في القائمة وفي المراجعة
    const mk = t.custom || t.id === "level-1" ? null : checkedIds(t).find((x) => MUKHTASAR_EDITIONS.includes(x));
    if (mk) state.level1.edition = mk;
    state.text = t;
    state.maxDays = pagesOf(t.id);
    state.days = clampDays(days || t.days.length);
    // أيام الربط تعود إلى الأصل مع كل متن: عدد ثابت إن ضبطه صاحب الصفحة، وإلا تلقائياً من الخطة الأصلية
    if (!preset.keepLink) {
      state.link.daysManual = settings.link.days > 0;
      if (state.link.daysManual) state.link.days = settings.link.days;
      state.link.prevId = null;
    }
    state.title = AR(preset.title || t.title);
    fillLevelSelect();
    $("level").value = String(levelOf(t));
    fillTextSelect(levelOf(t));
    $("title").value = state.title;
    $("titleNote").hidden = !t.isLevel;
    renderTextInfo();
    $("daysRange").max = String(state.maxDays);
    $("maxNote").textContent = `من يوم واحد إلى ${daysWord(state.maxDays)} (صفحة في اليوم على الأقل).`;
    state.review = validReview(preset.review) || reviewFromPrefs(t, loadPrefs());
    renderReview();
    regenerate();
  }
  const segsOrParts = (t) => (t.segs ? t.segs : t.parts.map((id) => ({ id, from: 0 })));
  function renderTextInfo() {
    const t = state.text;
    const first = PlanCore.parseRange(t.days[0]);
    const last = PlanCore.parseRange(t.days[t.days.length - 1]);
    const edge = (r, v) => AR(PlanCore.fmt(r.level || null, v, v));
    $("textInfo").textContent = t.isLevel
      ? `في «خطط المتون»: ${daysWord(t.days.length)}، ${pagesWord(state.maxDays)}، متونه بالترتيب: ${segsOrParts(t).map((x) => AR(getText(x.id).name) + (x.from ? ` من صفحة ${AR(x.from)}` : "")).join("، ")}.`
      : `${t.custom ? "من الملف المرفوع" : "في «خطط المتون»"}: ${daysWord(t.days.length)}، ${pagesWord(state.maxDays)} من ${edge(first, first.a)} إلى ${edge(last, last.b)}.`;
  }

  function setDays(n) {
    if (!Number.isFinite(n)) return;
    state.days = clampDays(n);
    regenerate();
  }

  /* ---------- توليد الخطة ---------- */
  // اسم المتن الذي تبدأ مراجعته (في خانة الملاحظات)
  const noteName = (id) => {
    const t = id === "self" ? state.text : getText(id);
    return t ? SHORT[baseOf(t)] || AR(t.name) : "";
  };
  function buildPlan() {
    return PlanCore.makePlan(state.text, {
      days: state.days,
      link: state.link,
      prev: prevText(),
      withReview: state.withReview,
      review: planReview(),
      getText,
      noteName,
    });
  }
  function regenerate() {
    if (!state.link.daysManual) state.link.days = autoLinkDays();
    state.plan = buildPlan();
    state.edits = {};
    computeDates();
    syncControls();
    renderReadout();
    renderSheets();
    renderEdits();
    updateSaveArea();
    savePrefs();
  }

  function syncControls() {
    const active = document.activeElement;
    if (active !== $("days")) $("days").value = AR(state.days);
    $("daysRange").value = String(state.days);
    const N = state.text.days.length;
    const quick = $("quick");
    quick.innerHTML = "";
    for (const [label, val] of [["النصف", Math.round(N / 2)], ["الأصل", N], ["الضعف", N * 2]]) {
      if (val < 1 || val > state.maxDays) continue;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip" + (val === state.days ? " is-on" : "");
      b.setAttribute("aria-pressed", String(val === state.days));
      b.innerHTML = `${label} <span>${AR(val)}</span>`;
      b.addEventListener("click", () => setDays(val));
      quick.appendChild(b);
    }
    // الربط
    $("withLink").checked = state.link.enabled;
    $("linkBody").hidden = !state.link.enabled;
    $("linkByPages").checked = state.link.mode === "pages";
    $("linkByDays").checked = state.link.mode === "days";
    if (active !== $("linkPages")) $("linkPages").value = AR(state.link.pages);
    if (active !== $("linkDays")) $("linkDays").value = AR(state.link.days);
    $("linkAutoTag").hidden = state.link.daysManual;
    $("linkAuto").hidden = !state.link.daysManual;
    syncLinkPrev();
    // المراجعة
    $("withReview").checked = state.withReview;
    $("reviewBody").hidden = !state.withReview;
    $("fillPrev").disabled = !previousTexts(state.text).length;
    renderLevel1Controls();
    $("addReview").disabled = state.review.items.length >= MAX_REVIEW;
    // الحلقة
    $("withHalaqa").checked = state.halaqa.enabled;
    $("halaqa").disabled = !state.halaqa.enabled;
    $("withStudent").checked = state.student.enabled;
    $("student").disabled = !state.student.enabled;
    $("halaqa").value = state.halaqa.name;
    // التاريخ
    $("withDates").checked = state.dates.enabled;
    $("datesBody").hidden = !state.dates.enabled;
    $("fillDays").checked = state.dates.fill;
    syncDateControls();
  }

  function syncLinkPrev() {
    const dp = defaultPrev(state.text);
    const can = !!dp || state.text.custom || !!state.link.prevId;
    $("linkContRow").hidden = !can;
    $("linkCont").checked = state.link.cont;
    const sel = $("linkPrev");
    sel.hidden = !can || !state.link.cont;
    $("linkPrevNote").hidden = sel.hidden;
    if (!can) return;
    const own = new Set(ownIds(state.text));
    const cur = prevText();
    const groups = {};
    allTexts().forEach((t) => {
      if (!own.has(t.id)) (groups[t.level] = groups[t.level] || []).push(t);
    });
    const parts = partsOf(state.text);
    sel.innerHTML =
      (cur ? "" : `<option value="">اختر المتن السابق</option>`) +
      (parts.length ? `<optgroup label="قبل صفحة البدء">${parts.map((t) => `<option value="${t.id}">${esc(t.name)}</option>`).join("")}</optgroup>` : "") +
      Object.keys(groups)
        .map((lvl) => `<optgroup label="${LEVEL_NAMES[lvl] || "خطط مرفوعة"}">${groups[lvl].map((t) => `<option value="${t.id}">${esc(AR(t.name))}</option>`).join("")}</optgroup>`)
        .join("");
    sel.value = cur ? cur.id : "";
    $("linkPrevNote").textContent = cur
      ? `يبدأ ربط اليوم الأول من آخر ${state.link.mode === "days" ? daysAfter(state.link.days) + " من" : pagesAfter(state.link.pages) + " من"} ${AR(cur.name)}، ثم يقلّ منه ويزيد من الجديد.`
      : "";
  }

  function renderReadout() {
    const p = state.plan;
    const st = PlanCore.stats(p);
    $("rDays").textContent = AR(p.D);
    $("rDaysFrom").textContent = p.D === p.N ? `${unitWord(p.D)}، كالخطة الأصلية` : `${unitWord(p.D)} بدلاً من ${AR(p.N)}`;
    $("rLoad").textContent = AR(Math.round(st.ratio * 100)) + "٪";
    $("rPages").textContent = fmtNum(st.avg);
    $("rPagesNote").textContent = st.min === st.max ? "صفحة في اليوم" : `صفحة، من ${AR(st.min)} إلى ${AR(st.max)}`;
    $("rSheets").textContent = AR(Math.ceil(p.D / ROWS));
    $("exportBtnNote").textContent = `${AR(state.text.name)} في ${daysAfter(p.D)}${studentName() ? "، للطالب " + studentName() : ""}${state.halaqa.enabled ? "، حلقة " + state.halaqa.name : ""}`;
  }

  /* ---------- المراجعة الكبرى ----------
     طريقتان: «متون أختارها بالترتيب» (قائمة تبدأ من أول المختصر)، و«على حسب المستويات»
     (متن المستوى الأول ثم متون كل مستوى بالترتيب، كما في خطط المستويات). */
  // محتوى المستوى الأول المحفوظ عند العارض (وفي حفظ قديم: «متن المستوى الأول» في المراجعة)
  function level1FromPrefs(prefs) {
    if (prefs.level1) return validLevel1(prefs.level1);
    const g = prefs.review2 || prefs.review;
    const first = g && g.levels && g.levels.first;
    return validLevel1({ edition: first });
  }
  // أول ما يُراجَع: أول صفحة من المختصر، إلا في خطة المختصر نفسه أو المستوى الأول كاملاً فما حُفظ منه
  function defaultItems(t) {
    return [{ source: isMukhtasar(t) || t.id === "level-1" ? "self" : state.level1.edition, mode: settings.review.itemMode, value: settings.review.itemValue }];
  }
  function validReview(r) {
    if (!r || !Array.isArray(r.items)) return null;
    const excl = excludedIds();
    const own = new Set(state.text.isLevel ? [] : ownIds(state.text));
    const items = r.items
      .filter(
        (it) =>
          it &&
          (it.source === "self" || (getText(it.source) && it.source !== state.text.id && !own.has(it.source) && !excl.has(it.source))) &&
          (it.mode === "pages" || it.mode === "days")
      )
      .slice(0, MAX_REVIEW)
      .map((it) => ({ source: it.source, mode: it.mode, value: clampInt(it.value, 1, 999, 20) }));
    const lv = r.levels || {};
    return {
      method: r.method === "levels" ? "levels" : "list",
      items,
      repeat: r.repeat !== false,
      mergeShort: r.mergeShort !== false,
      levels: {
        pages: clampInt(lv.pages, 1, 999, 20),
        self: lv.self !== false,
        startOn: !!lv.startOn,
        start: clampInt(lv.start, 1, 7, 2),
      },
    };
  }
  // الأصل: المراجعة على حسب المستويات (ما لم يختر العارض غيرها من قبل)
  function reviewFromPrefs(t, prefs) {
    const g = prefs.review2 || {};
    const r = settings.review;
    const saved = !t.custom && prefs.reviewItems && prefs.reviewItems[t.id];
    return validReview({
      method: g.method || r.method,
      repeat: typeof g.repeat === "boolean" ? g.repeat : r.repeat,
      mergeShort: typeof g.mergeShort === "boolean" ? g.mergeShort : r.mergeShort,
      levels: g.levels || (prefs.review && prefs.review.levels) || { pages: r.pages, self: r.self },
      items: Array.isArray(saved) ? saved : defaultItems(t),
    });
  }

  // ما حفظه الطالب قبل الخطة بترتيب البرنامج: متن المستوى الأول ثم متون المستويات قبل مستوى الخطة
  // (ومن مستواها: المعلَّم هو الخطة نفسها، وغير المعلَّم لا يُراجَع؛ إلا في الخطة الجاهزة لمتن واحد)
  function previousTexts(t) {
    const own = new Set(ownIds(t));
    const l1 = t.custom || t.level > 1 ? level1Ids() : t.id === "adhkar" && state.prevInLevel ? [state.level1.edition] : [];
    const out = l1.filter((id) => !own.has(id)).map(getText);
    const rest = TEXTS.filter((x) => x.level > 1 && x.level <= 6);
    const upto =
      t.custom || t.level > 6 ? rest.length : t.isLevel || !state.prevInLevel ? rest.findIndex((x) => x.level === t.level) : rest.indexOf(t);
    return (upto > 0 ? out.concat(rest.slice(0, upto)) : out)
      .filter((x) => !own.has(x.id) && !(t.done || []).includes(x.id))
      .concat((t.done || []).map(getText), partsOf(t));
  }
  // المتن الذي يلي آخر متن في القائمة
  function nextReviewSource() {
    const items = state.review.items;
    const prev = previousTexts(state.text);
    const used = new Set(items.map((it) => it.source));
    const lastExt = items.slice().reverse().find((it) => it.source !== "self");
    let from = 0;
    if (lastExt) {
      const i = prev.findIndex((x) => x.id === lastExt.source);
      if (i >= 0) from = i + 1;
      else if (LEVEL1_BOOKS.includes(lastExt.source)) from = Math.max(0, prev.findIndex((x) => x.level > 1));
    }
    const next = prev.slice(from).find((x) => !used.has(x.id)) || prev.find((x) => !used.has(x.id));
    if (next) return next.id;
    return used.has("self") ? null : "self";
  }

  // تسلسل «على حسب المستويات» لمتن الخطة
  function levelSequence(t, lv) {
    const L = t.custom ? 7 : t.level;
    let seq = [];
    const own = new Set(ownIds(t));
    if (L > 1) {
      const ids = level1Ids().filter((id) => !own.has(id));
      if (ids.length) seq.push({ label: LEVEL_NAMES[1], names: ids.map((id) => AR(getText(id).name)), ids, lvl: 1 });
    } else if (!t.isLevel && t.id === "adhkar" && state.prevInLevel) {
      // الأذكار والآداب وحده في خطة جاهزة: يُراجَع المختصر قبله
      const e = state.level1.edition;
      seq.push({ label: AR(getText(e).name), ids: [e], lvl: 1 });
    }
    const firstPage = (x) => PlanCore.parseRange(x.days[0]).a;
    // متون كتاب المستوى بترتيب صفحاتها، ثم الكتب المستقلة (كبلوغ المرام والزاد) بترتيب البرنامج
    const inBooklet = (x) => PlanCore.parseRange(x.days[0]).level != null;
    const order = (a, b) => inBooklet(b) - inBooklet(a) || (inBooklet(a) ? firstPage(a) - firstPage(b) : TEXTS.indexOf(a) - TEXTS.indexOf(b));
    for (let lvl = 2; lvl <= Math.min(L, 6); lvl++) {
      let texts = TEXTS.filter((x) => x.level === lvl);
      const partial = lvl === L;
      // مستوى الخطة: ما عُلِّم منه هو «المتن نفسه»، وغير المعلَّم لا يُراجَع (إلا في الخطة الجاهزة لمتن واحد)
      if (partial && (t.isLevel || !state.prevInLevel)) continue;
      if (partial) texts = texts.slice(0, texts.indexOf(t));
      texts = texts.filter((x) => !own.has(x.id));
      if (!texts.length) continue;
      texts.sort(order);
      seq.push({
        label: partial ? `${LEVEL_NAMES[lvl]} قبل ${AR(t.name)}` : LEVEL_NAMES[lvl],
        names: texts.map((x) => AR(x.name)),
        ids: texts.map((x) => x.id),
        lvl,
      });
    }
    // ما حُفظ قبل البدء: المتون التي قبل متن البدء، وما قبل صفحة البدء منه
    const before = (t.done || []).filter((id) => !seq.some((g) => g.ids && g.ids.includes(id))).map(getText).concat(partsOf(t));
    if (before.length)
      seq.push({ label: "ما حُفظ قبل البدء", names: before.map((x) => AR(x.name)), ids: before.map((x) => x.id), lvl: Math.min(t.level, 6) });
    if (lv.self) seq.push({ label: t.isLevel ? (t.isMix ? "ما حُفظ من متون الخطة نفسها" : "ما حُفظ من متون المستوى نفسه") : "ما حُفظ من المتن نفسه", self: true, lvl: 7 });
    // البدء من مستوى معيّن: تبدأ الدورة منه، ثم تكمل وتعود إلى أولها
    if (lv.startOn && seq.length) {
      const i = seq.findIndex((g) => g.lvl >= lv.start);
      if (i > 0) seq = seq.slice(i).concat(seq.slice(0, i));
    }
    return seq;
  }
  // عناصر المراجعة التي تُبنى بها الخطة
  // المتون الأقل من ٢٠ صفحة المتتالية في القائمة من مستوى واحد تُراجَع معاً (كالنواقض والقواعد)
  const SHORT_PAGES = 20;
  function mergeShortItems(items) {
    const out = [];
    for (const it of items) {
      const t = it.source !== "self" ? getText(it.source) : null;
      const short = !!t && it.mode === "pages" && pagesOf(t.id) < SHORT_PAGES;
      const last = out[out.length - 1];
      if (short && last && last.short && last.level === t.level) {
        last.ids.push(t.id);
        continue;
      }
      out.push(short ? { source: "group", ids: [t.id], mode: "pages", value: it.value, short: true, level: t.level } : it);
    }
    return out;
  }
  function planReview() {
    const r = state.review;
    if (r.method !== "levels") return { items: r.mergeShort ? mergeShortItems(r.items) : r.items, repeat: r.repeat };
    const v = r.levels.pages;
    const items = levelSequence(state.text, r.levels).map((s) =>
      s.self ? { source: "self", mode: "pages", value: v } : { source: "group", ids: s.ids, mode: "pages", value: v }
    );
    return { items, repeat: r.repeat };
  }

  function reviewOptions(selected) {
    let html = "";
    const groups = {};
    const excl = excludedIds();
    const own = new Set(ownIds(state.text));
    allTexts().forEach((t) => {
      if (t.id !== state.text.id && !own.has(t.id) && !excl.has(t.id)) (groups[t.level] = groups[t.level] || []).push(t);
    });
    for (const lvl of Object.keys(groups)) {
      html += `<optgroup label="${LEVEL_NAMES[lvl] || "خطط مرفوعة"}">`;
      html += groups[lvl].map((t) => `<option value="${t.id}"${t.id === selected ? " selected" : ""}>${esc(AR(t.name))}</option>`).join("");
      html += "</optgroup>";
    }
    const parts = partsOf(state.text);
    if (parts.length)
      html += `<optgroup label="قبل صفحة البدء">${parts.map((t) => `<option value="${t.id}"${t.id === selected ? " selected" : ""}>${esc(t.name)}</option>`).join("")}</optgroup>`;
    html += `<optgroup label="متن الخطة"><option value="self"${selected === "self" ? " selected" : ""}>المتن نفسه (ما حُفظ منه)</option></optgroup>`;
    return html;
  }
  function reviewNote(it) {
    if (it.source === "self") {
      return it.mode === "pages"
        ? `ما حُفظ من متن الخطة قبل الربط، بنحو ${pagesAfter(it.value)} في اليوم.`
        : `ما حُفظ من متن الخطة قبل الربط، يُقسَّم في كل دورة على ${daysAfter(it.value)}.`;
    }
    const P = pagesOf(it.source);
    if (it.mode === "pages") return `${pagesWord(P)} من أول صفحة، تُراجَع في ${daysAfter(Math.min(Math.ceil(P / it.value), P))}.`;
    return `${pagesWord(P)} من أول صفحة، بنحو ${pagesAfter(Math.max(1, Math.round(P / Math.min(it.value, P))))} في اليوم.`;
  }
  function renderReview() {
    const levels = state.review.method === "levels";
    $("methodList").checked = !levels;
    $("methodLevels").checked = levels;
    document.querySelectorAll(".method").forEach((m) => m.classList.toggle("is-on", m.querySelector("input").checked));
    $("listBody").hidden = levels;
    $("levelsBody").hidden = !levels;
    $("reviewRepeat").checked = state.review.repeat;
    $("mergeShort").checked = state.review.mergeShort;
    $("repeatLabel").textContent = levels ? "إذا انتهت الدورة تعود إلى أولها" : "إذا انتهت القائمة تعود إلى أولها";
    if (levels) renderLevels();
    else renderReviewList();
  }
  // محتوى المستوى الأول في المراجعة لما بعده (وفي الإنشاء: طبعة المختصر في قائمة «المتون»)
  function renderLevel1Controls() {
    const c = state.level1;
    const t = state.text;
    const L = t.custom ? 7 : t.level;
    $("revL1").hidden = !(L > 1);
    $("revAdhkarRow").hidden = !(L > 1);
    $("revEdition").value = c.edition;
    $("revAdhkar").checked = c.adhkar;
  }
  function renderLevels() {
    const lv = state.review.levels;
    renderLevel1Controls();
    if (document.activeElement !== $("levelPages")) $("levelPages").value = AR(lv.pages);
    $("levelSelf").checked = lv.self;
    // البدء من مستوى معيّن: يُختار من مجموعات الدورة بترتيبها الأصلي
    const base = levelSequence(state.text, Object.assign({}, lv, { startOn: false }));
    $("levelStartRow").hidden = base.length < 2;
    $("levelStartOn").checked = lv.startOn;
    const sel = $("levelStart");
    sel.hidden = !lv.startOn || base.length < 2;
    if (base.length) {
      sel.innerHTML = base.map((g) => `<option value="${g.lvl}">${esc(g.label)}</option>`).join("");
      sel.value = String((base.find((g) => g.lvl >= lv.start) || base[base.length - 1]).lvl);
    }
    const seq = levelSequence(state.text, lv);
    $("levelSeq").innerHTML = seq.length
      ? seq
          .map((s) => {
            if (s.self) return `<li><b>${esc(s.label)}</b> <span>قبل الربط، بنحو ${pagesAfter(lv.pages)} في اليوم.</span></li>`;
            const P = s.ids.reduce((n, id) => n + pagesOf(id), 0);
            const names = s.names ? `: ${esc(s.names.join("، "))}` : "";
            return `<li><b>${esc(s.label)}</b>${names} <span>— ${pagesWord(P)} في ${daysAfter(Math.ceil(P / lv.pages))}.</span></li>`;
          })
          .join("")
      : `<li class="is-empty">لا متون قبل هذا المتن؛ اختر «ما حُفظ من المتن نفسه» لتكون له مراجعة.</li>`;
  }
  function renderReviewList() {
    const ol = $("reviewList");
    const items = state.review.items;
    if (!items.length) {
      ol.innerHTML = `<li class="hint">القائمة فارغة؛ أضف متناً لمراجعته.</li>`;
      return;
    }
    ol.innerHTML = items
      .map(
        (it, i) => `
      <li class="ritem">
        <label class="ritem-label" for="rsrc-${i}">المتن ${ORDINALS[i]}</label>
        <div class="ritem-head"><select class="ritem-src" id="rsrc-${i}" data-i="${i}">${reviewOptions(it.source)}</select></div>
        <div class="ritem-amt">
          <select class="ritem-mode" id="rmode-${i}" data-i="${i}" aria-label="طريقة تحديد مقدار المراجعة">
            <option value="pages"${it.mode === "pages" ? " selected" : ""}>صفحات في اليوم</option>
            <option value="days"${it.mode === "days" ? " selected" : ""}>المدة بالأيام</option>
          </select>
          <input class="mini ritem-val" id="rval-${i}" data-i="${i}" type="text" inputmode="numeric" autocomplete="off" value="${AR(it.value)}" aria-label="${it.mode === "pages" ? "عدد صفحات المراجعة في اليوم" : "عدد أيام مراجعة المتن"}">
          <div class="ritem-move">
            <button type="button" data-act="up" data-i="${i}" aria-label="تقديم في الترتيب"${i === 0 ? " disabled" : ""}>▲</button>
            <button type="button" data-act="down" data-i="${i}" aria-label="تأخير في الترتيب"${i === items.length - 1 ? " disabled" : ""}>▼</button>
            <button type="button" data-act="del" data-i="${i}" aria-label="حذف من القائمة">✕</button>
          </div>
        </div>
        <p class="ritem-note" id="rnote-${i}">${esc(reviewNote(it))}</p>
      </li>`
      )
      .join("");
  }
  function reviewChanged(rerenderList) {
    if (rerenderList) renderReviewList();
    regenerate();
  }

  /* ---------- التاريخ الهجري ---------- */
  function fillDateSelects() {
    const days = Array.from({ length: 30 }, (_, i) => `<option value="${i + 1}">${AR(i + 1)}</option>`).join("");
    const months = Hijri.MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("");
    const y0 = Hijri.parts(Hijri.today()).y;
    const years = [y0 - 1, y0, y0 + 1, y0 + 2, y0 + 3].map((y) => `<option value="${y}">${AR(y)}</option>`).join("");
    for (const p of ["s", "e"]) {
      $(p + "d").innerHTML = days;
      $(p + "m").innerHTML = months;
      $(p + "y").innerHTML = years;
    }
    $("weekdays").innerHTML = Hijri.WEEKDAYS.map(
      (w, i) => `<button type="button" class="chip" data-wd="${i}" aria-pressed="false">${w}</button>`
    ).join("");
  }
  function readDate(p) {
    const y = +$(p + "y").value;
    const m = +$(p + "m").value;
    const d = Math.min(+$(p + "d").value, Hijri.monthLength(y, m));
    return Hijri.toGregorian(y, m, d);
  }
  function writeDate(p, date) {
    if (!date) return;
    const h = Hijri.parts(date);
    if (![...$(p + "y").options].some((o) => +o.value === h.y)) $(p + "y").insertAdjacentHTML("beforeend", `<option value="${h.y}">${AR(h.y)}</option>`);
    $(p + "y").value = String(h.y);
    $(p + "m").value = String(h.m);
    $(p + "d").value = String(h.d);
  }
  function computeDates() {
    const d = state.dates;
    state.studyDates = d.enabled && d.start ? Hijri.studyDates(d.start, d.weekdays, state.plan.D) : [];
  }
  function syncDateControls() {
    if (!state.dates.enabled) return;
    writeDate("s", state.dates.start);
    const sd = state.studyDates;
    if (sd.length) writeDate("e", sd[sd.length - 1]);
    $("weekdays").querySelectorAll("[data-wd]").forEach((b) => b.setAttribute("aria-pressed", String(state.dates.weekdays.includes(+b.dataset.wd))));
    $("datesInfo").textContent = sd.length
      ? `من ${AR(Hijri.long(sd[0]))} إلى ${AR(Hijri.long(sd[sd.length - 1]))} هـ، ${daysWord(sd.length)} دراسية.`
      : "اختر يوماً دراسياً واحداً على الأقل.";
  }
  // «١٤٤٨/٥/٢» المحفوظة ← تاريخ ميلادي
  function fromHijriShort(text) {
    const [y, m, d] = String(text || "").split("/").map(Number);
    return y && m && d ? Hijri.toGregorian(y, m, d) : null;
  }
  const tableDates = () => (state.dates.enabled && state.dates.fill ? state.studyDates : []);
  // «٢/٥/١٤٤٨ ه - ١/٦/١٤٤٨ ه.»: اليوم ثم الشهر ثم السنة من اليمين، في الملف والمعاينة
  function durationText() {
    const sd = state.studyDates;
    if (!state.dates.enabled || !sd.length) return null;
    return `${Hijri.dmy(sd[0])} ه - ${Hijri.dmy(sd[sd.length - 1])} ه.`;
  }
  // تغيير التاريخ دون تغيير الأيام: يكفي إعادة رسم المعاينة
  function datesChanged() {
    computeDates();
    syncDateControls();
    renderSheets();
    updateSaveArea();
    savePrefs();
  }

  /* ---------- المعاينة ---------- */
  const COLS = ["memo", "link", "big", "note"];
  const COL_LABEL = { memo: "الحفظ", link: "الربط", big: "المراجعة الكبرى", note: "الملاحظات" };
  const studentName = () => (state.student.enabled ? state.student.name.trim() : "");
  function cellValue(i, col) {
    const k = i + ":" + col;
    return k in state.edits ? state.edits[k] : state.plan.rows[i][col];
  }
  function currentTitle() {
    return ($("title").value || AR(state.text.title)).trim();
  }
  function currentRows() {
    const dates = tableDates();
    return state.plan.rows.map((r, i) => {
      const row = { memo: cellValue(i, "memo"), link: cellValue(i, "link"), big: cellValue(i, "big"), note: cellValue(i, "note"), texts: r.texts };
      if (dates[i]) {
        row.day = Hijri.WEEKDAYS[dates[i].getUTCDay()];
        row.date = Hijri.dm(dates[i]); // اليوم/الشهر
      }
      return row;
    });
  }

  // خط الملاحظة يصغر مع طولها كما في ملف الوورد، وتتوسط الخانة القصيرة
  function noteStyle(text) {
    const n = text.length;
    if (n <= 16) return "font-size:12px;padding-top:11px";
    if (n <= 26) return "font-size:11px;padding-top:5px";
    return "font-size:10px;padding-top:1px";
  }
  // لكل ٢٢ يوماً صفحة: عنوانها ورموز الاستماع لمتونها (في خطة المستوى: متون تلك الصفحة)
  const QR_SLOTS = { 1: ["r1"], 2: ["r1", "l1"], 3: ["r1", "l2", "l1"], 4: ["r1", "r2", "l2", "l1"] };
  function sheetInfo(rows) {
    const out = [];
    for (let s = 0; s * ROWS < rows.length; s++) {
      const ids = [];
      rows.slice(s * ROWS, (s + 1) * ROWS).forEach((r) => (r.texts || []).forEach((id) => ids.includes(id) || ids.push(id)));
      const texts = state.text.isLevel ? ids.map(getText).filter(Boolean) : [state.text];
      const title = state.text.isLevel
        ? `${state.title.trim().replace(/[.\s]+$/, "")} – ${texts.map((t) => AR(t.name)).join("، و")}.`
        : state.title;
      const qrs = texts
        .filter((t) => t.qr && QR_IMAGES[t.qr])
        .slice(0, 4)
        .map((t) => ({ b64: QR_IMAGES[t.qr], name: SHORT[t.id] || AR(t.name) }));
      out.push({ title, qrs });
    }
    return out;
  }
  function updateSheetTitles() {
    const info = sheetInfo(currentRows());
    document.querySelectorAll(".sheet-title").forEach((h, i) => (h.textContent = info[i] ? info[i].title : state.title));
  }

  function renderSheets() {
    const rows = currentRows();
    const sheets = Math.ceil(rows.length / ROWS);
    const info = sheetInfo(rows);
    const halaqa = state.halaqa.enabled ? esc(state.halaqa.name) : "....................";
    const student = studentName() ? esc(studentName()) : "...............................";
    const dur = durationText();
    const durHtml = dur ? esc(AR(dur)) : `&nbsp;/&nbsp;&nbsp;&nbsp;&nbsp;/..${AR(144)} ه -&nbsp;&nbsp; /&nbsp;&nbsp;&nbsp;&nbsp;/..${AR(144)} ه.`;
    const frag = document.createDocumentFragment();
    for (let s = 0; s < sheets; s++) {
      const art = document.createElement("article");
      art.className = "sheet";
      art.setAttribute("aria-label", `الصفحة ${AR(s + 1)} من ${AR(sheets)}`);
      const head = document.createElement("div");
      const qrs = info[s].qrs;
      head.className = "sheet-head" + (qrs.length ? ` qrs-${qrs.length}` : " no-qr");
      const figs = qrs
        .map((q, i) => {
          const cap = qrs.length > 1 ? `للاستماع إلى ${esc(q.name)}:` : "للاستماع للمتن:";
          return `<figure class="qr slot-${QR_SLOTS[qrs.length][i]}"><figcaption>${cap}</figcaption><img src="data:image/png;base64,${q.b64}" alt="رمز الاستماع لمتن ${esc(q.name)}"></figure>`;
        })
        .join("");
      head.innerHTML = `
        ${figs}
        <h2 class="sheet-title"></h2>
        <p class="sheet-line"><b>اسم الطالب:</b> <span class="sheet-student">${student}</span>، <b>الحلقة:</b> ${halaqa}</p>
        <p class="sheet-line"><b>مدّة المستوى:</b> ${durHtml}</p>`;
      head.querySelector(".sheet-title").textContent = info[s].title;
      art.appendChild(head);
      const wrap = document.createElement("div");
      wrap.className = "table-wrap";
      const tbl = document.createElement("table");
      tbl.className = "plan";
      tbl.innerHTML = `
        <colgroup><col style="width:9.6%"><col style="width:8.3%"><col style="width:13.9%"><col style="width:7.9%"><col style="width:14.4%"><col style="width:7.4%"><col style="width:13.4%"><col style="width:8.3%"><col style="width:5.6%"><col style="width:11.2%"></colgroup>
        <thead>
          <tr><th colspan="2" rowspan="2">اليوم<br>التاريخ</th><th colspan="6">المقادير</th><th rowspan="2" class="vert"><span>استماع</span></th><th rowspan="2">ملاحظات</th></tr>
          <tr><th>الحفظ</th><th>أتم؟</th><th>الربط</th><th>أتم؟</th><th>م. الكبرى</th><th>أتم؟</th></tr>
        </thead>`;
      const tb = document.createElement("tbody");
      const end = Math.min(rows.length, (s + 1) * ROWS);
      for (let i = s * ROWS; i < end; i++) {
        const row = rows[i];
        const tr = document.createElement("tr");
        const cell = (col) => {
          const edited = i + ":" + col in state.edits;
          const attrs = `class="cell" id="c-${i}-${col}" data-i="${i}" data-col="${col}" aria-label="${COL_LABEL[col]} في اليوم ${AR(i + 1)}" autocomplete="off" spellcheck="false"`;
          const field = col === "note"
            ? `<textarea ${attrs} rows="3" style="${noteStyle(row.note || "")}">${esc(row.note || "")}</textarea>`
            : `<input ${attrs} value="${esc(disp(row[col]))}">`;
          return `<td class="val${col === "note" ? " note" : ""}${edited ? " is-edited" : ""}">${field}</td>`;
        };
        tr.innerHTML =
          `<td class="day" data-n="${AR(i + 1)}">${esc(row.day || "")}</td><td class="date">${row.date ? esc(AR(row.date)) : "/"}</td>` +
          ["memo", "link", "big"].map((col) => cell(col) + "<td></td>").join("") +
          `<td class="circle" aria-hidden="true">○</td>` +
          cell("note");
        tb.appendChild(tr);
      }
      tbl.appendChild(tb);
      wrap.appendChild(tbl);
      art.appendChild(wrap);
      const foot = document.createElement("p");
      foot.className = "sheet-foot";
      foot.textContent = `الصفحة ${AR(s + 1)} من ${AR(sheets)} · الأيام ${AR(s * ROWS + 1)}–${AR(end)}`;
      art.appendChild(foot);
      frag.appendChild(art);
    }
    $("sheets").replaceChildren(frag);
  }

  function updateStudentLine() {
    const v = studentName() || "...............................";
    document.querySelectorAll(".sheet-student").forEach((el) => (el.textContent = v));
  }

  function renderEdits() {
    const n = Object.keys(state.edits).length;
    $("edits").hidden = n === 0;
    $("editsCount").textContent = n === 1 ? "تعديل يدوي واحد" : n === 2 ? "تعديلان يدويان" : `${AR(n)} تعديلات يدوية`;
    updateSaveArea();
  }

  // وصف الخطة عند حفظها: مدتها، والحفظ من كذا إلى كذا، والمراجعة من كذا إلى كذا
  function describePlan(rows, D, dates, textNames, selfOnly) {
    const P = PlanCore.parseRange;
    const edge = (r, end) => disp(PlanCore.fmt(r.level, end ? r.b : r.a, end ? r.b : r.a));
    let text = daysWord(D);
    if (dates && dates.length) text += ` (من ${AR(Hijri.dmy(dates[0]))} إلى ${AR(Hijri.dmy(dates[dates.length - 1]))} ه)`;
    const memos = rows.map((r) => P(r.memo)).filter(Boolean);
    if (textNames && textNames.length > 1) text += `، الحفظ: ${textNames.join(" ثم ")}`;
    else if (memos.length) text += `، الحفظ من ${edge(memos[0])} إلى ${edge(memos[memos.length - 1], true)}`;
    const bigs = rows.map((r) => r.big).filter((b) => b && b !== "-").map((b) => P(b)).filter(Boolean);
    // مراجعة ما حُفظ من المتن نفسه وحده: دوراتها تعود إلى أوله كل حين، فتوصف بذلك
    if (bigs.length && selfOnly) text += `، والمراجعة فيما حُفظ من ${textNames && textNames.length > 1 ? "متون المستوى" : "المتن"} قبل الربط`;
    else if (bigs.length) {
      // نهاية الدورة الأولى: قبل أول خانة تعود إلى بداية المراجعة
      let end = bigs.length - 1;
      let again = false;
      for (let k = 1; k < bigs.length; k++) {
        if (bigs[k].level === bigs[0].level && bigs[k].a === bigs[0].a) {
          end = k - 1;
          again = true;
          break;
        }
      }
      text += `، والمراجعة من ${edge(bigs[0])} إلى ${edge(bigs[end], true)}${again ? " ثم تعود من أولها" : ""}`;
    }
    return text + ".";
  }
  const planTextNames = () => (state.text.isLevel ? state.text.parts.map((id) => SHORT[id] || AR(getText(id).name)) : null);
  const reviewIsSelf = () => {
    const items = state.withReview ? planReview().items : [];
    return items.length > 0 && items.every((it) => it.source === "self");
  };
  const planDescription = () => describePlan(currentRows(), state.plan.D, state.studyDates, planTextNames(), reviewIsSelf());
  // وصف خطة محفوظة قبل إضافة الوصف: يُحسب من صفوفها
  function savedDescription(p) {
    if (p.description) return p.description;
    const rows = (p.rows || []).map(([memo, link, big]) => ({ memo, link, big }));
    if (!rows.length) return "";
    const start = p.dates && p.dates.start ? fromHijriShort(p.dates.start) : null;
    const dates = start ? Hijri.studyDates(start, p.dates.weekdays || [0, 1, 2, 3, 4], rows.length) : [];
    return describePlan(rows, p.days || rows.length, dates);
  }

  // يجعل صفوفاً معيّنة هي الظاهرة في الخطة (من خطة محفوظة أو ملف مرفوع)
  function applyRows(rows) {
    state.edits = {};
    rows.slice(0, state.plan.rows.length).forEach((r, i) => {
      for (const col of COLS) {
        const v = r[col];
        if (v != null && v !== "" && v !== state.plan.rows[i][col]) state.edits[i + ":" + col] = v;
      }
    });
    renderSheets();
    renderEdits();
  }

  /* ---------- الحفظ في ملف ---------- */
  let downloadsPromise = null;
  function getDownloads() {
    if (!downloadsPromise) {
      downloadsPromise =
        window.claude && typeof window.claude.use === "function" ? window.claude.use("downloads").catch(() => null) : Promise.resolve(null);
    }
    return downloadsPromise;
  }
  async function offerFile(blob, filename, st = $("status")) {
    const downloads = await getDownloads();
    if (downloads) {
      try {
        await downloads.save({ filename, data: blob });
        setStatus(st, "حُفظ الملف.", "ok");
      } catch (err) {
        const code = err && err.code;
        const msg =
          code === "declined" ? "لم يُحفظ الملف." :
          code === "rate_limited" ? "هناك نافذة حفظ مفتوحة؛ أكملها ثم أعد المحاولة." :
          code === "extension_not_enabled" ? "حفظ هذا النوع من الملفات غير متاح في هذا العرض." :
          "تعذّر حفظ الملف في هذا العرض.";
        setStatus(st, msg, code === "declined" ? "" : "error");
      }
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
    setStatus(st, SITE_MODE ? "بدأ تنزيل الملف." : "بدأ التنزيل. إن لم يظهر الملف فافتح الصفحة من claude.ai.", "ok");
  }
  function baseFilename() {
    const halaqa = state.halaqa.enabled ? ` - حلقة ${state.halaqa.name}` : "";
    const student = studentName() ? ` - ${studentName()}` : "";
    return `خطة ${state.text.name} - ${asciiDays(state.plan.D)}${student}${halaqa}`.replace(/[\\/:*?"<>|]/g, "-");
  }
  async function withBusy(btn, label, fn, st = $("status")) {
    btn.disabled = true;
    setStatus(st, label, "busy");
    try {
      await fn();
    } catch (err) {
      console.error(err);
      setStatus(st, "تعذّر: " + (err && err.message ? err.message : "خطأ غير معروف"), "error");
    } finally {
      btn.disabled = false;
    }
  }
  // ملف وورد للخطة الحالية (للتنزيل، أو للنقل إلى الخطط الجاهزة)
  function docxBlob() {
    const rows = currentRows();
    return DocxBuilder.build({
      templateB64: TEMPLATE_DOCX,
      title: currentTitle(),
      rows,
      sheets: sheetInfo(rows),
      halaqa: state.halaqa.enabled ? state.halaqa.name : "",
      student: studentName(),
      duration: durationText(),
    });
  }
  function exportDocx(btn = $("export"), st = $("status")) {
    return withBusy(btn, "جارٍ إعداد ملف وورد…", async () => {
      await offerFile(await docxBlob(), baseFilename() + ".docx", st);
    }, st);
  }
  // ملف PDF بمقاسات ملف وورد نفسه (صفحة لكل ٢٢ يوماً)
  function pdfRows(rows) {
    return rows.map((r) => ({
      memo: r.memo ? disp(r.memo) : "",
      link: r.link ? disp(r.link) : "",
      big: r.big ? disp(r.big) : "",
      note: r.note || "",
      day: r.day || "",
      date: r.date ? AR(r.date) : "",
    }));
  }
  function buildPdf(rows, sheets, extra = {}) {
    const dur = extra.duration === undefined ? durationText() : extra.duration;
    return PdfBuilder.build({
      rows: pdfRows(rows),
      sheets,
      student: extra.student === undefined ? studentName() : extra.student,
      halaqa: extra.halaqa === undefined ? (state.halaqa.enabled ? state.halaqa.name : "") : extra.halaqa,
      duration: dur ? AR(dur) : "",
      watermarkB64: typeof WATERMARK_JPG !== "undefined" ? WATERMARK_JPG : "",
      digits: (n) => AR(n),
      title: extra.title || baseFilename(),
      producer: "الخطط العلميّة – برنامج تأهيل",
    });
  }
  function pdfBlob() {
    const rows = currentRows();
    return buildPdf(rows, sheetInfo(rows));
  }
  function exportPdf(btn = $("exportPdf"), st = $("status")) {
    return withBusy(btn, "جارٍ إعداد ملف PDF…", async () => {
      await offerFile(await pdfBlob(), baseFilename() + ".pdf", st);
    }, st);
  }
  /* ---------- ملف اكسل بطريقة التسجيل اليومي ----------
     الخطة كما تُكتب في ورقة «بيانات الخطط» في ملف التسجيل اليومي للحلقة (ومنها تختار بطاقة الطالب خطته):
     اسم المستوى واسم المتن، ثم لكل يوم «مقدار» فيه الحفظ والربط والكبرى (جزء، من، إلى)، و«تجاوز الإجمالي» عدد صفحات
     المقدار إذا امتد بين جزأين أو رجعت صفحاته، وصيغ الإجماليات كما هي هناك. كل خطة هناك ١٠٦ صفوف وفيها ١٠٠ مقدار على الأكثر،
     فكل ورقة هنا خطة واحدة: تُنسخ A1:P105 وتُلصق في أول خلية من خطة فارغة (والأطول من ١٠٠ يوم في أوراق متتالية).
     والورقة الأخيرة الخطة بالأيام كما في الموقع (بتواريخها وملاحظاتها)، ومنها تُرفع الخطة إلى الموقع.
     ويختار صاحب الصفحة من لوحة التحكم هذه الصيغة أو الجدول البسيط وحده. */
  const DAILY = { block: 106, max: 100, slots: 30 };
  const DAILY_STYLES = (() => {
    const c = { dark: "0E6B76", mid: "3E92A0", ink: "1F4E78", input: "FFF7DE", box: "CFEBEF", over: "FCD9B6", overInk: "C0521A", num: "E7EBEC", line: "B9C4C6" };
    const cell = (o) => Object.assign({ font: "Arial", size: 11, border: c.line, h: "center", wrap: true }, o);
    return {
      lbl: cell({ bold: true, color: "FFFFFF", fill: c.dark, h: "right" }),
      inp: cell({ bold: true, color: c.ink, fill: c.input, h: "right" }),
      boxLbl: cell({ bold: true, size: 10, color: "FFFFFF", fill: c.mid, h: "right" }),
      box: cell({ bold: true, color: c.dark, fill: c.box }),
      head: cell({ bold: true, color: "FFFFFF", fill: c.mid }),
      headOver: cell({ bold: true, size: 9, color: "FFFFFF", fill: c.over }),
      headTot: cell({ bold: true, size: 9, color: "FFFFFF", fill: c.dark }),
      sub: cell({ bold: true, size: 10, color: "FFFFFF", fill: c.mid }),
      num: cell({ bold: true, color: "000000", fill: c.num }),
      val: cell({ color: c.ink, fill: c.input }),
      over: cell({ color: c.overInk, fill: c.over }),
      tot: cell({ color: c.dark, fill: c.box }),
      noteTitle: { font: "Arial", size: 13, bold: true, color: c.dark, h: "right" },
      note: { font: "Arial", size: 11, color: "000000", h: "right" },
      noteHead: cell({ bold: true, color: "FFFFFF", fill: c.mid }),
      noteCell: cell({ color: "000000" }),
    };
  })();
  // أول صفحة وآخرها في المتن الذي فيه الصفحة p من الجزء lv (لخانة عدّلها المستخدم بصيغة «١/٢٥٨←٢/٨٢»)
  function textSpanAt(lv, p) {
    if (lv == null) return null;
    for (const t of allTexts()) {
      const us = PlanCore.buildUnits(t.days);
      if (us.length && us[0].level === lv && us.some((u) => u.page === p)) return { a: us[0].page, b: us[us.length - 1].page };
    }
    return null;
  }
  // نص خانة ← قطع صفحاتها [{level, from, to}]، أو null إن لم يُفهم
  function runsOfText(s) {
    const t = ASCII(stripMarks(s)).replace(/[–—]/g, "-").replace(/\s+/g, "");
    if (!t || t === "-") return [];
    const ends = t.split("←");
    if (ends.length === 2) {
      const a = PlanCore.parseRange(ends[0]);
      const b = PlanCore.parseRange(ends[1]);
      const sa = a && textSpanAt(a.level, a.a);
      const sb = b && textSpanAt(b.level, b.b);
      if (!sa || !sb || a.level === b.level) return null;
      return [{ level: a.level, from: a.a, to: sa.b }, { level: b.level, from: sb.a, to: b.b }];
    }
    if (ends.length > 2) return null;
    const runs = [];
    for (const piece of t.split("+")) {
      const r = PlanCore.parseRange(piece);
      if (!r) return null;
      runs.push({ level: r.level, from: r.a, to: r.b });
    }
    // «٢/١٣٣-١٤٠+٢٥-٢٦»: جزء أول القطع لما بعدها
    for (let i = 1; i < runs.length; i++) if (runs[i].level == null) runs[i].level = runs[i - 1].level;
    return runs;
  }
  // قطع صفحات خانة كما في الخطة، أو كما عدّلها المستخدم
  function cellRuns(i, col) {
    const k = i + ":" + col;
    if (k in state.edits) return runsOfText(state.edits[k]);
    const r = state.plan.rows[i];
    return r.runs ? r.runs[col] || [] : runsOfText(r[col]);
  }
  /* قطع الصفحات ← [جزء، من، إلى، تجاوز الإجمالي]
     جزء «-» للمتن المطبوع وحده بلا جزء، و«١←٢» لمقدار يمتد من جزء إلى آخر؛ ومن وإلى أول صفحة وآخرها؛
     وتجاوز الإجمالي مجموع صفحات القطع إذا كانت أكثر من قطعة (امتد بين جزأين أو رجعت صفحاته)، فلا يُحسب «إلى − من + ١» */
  function dailyCells(runs, text) {
    if (runs === null) return ["-", ASCII(stripMarks(text)), "-", null];
    if (!runs.length) return ["-", "-", "-", null];
    const a = runs[0];
    const b = runs[runs.length - 1];
    const part = a.level === b.level ? (a.level == null ? "-" : a.level) : a.level != null && b.level != null ? `${a.level}←${b.level}` : "-";
    const over = runs.length > 1 ? runs.reduce((n, r) => n + r.to - r.from + 1, 0) : null;
    return [part, a.from, b.to, over];
  }
  // اسم المستوى واسم المتن (في قائمة «اختر خطة المستوى» في بطاقة الطالب: «خطة ١٠ - المستوى ٢ - …»)
  function dailyNames() {
    const t = state.text;
    const lvl = t.custom ? 0 : t.level;
    const level = lvl >= 1 && lvl <= 6 ? `المستوى ${lvl}` : lvl === 7 ? LEVEL_NAMES[7] : "خطة خاصة";
    const segs = t.segs || (t.isLevel ? t.parts.map((id) => ({ id, from: 0 })) : [{ id: baseOf(t), from: 0 }]);
    const nameOf = (id) => {
      const x = getText(id);
      return segs.length === 1 ? (x ? x.name : id) : SHORT[id] || (x ? x.name : id);
    };
    let text = t.custom ? t.name : segs.map((x) => nameOf(x.id) + (x.from ? ` من ص${x.from}` : "")).join("-");
    if (state.plan.D !== t.days.length) text += ` (${asciiDays(state.plan.D)})`;
    if (studentName()) text += ` - ${studentName()}`;
    return { level, text: ASCII(text).replace(/\s+/g, " ").trim() };
  }
  // أوراق «بيانات الخطط»: كل ورقة خطة واحدة (١٠٠ مقدار على الأكثر) بالصفوف والصيغ والألوان كما في ملف التسجيل اليومي
  function dailySheets() {
    const portions = state.plan.rows.map((_, i) => {
      const cells = ["memo", "link", "big"].map((col) => dailyCells(cellRuns(i, col), cellValue(i, col)));
      return cells.flatMap((c) => c.slice(0, 3)).concat(cells.map((c) => c[3]));
    });
    // «الإجمالي الفعلي» لكل بند كما تحسبه صيغة الملف
    const total = (p, j) => (p[9 + j] != null ? p[9 + j] : typeof p[3 * j + 1] === "number" && typeof p[3 * j + 2] === "number" ? p[3 * j + 2] - p[3 * j + 1] + 1 : "");
    const names = dailyNames();
    const K = Math.ceil(portions.length / DAILY.max);
    const S = (v, st) => ({ v, s: st });
    const sheets = [];
    for (let k = 0; k < K; k++) {
      const rows = [];
      const merges = [];
      const part = portions.slice(k * DAILY.max, (k + 1) * DAILY.max);
      const first = 6;
      const last = 5 + DAILY.max;
      const sums = [0, 1, 2].map((j) => part.reduce((n, p) => n + (typeof total(p, j) === "number" ? total(p, j) : 0), 0));
      const count = part.filter((p) => typeof total(p, 0) === "number").length;
      const text = K > 1 ? `${names.text} (${k + 1} من ${K})` : names.text;
      const head = [
        ["اسم/رقم المستوى:", names.level, "إجمالي صفحات الحفظ:", { f: `IFERROR(SUM(N${first}:N${last}),0)`, v: sums[0], s: "box" }],
        ["اسم المتن:", text, "إجمالي صفحات الربط:", { f: `IFERROR(SUM(O${first}:O${last}),0)`, v: sums[1], s: "box" }],
        ["عدد مقادير الخطة (تلقائي):", { f: `COUNT(N${first}:N${last})`, v: count, s: "box" }, "إجمالي صفحات الكبرى:", { f: `IFERROR(SUM(P${first}:P${last}),0)`, v: sums[2], s: "box" }],
      ];
      head.forEach(([l, v, bl, bx], n) => {
        const val = typeof v === "object" ? v : S(v, "inp");
        rows[n] = [S(l, "lbl"), S(null, "lbl"), S(null, "lbl"), val, S(null, val.s), S(null, val.s), S(bl, "boxLbl"), S(null, "boxLbl"), bx, S(null, "box")];
        merges.push(`A${n + 1}:C${n + 1}`, `D${n + 1}:F${n + 1}`, `G${n + 1}:H${n + 1}`, `I${n + 1}:J${n + 1}`);
      });
      const h = (v) => S(v, "head");
      rows[3] = [h("م"), h("الحفظ"), h(null), h(null), h("الربط"), h(null), h(null), h("الكبرى"), h(null), h(null),
        S("تجاوز الإجمالي (اختياري - إن كان المقدار يمتد بين جزأين)", "headOver"), S(null, "headOver"), S(null, "headOver"),
        S("الإجمالي الفعلي (يُستخدم في كل الحسابات)", "headTot"), S(null, "headTot"), S(null, "headTot")];
      rows[4] = [h(null)].concat(["جزء", "من", "إلى", "جزء", "من", "إلى", "جزء", "من", "إلى", "حفظ", "ربط", "كبرى", "حفظ", "ربط", "كبرى"].map((x) => S(x, "sub")));
      merges.push("A4:A5", "B4:D4", "E4:G4", "H4:J4", "K4:M4", "N4:P4");
      const heights = { 0: 19.5, 1: 18, 2: 18, 3: 24, 4: 15.75 };
      for (let m = 0; m < DAILY.max; m++) {
        const p = part[m];
        const rr = 6 + m;
        const tot = (j, a, bb, o) => ({ f: `IFERROR(IF(${o}${rr}<>"",${o}${rr},IF(${a}${rr}="","",${bb}${rr}-${a}${rr}+1)),"")`, v: p ? total(p, j) : "", s: "tot" });
        rows[5 + m] = [S(m + 1, "num")]
          .concat(Array.from({ length: 9 }, (_, j) => S(p ? p[j] : null, "val")))
          .concat([0, 1, 2].map((j) => S(p && p[9 + j] != null ? p[9 + j] : null, "over")))
          .concat([tot(0, "C", "D", "K"), tot(1, "F", "G", "L"), tot(2, "I", "J", "M")]);
        heights[5 + m] = 15;
      }
      const widths = Array(21).fill(0);
      widths.fill(10, 0, 10);
      widths.fill(11, 10, 16);
      sheets.push({ name: K > 1 ? `للصق ${k + 1} من ${K}` : "للصق في بيانات الخطط", rows, merges, heights, widths });
    }
    // طريقة اللصق وأول صف لكل خطة في «بيانات الخطط»، بجانب الخطة في الورقة الأولى (لا تدخل فيما يُنسخ)
    const sh = sheets[0];
    const lines = [
      ["طريقة إضافة هذه الخطة إلى ملف التسجيل اليومي (بطاقات الطلاب)", "noteTitle"],
      ["1- في ملف الحلقة أظهر ورقة «بيانات الخطط» (مخفية في الملف)، واختر خطة فارغة: عدد مقاديرها 0 في جدول الخطط (العمود U).", "note"],
      ["2- انسخ من هذه الورقة الخلايا من A1 إلى P105، والصقها في الخلية A من أول صف في تلك الخطة (انظر الجدول المجاور).", "note"],
      [
        K > 1
          ? `   الخطة أطول من ${DAILY.max} يوم فهي في ${K} أوراق: الصق الأولى في خطة فارغة، والثانية في الخطة التي تليها${K > 2 ? "، وهكذا" : ""}.`
          : "   مثلاً الخطة 10: اكتب A955 في مربع الاسم أعلى الورقة، ثم الصق (Ctrl+V).",
        "note",
      ],
      [`3- تظهر في قائمة «اختر خطة المستوى» في بطاقة الطالب باسم: خطة (رقمها) - ${names.level} - ${K > 1 ? names.text + " (1 من " + K + ")" : names.text}`, "note"],
      ["", "note"],
      ["• خانة «جزء» فيها «-» للمتن المطبوع وحده بلا جزء، و«1←2» للمقدار الممتد من الجزء 1 إلى الجزء 2.", "note"],
      ["• «تجاوز الإجمالي» فيه عدد صفحات المقدار إذا امتد بين جزأين أو رجعت صفحاته (كآخر متن وأول الذي يليه)، فتُحسب صفحاته صحيحة في البطاقة والإحصائيات.", "note"],
      ["• الورقة الأخيرة «الخطة بالأيام» فيها الخطة كما في الموقع بتواريخها وملاحظاتها، ومنها تُرفع الخطة إلى الموقع.", "note"],
    ];
    const at = (r, c, cell) => {
      sh.rows[r] = sh.rows[r] || [];
      sh.rows[r][c] = cell;
    };
    lines.forEach(([t, st], r) => at(r, 17, S(t, st)));
    at(0, 19, S("رقم الخطة", "noteHead"));
    at(0, 20, S("أول صف", "noteHead"));
    for (let n = 1; n <= DAILY.slots; n++) {
      at(n, 19, S(n, "noteCell"));
      at(n, 20, S(1 + DAILY.block * (n - 1), "noteCell"));
    }
    Object.assign(sh.widths, { 16: 3, 17: 125, 18: 3, 19: 11, 20: 11 });
    sheets.forEach((x) => (x.rows = Array.from(x.rows, (r) => r || [])));
    return sheets;
  }
  // الخطة بالأيام كما في الموقع (ومنها تُرفع الخطة إلى الموقع)
  function daysSheet(name = "الخطة") {
    const dur = durationText();
    const head = [
      ["المتن", AR(state.text.name)],
      ["عنوان الخطة", currentTitle()],
      ["اسم الطالب", studentName()],
      ["الحلقة", state.halaqa.enabled ? state.halaqa.name : ""],
      ["المدة", dur ? AR(dur) : ""],
      [],
      ["رقم اليوم", "اليوم", "التاريخ", "الحفظ", "الربط", "المراجعة الكبرى", "ملاحظات"],
    ];
    const body = currentRows().map((r, i) => [i + 1, r.day || "", r.date ? AR(r.date) : "", disp(r.memo), disp(r.link), disp(r.big), r.note || ""]);
    return XlsxLite.simpleSheet(head.concat(body), { sheetName: name, widths: [12, 12, 12, 16, 16, 18, 24], bold: [0, 1, 2, 3, 4, 6] });
  }
  function xlsxBlob() {
    if (settings.excel !== "daily") return XlsxLite.writeBook([daysSheet()]);
    return XlsxLite.writeBook(dailySheets().concat([daysSheet("الخطة بالأيام")]), { styles: DAILY_STYLES });
  }
  function exportXlsx() {
    return withBusy($("exportXlsx"), "جارٍ إعداد ملف اكسل…", async () => {
      await offerFile(await xlsxBlob(), baseFilename() + ".xlsx");
    });
  }

  /* ---------- رفع خطة من اكسل ---------- */
  function parsePlanSheet(rows) {
    let header = -1;
    const cols = {};
    for (let r = 0; r < rows.length && header < 0; r++) {
      const row = rows[r] || [];
      if (!row.some((c) => norm(c).startsWith("الحفظ"))) continue;
      header = r;
      row.forEach((c, i) => {
        const t = norm(c);
        if (t.startsWith("الحفظ")) cols.memo = i;
        else if (t.startsWith("الربط")) cols.link = i;
        else if (t.includes("الكبرى") || t.startsWith("المراجعة")) cols.big = i;
        else if (t.startsWith("ملاحظات") || t.startsWith("الملاحظات")) cols.note = i;
      });
    }
    const meta = {};
    for (const row of header >= 0 ? rows.slice(0, header) : []) {
      const k = norm(row && row[0]);
      const v = norm(row && row[1]);
      if (k === "المتن") meta.name = v;
      else if (k.startsWith("عنوان")) meta.title = v;
      else if (k === "الحلقة") meta.halaqa = v;
      else if (k === "اسم الطالب") meta.student = v;
    }
    const out = [];
    if (header >= 0) {
      for (const row of rows.slice(header + 1)) {
        const memo = norm(row && row[cols.memo]).replace(/\s/g, "");
        if (!memo) continue;
        const get = (c) => (c == null ? "" : norm(row[c]).replace(/\s/g, ""));
        out.push({ memo, link: get(cols.link), big: get(cols.big), note: cols.note == null ? "" : norm(row[cols.note]) });
      }
    } else {
      // ورقة بلا عناوين: أول خانة في كل صف تشبه مقداراً
      for (const row of rows) {
        const cell = (row || []).map((c) => norm(c).replace(/\s/g, "")).find((c) => PlanCore.parseRange(c));
        if (cell) out.push({ memo: cell, link: "", big: "", note: "" });
      }
    }
    return { meta, rows: out };
  }

  /* ورقة بطريقة «بيانات الخطط» في ملف التسجيل اليومي: كل خطة تبدأ بـ«اسم/رقم المستوى:»، وبعد خمسة صفوف مقاديرها
     (الحفظ والربط والكبرى: جزء، من، إلى). وخطة في أكثر من ورقة «… (١ من ٢)» تُجمع خطةً واحدة. */
  const isDailyStart = (row) => norm(row && row[0]).replace(/\s/g, "").startsWith("اسم/رقمالمستوى");
  const isDailySheet = (rows) => rows.some(isDailyStart);
  // جزء ومن وإلى ← نص الخانة كما في الموقع
  function dailyText(part, from, to) {
    const num = (x) => {
      const t = ASCII(norm(x));
      return /^\d+$/.test(t) ? +t : null;
    };
    const a = num(from);
    const b = num(to) == null ? a : num(to);
    if (a == null) return "";
    const p = ASCII(norm(part)).replace(/\s/g, "");
    const two = /^(\d+)←(\d+)$/.exec(p);
    if (two) return `${two[1]}/${a}←${two[2]}/${b}`;
    const lv = /^\d+$/.test(p) ? +p : null;
    // رجعت الصفحات في الجزء نفسه (آخر متن وأول الذي يليه)
    if (b < a) return lv != null ? `${lv}/${a}←${lv}/${b}` : `${a}←${b}`;
    return PlanCore.fmt(lv, a, b);
  }
  function parseDailySheets(sheets) {
    const blocks = [];
    for (const sh of sheets) {
      sh.rows.forEach((row, r) => {
        if (!isDailyStart(row)) return;
        const name = norm((sh.rows[r + 1] || [])[3]);
        const rows = [];
        for (let m = 0; m < DAILY.max; m++) {
          const c = sh.rows[r + 5 + m] || [];
          const memo = dailyText(c[1], c[2], c[3]);
          if (memo) rows.push({ memo, link: dailyText(c[4], c[5], c[6]) || "-", big: dailyText(c[7], c[8], c[9]) || "-", note: "" });
        }
        if (rows.length) blocks.push({ name, rows });
      });
    }
    if (!blocks.length) return { meta: {}, rows: [] };
    // الخطة الأولى، وما يليها من أجزائها «(٢ من ٣)»
    const base = (n) => n.replace(/\s*\(\d+ من \d+\)$/, "");
    const first = blocks[0];
    const out = first.rows.slice();
    if (/\(1 من \d+\)$/.test(first.name))
      for (const bl of blocks.slice(1)) {
        if (base(bl.name) !== base(first.name)) break;
        out.push(...bl.rows);
      }
    return { meta: { name: base(first.name) }, rows: out };
  }

  async function importFile(file) {
    const st = $("status");
    try {
      setStatus(st, "جارٍ قراءة الملف…", "busy");
      const isCsv = /\.csv$/i.test(file.name);
      const sheets = isCsv ? [{ name: "", rows: XlsxLite.readCsv(await file.text()) }] : await XlsxLite.readAll(await file.arrayBuffer());
      // جدول الخطة بالأيام كما يصدّره الموقع، وإلا أوراق بطريقة «بيانات الخطط»
      let parsed = { meta: {}, rows: [] };
      for (const sh of sheets.filter((x) => !isDailySheet(x.rows))) {
        parsed = parsePlanSheet(sh.rows);
        if (parsed.rows.length) break;
      }
      if (!parsed.rows.length) parsed = parseDailySheets(sheets.filter((x) => isDailySheet(x.rows)));
      const { meta, rows: plan } = parsed;
      if (!plan.length) throw new Error("لم أجد عموداً بعنوان «الحفظ» ولا مقادير في الملف");
      const known = meta.name && (allTexts().concat(LEVEL_PLANS).find((t) => norm(t.name) === meta.name) || selectionByName(meta.name));
      const bad = known ? [] : plan.map((r, i) => (PlanCore.parseRange(r.memo) ? null : AR(i + 1))).filter(Boolean);
      if (bad.length) throw new Error(`مقادير الحفظ غير مفهومة في الصفوف: ${bad.slice(0, 8).join("، ")}`);
      const t = known || registerCustom({ name: meta.name || file.name.replace(/\.[^.]+$/, ""), title: meta.title, days: plan.map((r) => r.memo) });
      if (HALAQAT.includes(meta.halaqa)) {
        state.halaqa = { enabled: true, name: meta.halaqa };
        fillHalaqa();
      }
      if (meta.student) state.student = { enabled: true, name: meta.student };
      state.loaded = null;
      state.approved = null;
      selectText(t.id, plan.length, { title: meta.title });
      applyRows(plan);
      renderLibrary();
      setStatus(st, `رُفعت الخطة: ${AR(t.name)} في ${daysAfter(state.plan.D)}.`, "ok");
    } catch (err) {
      setStatus(st, "تعذّر رفع الملف: " + (err && err.message ? err.message : "صيغة غير مدعومة"), "error");
    }
  }

  /* ---------- الخطط المحفوظة (مكتبة مشتركة: الكل يقرأ، وصاحب الصفحة يحفظ ويحذف) ---------- */
  const lib = { db: null, owner: false, main: false, ownerKnown: false, status: "loading", plans: [], cloud: null, user: null, checking: false, admins: null, adminsError: false };
  let cloudResolve, cloudReject;
  const cloudReady = new Promise((res, rej) => ((cloudResolve = res), (cloudReject = rej)));
  cloudReady.catch(() => {});
  let markLoaded;
  const libLoaded = new Promise((r) => (markLoaded = r));
  async function initLibrary() {
    if (SITE_MODE) return initSiteLibrary();
    if (!window.claude || typeof window.claude.use !== "function") {
      lib.status = "unavailable";
      renderLibrary();
      return;
    }
    const [db, user] = await Promise.all([
      window.claude.use("db").catch(() => null),
      window.claude.use("user").catch(() => null),
    ]);
    lib.db = db;
    lib.owner = user ? await user.isOwner().catch(() => false) : false;
    lib.ownerKnown = true;
    $("navAdmin").hidden = !lib.owner;
    renderAdmin();
    if (!db) {
      lib.status = "unavailable";
      renderLibrary();
      return;
    }
    subscribeLibrary(db);
  }
  // في الموقع المستقل تُقرأ قائمة الخطط عند فتح صفحتها أو دخول صاحب الصفحة فقط،
  // لأن كل خطة في القائمة قراءةٌ تُحسب من حصة Firebase اليومية المجانية
  let plansDb = null;
  let plansOn = false;
  function subscribeLibrary(db, lazy) {
    // المسميات التي يحفظها صاحب الصفحة من لوحة التحكم
    try {
      db.doc(NAMES_DOC).onSnapshot(
        (snap) => receiveNames(snap.exists ? (snap.data() || {}).names : null),
        () => {}
      );
    } catch (e) {
      /* تبقى المسميات الأصلية */
    }
    // الإعدادات التلقائية للخطط وإعلان الصفحة الرئيسية
    try {
      db.doc(SETTINGS_DOC).onSnapshot(
        (snap) => receiveSettings(snap.exists ? snap.data() : null),
        () => {}
      );
    } catch (e) {
      /* تبقى الإعدادات الأصلية */
    }
    plansDb = db;
    if (!lazy) watchPlans();
  }
  function watchPlans() {
    if (plansOn || !plansDb) return;
    plansOn = true;
    plansDb.collection("plans")
      .orderBy("savedAt", "desc")
      .limit(500)
      .onSnapshot(
        (snap) => {
          lib.plans = snap.docs.filter((d) => d.exists).map((d) => Object.assign({ id: d.id }, d.data()));
          lib.status = "ready";
          if (state.loaded && !lib.plans.some((p) => p.id === state.loaded.id)) state.loaded = null;
          renderLibrary();
          markLoaded();
        },
        () => {
          lib.status = "error";
          renderLibrary();
        }
      );
  }

  /* ---------- الموقع المستقل: الحفظ في Firebase ----------
     الخطط المحفوظة والمسميات يقرؤها كل زائر، ولا يحفظ أو يحذف أو يدخل لوحة التحكم إلا صاحب الصفحة
     بعد دخوله بحساب Google (وقواعد Firestore هي التي تمنع غيره). */
  const SIGNIN_ERRORS = {
    "auth/popup-blocked": "منع المتصفح نافذة الدخول؛ اسمح بالنوافذ المنبثقة لهذا الموقع ثم أعد المحاولة.",
    "auth/unauthorized-domain": "عنوان هذا الموقع غير مضاف في «Authorized domains» في Firebase.",
    "auth/operation-not-allowed": "الدخول بحساب Google غير مفعّل في Firebase (Sign-in method).",
    "auth/network-request-failed": "تعذّر الاتصال؛ تحقّق من الإنترنت ثم أعد المحاولة.",
  };
  const ownerMsg = (msg, kind) => setStatus($("ownerStatus"), msg, kind);
  function initSiteLibrary() {
    $("siteFoot").hidden = false;
    renderOwnerBar();
    const cfg = SITE.firebase;
    const cloud = window.KhutatCloud && cfg ? window.KhutatCloud.load(cfg) : Promise.reject(new Error("no cloud"));
    cloud.then(
      (c) => {
        lib.cloud = c;
        lib.db = c.db;
        subscribeLibrary(c.db, true);
        if (!$("view-saved").hidden) watchPlans();
        c.auth.onChange((u) => siteUser(u));
        renderOwnerBar();
        cloudResolve(c);
      },
      (err) => {
        cloudReject(err);
        lib.status = "error";
        lib.ownerKnown = true;
        renderLibrary();
        renderAdmin();
        renderOwnerBar();
      }
    );
  }
  let ownerCheck = 0;
  async function siteUser(u) {
    const turn = ++ownerCheck;
    lib.user = u;
    // لا حساب، أو هوية مجهولة لزائر حفظ خطة: ليس صاحب الصفحة
    if (!u || u.anon) {
      lib.checking = false;
      lib.main = false;
      setOwner(false);
      return;
    }
    lib.checking = true;
    renderOwnerBar();
    let owner = false;
    let failed = false;
    try {
      owner = await lib.cloud.auth.isOwner();
    } catch (e) {
      failed = true;
    }
    if (turn !== ownerCheck) return;
    lib.checking = false;
    if (failed) {
      ownerMsg("تعذّر التحقق من الحساب الآن؛ أعد تحميل الصفحة.", "error");
      setOwner(false);
      return;
    }
    if (!owner) {
      ownerMsg(`الحساب ${u.email} ليس حساب صاحب الصفحة، فسُجّل خروجه. وحفظ الخطط متاح لكل زائر دون دخول.`, "error");
      lib.cloud.auth.signOut().catch(() => {});
      return;
    }
    lib.main = await lib.cloud.auth.isMain().catch(() => false);
    if (turn !== ownerCheck) return;
    setOwner(true);
    watchPlans();
    migrateFromClaude();
  }
  function setOwner(v) {
    lib.owner = !!v;
    lib.ownerKnown = true;
    $("navAdmin").hidden = !lib.owner;
    renderOwnerBar();
    renderAdmin();
    renderLibrary();
  }
  function renderOwnerBar() {
    if (!SITE_MODE) return;
    const signedIn = lib.owner && !!lib.user;
    $("ownerIn").hidden = signedIn || lib.checking;
    $("ownerOut").hidden = !signedIn;
    $("ownerInfo").textContent = signedIn ? `أنت مسجّل الدخول بحساب ${lib.user.email}.` : lib.checking ? "جارٍ التحقق من الحساب…" : "";
  }
  function siteSignIn() {
    if (!lib.cloud) {
      ownerMsg(lib.status === "error" ? "تعذّر الاتصال بقاعدة الخطط؛ أعد تحميل الصفحة." : "جارٍ الاتصال بقاعدة الخطط؛ أعد المحاولة بعد لحظة.", "error");
      return;
    }
    ownerMsg("", "");
    // تُفتح نافذة Google من الضغطة نفسها، قبل أي انتظار
    lib.cloud.auth.signIn().catch((e) => {
      const code = (e && e.code) || "";
      if (code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled") return;
      ownerMsg(SIGNIN_ERRORS[code] || `تعذّر تسجيل الدخول${code ? " (" + code + ")" : ""}.`, "error");
    });
  }
  // نقل الخطط والمسميات المحفوظة في رابط Claude، مرة واحدة عند أول دخول لصاحب الصفحة
  let migrating = false;
  async function migrateFromClaude() {
    const seed = SITE.seed;
    if (migrating || !seed || !lib.db) return;
    migrating = true;
    try {
      await libLoaded;
      const meta = await lib.db.doc(META_DOC).get();
      if (meta.exists && (meta.data() || {}).claudeImport) return;
      const have = new Set(lib.plans.map((p) => p.id));
      let n = 0;
      for (const p of seed.plans || []) {
        if (!p || !p.id || have.has(p.id)) continue;
        const body = Object.assign({}, p);
        delete body.id;
        await lib.db.collection("plans").doc(p.id).set(body);
        n++;
      }
      let names = false;
      if (seed.names && Object.keys(seed.names).length) {
        const cur = await lib.db.doc(NAMES_DOC).get();
        if (!cur.exists) {
          await lib.db.doc(NAMES_DOC).set({ names: seed.names, savedAt: new Date().toISOString() });
          receiveNames(seed.names);
          names = true;
        }
      }
      await lib.db.doc(META_DOC).set({ claudeImport: new Date().toISOString(), plans: n, names });
      if (n || names)
        ownerMsg(`نُقل من رابط Claude: ${n ? (n === 1 ? "خطة محفوظة" : AR(n) + " من الخطط المحفوظة") : ""}${n && names ? "، و" : ""}${names ? "المسميات المعدّلة" : ""}.`, "ok");
    } catch (e) {
      /* يُعاد النقل في الدخول التالي */
    } finally {
      migrating = false;
    }
  }

  function defaultPlanName() {
    return `${AR(state.text.name)} في ${daysAfter(state.plan.D)}${state.halaqa.enabled ? "، حلقة " + state.halaqa.name : ""}`;
  }
  /* ---------- اعتماد الخطة ----------
     زر «اعتماد الخطة» يحفظها في الخطط المحفوظة، ثم تظهر أزرار التصدير: في رابط Claude لصاحب الصفحة،
     وفي الموقع المستقل لكل من يعتمد خطة. إذا تغيّرت الخطة بعد اعتمادها اختفت الأزرار حتى تُعتمد من جديد. */
  const canSave = () => (SITE_MODE ? !!lib.cloud : lib.owner && lib.status === "ready" && !!lib.db);
  // من يحذف الخطة في الموقع: صاحب الصفحة، أو من حفظها من جهازه
  const canDelete = (p) => lib.owner || (SITE_MODE && !!lib.user && !!p.by && p.by === lib.user.uid);
  function planKey() {
    if (!state.plan) return "";
    return JSON.stringify([
      state.text.id,
      state.plan.D,
      currentTitle(),
      studentName(),
      state.halaqa.enabled ? state.halaqa.name : "",
      durationText() || "",
      state.teacher || "",
      currentRows().map((r) => [r.memo, r.link, r.big, r.note || "", r.day || "", r.date || ""]),
    ]);
  }
  const isApproved = () => !!state.approved && state.approved.key === planKey();
  function updateSaveArea() {
    if (!state.plan) return;
    $("teacherRow").hidden = !canSave();
    const wa = $("shareWa");
    wa.hidden = !(SITE_MODE && state.loaded && state.loaded.id);
    if (!wa.hidden) wa.href = waHref(state.loaded);
    $("openNote").hidden = !state.loaded;
    if (state.loaded) $("openName").textContent = AR(state.loaded.name);
    const approved = isApproved();
    $("approveRow").hidden = approved;
    $("exportBox").hidden = !approved;
    if (approved) {
      $("approvedNote").textContent = state.approved.note;
      return;
    }
    const changed = !!state.approved;
    $("approve").textContent = changed ? "اعتماد التعديلات" : "اعتماد الخطة";
    const note = $("approveNote");
    note.classList.toggle("is-changed", changed);
    note.textContent = changed
      ? "تغيّرت الخطة بعد اعتمادها؛ اعتمدها مرة أخرى لتظهر أزرار التصدير."
      : canSave()
        ? "تُحفظ الخطة عند اعتمادها في «الخطط المحفوظة»، ثم تظهر أزرار التصدير."
        : "اعتمد الخطة لتظهر أزرار التصدير.";
  }
  // الخطة نفسها (المتن والحلقة) تُحدَّث في مكانها إذا اعتُمدت بعد تعديلها، وغيرها يُحفظ خطة جديدة
  const samePlan = (a, b) => !!a && !!b && a.textId === b.textId && a.textName === b.textName && (a.halaqa || "") === (b.halaqa || "");
  async function approvePlan() {
    const btn = $("approve");
    const st = $("status");
    const key = planKey();
    let note = "اعتُمدت الخطة.";
    btn.disabled = true;
    try {
      if (canSave()) {
        setStatus(st, "جارٍ حفظ الخطة…", "busy");
        const name = defaultPlanName();
        const body = planSnapshot(name);
        const plans = lib.db.collection("plans");
        // في الموقع: تُحدَّث الخطة في مكانها إن كانت لمن حفظها (أو لصاحب الصفحة)، وإلا حُفظت نسخة جديدة له
        const by = SITE_MODE ? await lib.cloud.auth.ensureUser() : null;
        const own = !SITE_MODE || lib.owner || (!!state.loaded && !!state.loaded.by && state.loaded.by === by);
        const same = samePlan(state.loaded, body) && own;
        if (SITE_MODE) body.by = same && state.loaded.by ? state.loaded.by : by;
        const ref = same ? plans.doc(state.loaded.id) : plans.doc();
        await ref.set(body);
        state.loaded = { id: ref.id, name, textId: body.textId, textName: body.textName, halaqa: body.halaqa, teacher: body.teacher, by: body.by || null };
        // الخطط المحفوظة يقرؤها كل من لديه الرابط، فلا يُحفظ فيها اسم الطالب
        note = `اعتُمدت الخطة وحُفظت في «الخطط المحفوظة» باسم «${AR(name)}»${studentName() ? " (دون اسم الطالب)" : ""}.`;
      }
      setStatus(st, "", "");
    } catch (err) {
      const code = err && err.code;
      note = "اعتُمدت الخطة، ولم تُحفظ في «الخطط المحفوظة»: " +
        (code === "invalid_argument"
          ? SITE_MODE ? "لم تسمح قاعدة البيانات بالحفظ." : "الحفظ لصاحب الصفحة فقط."
          : code === "quota_exceeded"
            ? "امتلأت مساحة الحفظ؛ احذف خططاً قديمة."
            : code === "auth/operation-not-allowed" || code === "auth/admin-restricted-operation"
              ? "الحفظ للزوار غير مفعّل في Firebase بعد (Anonymous)."
              : "تعذّر الحفظ الآن" + (code && String(code).startsWith("auth/") ? ` (${code})` : "") + ".");
      setStatus(st, "", "");
    } finally {
      btn.disabled = false;
    }
    state.approved = { key, note };
    renderLibrary();
  }

  function planSnapshot(name) {
    const t = state.text;
    return {
      name,
      textId: t.custom ? null : t.id,
      textName: t.name,
      custom: t.custom ? { name: t.name, title: t.title, days: t.days } : null,
      days: state.plan.D,
      title: currentTitle(),
      halaqa: state.halaqa.enabled ? state.halaqa.name : "",
      teacher: state.teacher || "",
      link: clone(state.link),
      withReview: state.withReview,
      review: clone(state.review),
      level1: clone(state.level1),
      dates: state.dates.enabled && state.dates.start
        ? { start: Hijri.short(state.dates.start), weekdays: state.dates.weekdays.slice(), fill: state.dates.fill }
        : null,
      rows: currentRows().map((r) => [r.memo, r.link, r.big, r.note || ""]),
      description: planDescription(),
      savedAt: new Date().toISOString(),
    };
  }

  // رابط يفتح الخطة المحفوظة في الموقع، ورسالة واتساب تحمله (wa.me يفتح الواتساب مباشرة ليُختار من يُرسل إليه)
  const planLink = (id) => location.origin + location.pathname + "#plan=" + encodeURIComponent(id);
  const waHref = (p) => "https://wa.me/?text=" + encodeURIComponent(`«${AR(p.name || "خطة")}»\n${planLink(p.id)}`);
  // رابط مرسَل: تُقرأ الخطة وحدها من قاعدة الخطط وتُفتح في صفحة الإنشاء
  let sharedOpening = null;
  async function openSharedPlan(id) {
    if (!id || sharedOpening === id) return;
    sharedOpening = id;
    const st = $("status");
    setStatus(st, "جارٍ فتح الخطة المرسلة…", "busy");
    try {
      await cloudReady;
      const snap = await lib.db.collection("plans").doc(id).get();
      if (!snap.exists) {
        setStatus(st, "لم أجد هذه الخطة في «الخطط المحفوظة»؛ ربما حُذفت.", "error");
        return;
      }
      const p = Object.assign({ id }, snap.data());
      if (!openPlan(p)) {
        setStatus(st, "متن هذه الخطة غير موجود في الصفحة.", "error");
        return;
      }
      setStatus(st, `فُتحت «${AR(p.name)}»؛ صدّرها، أو عدّلها ثم اعتمدها.`, "ok");
    } catch (e) {
      setStatus(st, "تعذّر فتح الخطة الآن؛ تحقّق من الاتصال ثم أعد تحميل الصفحة.", "error");
    } finally {
      sharedOpening = null;
    }
  }

  // يضع خطة محفوظة في صفحة الإنشاء كما حُفظت؛ يعيد false إن لم يوجد متنها
  function openPlan(p) {
    let id = p.textId;
    if (id === "level-1" && p.level1 && p.level1.adhkar === false) id = validLevel1(p.level1).edition;
    if (!id && p.custom) id = registerCustom(p.custom).id;
    if (!getText(id)) return false;
    state.link = Object.assign({}, DEFAULT_LINK, p.link || {});
    state.withReview = p.withReview !== false;
    state.halaqa = p.halaqa ? { enabled: true, name: p.halaqa } : { enabled: false, name: state.halaqa.name };
    fillHalaqa();
    if (p.dates && p.dates.start) {
      const start = fromHijriShort(p.dates.start);
      state.dates = { enabled: !!start, start, weekdays: p.dates.weekdays || [0, 1, 2, 3, 4], fill: p.dates.fill !== false };
    } else state.dates.enabled = false;
    if (p.level1) state.level1 = validLevel1(p.level1);
    state.teacher = typeof p.teacher === "string" ? p.teacher : "";
    fillTeacher();
    state.loaded = { id: p.id, name: p.name, textId: p.textId || null, textName: p.textName, halaqa: p.halaqa || "", teacher: p.teacher || "", by: p.by || null };
    state.approved = null;
    selectText(id, p.days, { title: p.title, review: p.review, keepLink: true });
    applyRows((p.rows || []).map(([memo, link, big, note]) => ({ memo, link, big, note })));
    // خطة محفوظة: معتمدة كما هي، فأزرار التصدير ظاهرة
    state.approved = { key: planKey(), note: "الخطة محفوظة في «الخطط المحفوظة»." };
    renderLibrary();
    return true;
  }

  /* ---------- المسميات: لوحة التحكم لصاحب الصفحة ----------
     المسميات الأصلية من بيانات الصفحة، وما يغيّره صاحب الصفحة يُحفظ في المستند config/names
     فيظهر لكل من يفتحها (ونسخة منه في متصفح العارض لتظهر من أول لحظة). */
  const NAMES_DOC = "config/names";
  const META_DOC = "config/meta";
  const NAMES_CACHE = "khutat-names-v1";
  const TAB_IDS = ["ready", "texts", "create", "saved"];
  const entryKey = (e) =>
    e.gen ? "gen-" + e.gen.text : e.files && e.files[0] ? e.files[0].path.replace(/^.*\//, "").replace(/\.[^.]+$/, "") : e.title;
  let NAME_DEFAULTS = null;
  let nameOverrides = {};
  let adminDirty = false;
  function captureNameDefaults() {
    const L = typeof LIBRARY !== "undefined" ? LIBRARY : {};
    NAME_DEFAULTS = {
      docTitle: document.title,
      site: $("siteTitle").textContent.trim(),
      tabs: Object.fromEntries(TAB_IDS.map((k) => [k, document.querySelector(`[data-tab="${k}"]`).textContent.trim()])),
      levels: Object.assign({}, LEVEL_NAMES),
      texts: Object.fromEntries(TEXTS.map((t) => [t.id, { name: t.name, title: t.title, short: SHORT[t.id] || t.name }])),
      halaqat: HALAQAT.slice(),
      teachers: TEACHERS.slice(),
      ready: Object.fromEntries((L.ready || []).map((e) => [entryKey(e), { title: e.title, note: e.note || "" }])),
      files: Object.fromEntries((L.texts || []).map((e) => [entryKey(e), { title: e.title }])),
    };
  }
  const cleanName = (v) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, 160) : "");
  // المسميات النافذة: الأصل وما غيّره صاحب الصفحة (والخانة الفارغة تعني الأصل)
  function effectiveNames(over) {
    const n = clone(NAME_DEFAULTS);
    const o = over && typeof over === "object" ? over : {};
    const pick = (v, d) => cleanName(v) || d;
    const sub = (obj, k) => (obj && typeof obj === "object" && obj[k] && typeof obj[k] === "object" ? obj[k] : {});
    n.site = pick(o.site, n.site);
    for (const k of TAB_IDS) n.tabs[k] = pick(sub(o, "tabs")[k], n.tabs[k]);
    for (const k of Object.keys(n.levels)) n.levels[k] = pick(sub(o, "levels")[k], n.levels[k]);
    for (const id of Object.keys(n.texts)) {
      const x = sub(sub(o, "texts"), id);
      for (const f of ["name", "title", "short"]) n.texts[id][f] = pick(x[f], n.texts[id][f]);
    }
    if (Array.isArray(o.halaqat)) {
      const list = [...new Set(o.halaqat.map(cleanName).filter(Boolean))].slice(0, 80);
      if (list.length) n.halaqat = list;
    }
    if (Array.isArray(o.teachers)) {
      const list = [...new Set(o.teachers.map(cleanName).filter(Boolean))].slice(0, 80);
      if (list.length) n.teachers = list;
    }
    for (const k of Object.keys(n.ready)) {
      const x = sub(sub(o, "ready"), k);
      n.ready[k].title = pick(x.title, n.ready[k].title);
      n.ready[k].note = pick(x.note, n.ready[k].note);
    }
    for (const k of Object.keys(n.files)) n.files[k].title = pick(sub(sub(o, "files"), k).title, n.files[k].title);
    return n;
  }
  function applyNames(n) {
    $("siteTitle").textContent = n.site;
    document.title = n.site === NAME_DEFAULTS.site ? NAME_DEFAULTS.docTitle : n.site;
    for (const k of TAB_IDS) {
      document.querySelector(`[data-tab="${k}"]`).textContent = n.tabs[k];
      const h = $(k + "Title");
      if (h) h.textContent = n.tabs[k];
    }
    Object.assign(LEVEL_NAMES, n.levels);
    LEVEL_PLANS.forEach((t) => {
      t.name = `${LEVEL_NAMES[t.level]} كاملاً`;
      t.title = `خطة ${LEVEL_NAMES[t.level]}`;
    });
    TEXTS.forEach((t) => {
      const x = n.texts[t.id];
      if (!x) return;
      t.name = x.name;
      t.title = x.title;
      SHORT[t.id] = x.short;
    });
    HALAQAT.splice(0, HALAQAT.length, ...n.halaqat);
    TEACHERS.splice(0, TEACHERS.length, ...n.teachers);
    if (typeof LIBRARY !== "undefined") {
      (LIBRARY.ready || []).forEach((e) => {
        const x = n.ready[entryKey(e)];
        if (x) Object.assign(e, { title: x.title, note: x.note });
      });
      (LIBRARY.texts || []).forEach((e) => {
        const x = n.files[entryKey(e)];
        if (x) e.title = x.title;
      });
    }
  }
  // بعد تغيير المسميات: تُعاد كتابة القوائم والمعاينة والقوائم الأخرى بها
  function refreshNames(oldTitle) {
    // حلقة حُذفت من القائمة: تُختار الأولى (إلا في خطة محفوظة مفتوحة فتبقى حلقتها)
    const keepOld = state.halaqa.enabled && state.loaded && state.loaded.halaqa === state.halaqa.name;
    if (!HALAQAT.includes(state.halaqa.name) && !keepOld) state.halaqa.name = HALAQAT[0];
    fillHalaqa();
    const keepTeacher = state.loaded && state.loaded.teacher === state.teacher;
    if (state.teacher && !TEACHERS.includes(state.teacher) && !keepTeacher) state.teacher = "";
    fillTeacher();
    fillLevelSelect();
    if (state.text && state.plan) {
      for (const k of Object.keys(selCache)) delete selCache[k];
      if (state.text.id === "level-1" || state.text.isSel || /^(mix|part):/.test(state.text.id)) state.text = getText(state.text.id);
      fillTextSelect(levelOf(state.text));
      if (oldTitle !== null && state.title === oldTitle) {
        state.title = AR(state.text.title);
        $("title").value = state.title;
      }
      renderTextInfo();
      renderReview();
      // تُعاد الخطة لتأخذ الملاحظات الأسماء الجديدة، مع إبقاء التعديلات اليدوية
      const keep = state.edits;
      regenerate();
      state.edits = keep;
      renderSheets();
      renderEdits();
    }
    for (const k of ["ready", "texts"]) {
      delete $(k + "List").dataset.done;
      if (!$("view-" + k).hidden) renderFiles(k);
    }
    renderLibrary();
    if (!adminDirty) renderAdmin();
  }
  function receiveNames(over) {
    const next = over && typeof over === "object" && !Array.isArray(over) ? over : {};
    if (JSON.stringify(next) === JSON.stringify(nameOverrides)) return;
    nameOverrides = next;
    try {
      localStorage.setItem(NAMES_CACHE, JSON.stringify(next));
    } catch (e) {
      /* لا بأس */
    }
    const oldTitle = state.text ? AR(state.text.title) : null;
    applyNames(effectiveNames(next));
    refreshNames(oldTitle);
  }
  function loadCachedNames() {
    try {
      const v = JSON.parse(localStorage.getItem(NAMES_CACHE) || "{}");
      return v && typeof v === "object" && !Array.isArray(v) ? v : {};
    } catch (e) {
      return {};
    }
  }

  /* ---------- الإعدادات التلقائية للخطط (لوحة التحكم) ----------
     ما تبدأ به كل خطة: الربط والمراجعة الكبرى وما يظهر فيها، وإعلان أعلى الصفحة الرئيسية. يحفظها صاحب الصفحة في config/settings
     (ونسخة منها في متصفح العارض). وإذا غيّرها صارت هي الأصل عند كل عارض ولو كان قد غيّر إعداداته من قبل؛
     ولكلٍّ أن يغيّرها لخطته بعد ذلك. */
  const SETTINGS_DOC = "config/settings";
  const SETTINGS_CACHE = "khutat-settings-v1";
  const BASE_SETTINGS = {
    // days: ٠ يعني تلقائياً من الخطة الأصلية لكل متن
    link: { enabled: true, mode: "pages", pages: 10, days: 0, cont: true },
    review: { enabled: true, method: "levels", pages: 20, itemMode: "pages", itemValue: 20, self: true, repeat: true, mergeShort: true },
    show: { student: false, halaqa: false, dates: false, weekdays: [0, 1, 2, 3, 4] },
    notice: "",
    // ملف اكسل: «simple» الجدول بالأيام وحده، و«daily» بطريقة التسجيل اليومي (للصق في «بيانات الخطط») ومعه الجدول بالأيام
    excel: "simple",
  };
  let settings = clone(BASE_SETTINGS);
  let settingsStamp = "";
  function validSettings(o) {
    const s = clone(BASE_SETTINGS);
    const g = (x) => (x && typeof x === "object" && !Array.isArray(x) ? x : {});
    const bool = (v, d) => (typeof v === "boolean" ? v : d);
    const l = g(g(o).link);
    s.link = {
      enabled: bool(l.enabled, s.link.enabled),
      mode: l.mode === "days" ? "days" : "pages",
      pages: clampInt(l.pages, 1, 300, s.link.pages),
      days: clampInt(l.days, 0, 30, 0),
      cont: bool(l.cont, s.link.cont),
    };
    const r = g(g(o).review);
    s.review = {
      enabled: bool(r.enabled, s.review.enabled),
      method: r.method === "list" ? "list" : "levels",
      pages: clampInt(r.pages, 1, 999, s.review.pages),
      itemMode: r.itemMode === "days" ? "days" : "pages",
      itemValue: clampInt(r.itemValue, 1, 999, s.review.itemValue),
      self: bool(r.self, s.review.self),
      repeat: bool(r.repeat, s.review.repeat),
      mergeShort: bool(r.mergeShort, s.review.mergeShort),
    };
    const w = g(g(o).show);
    const days = Array.isArray(w.weekdays) ? [...new Set(w.weekdays.map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))].sort() : null;
    s.show = {
      student: bool(w.student, s.show.student),
      halaqa: bool(w.halaqa, s.show.halaqa),
      dates: bool(w.dates, s.show.dates),
      weekdays: days && days.length ? days : s.show.weekdays,
    };
    s.notice = typeof g(o).notice === "string" ? g(o).notice.replace(/\r/g, "").trim().slice(0, 600) : "";
    s.excel = g(o).excel === "daily" ? "daily" : "simple";
    return s;
  }
  function loadCachedSettings() {
    try {
      const v = JSON.parse(localStorage.getItem(SETTINGS_CACHE) || "null");
      if (v && typeof v.stamp === "string") {
        settings = validSettings(v.settings);
        settingsStamp = v.stamp;
      }
    } catch (e) {
      /* لا بأس */
    }
  }
  // إعدادات الربط والمراجعة الكبرى التلقائية على الخطة الحالية
  function linkDefaults() {
    const l = settings.link;
    return Object.assign({}, DEFAULT_LINK, { enabled: l.enabled, mode: l.mode, pages: l.pages, days: l.days || 3, daysManual: l.days > 0, cont: l.cont, prevId: null });
  }
  function reviewDefaults(t) {
    const r = settings.review;
    return validReview({ method: r.method, repeat: r.repeat, mergeShort: r.mergeShort, levels: { pages: r.pages, self: r.self }, items: defaultItems(t) });
  }
  function applyPlanDefaults() {
    state.link = linkDefaults();
    state.withReview = settings.review.enabled;
    state.review = reviewDefaults(state.text);
  }
  function applyShowDefaults() {
    const w = settings.show;
    state.student.enabled = w.student;
    state.halaqa.enabled = w.halaqa;
    state.dates.weekdays = w.weekdays.slice();
    state.dates.enabled = w.dates && Hijri.available;
    if (state.dates.enabled && !state.dates.start) state.dates.start = Hijri.today();
  }
  // تفضيلات العارض التي تعود إلى الأصل إذا غيّر صاحب الصفحة الإعدادات
  function dropStalePrefs(prefs) {
    if ((prefs.settingsStamp || "") === settingsStamp) return prefs;
    for (const k of ["link", "withReview", "review2", "reviewItems", "student"]) delete prefs[k];
    if (prefs.halaqa) delete prefs.halaqa.enabled;
    if (prefs.dates) {
      delete prefs.dates.enabled;
      delete prefs.dates.weekdays;
    }
    prefs.stale = true;
    return prefs;
  }
  function renderNotice() {
    const n = settings.notice;
    $("siteNotice").textContent = n;
    $("siteNotice").hidden = !n;
  }
  // وصلت الإعدادات من قاعدة البيانات (أو حفظها صاحب الصفحة)
  function receiveSettings(doc) {
    const stamp = doc && typeof doc.savedAt === "string" ? doc.savedAt : "";
    if (stamp === settingsStamp) return;
    settings = validSettings(doc && doc.settings);
    settingsStamp = stamp;
    try {
      localStorage.setItem(SETTINGS_CACHE, JSON.stringify({ stamp, settings }));
    } catch (e) {
      /* لا بأس */
    }
    renderNotice();
    // تُطبَّق على الخطة الحالية إلا إذا كانت خطة محفوظة مفتوحة (فتُطبَّق عند فتح الصفحة بعد ذلك)
    if (state.text && !state.loaded) {
      prefsStamp = stamp;
      try {
        const pr = dropStalePrefs(loadPrefs());
        delete pr.stale;
        pr.settingsStamp = stamp;
        localStorage.setItem(STORE_KEY, JSON.stringify(pr));
      } catch (e) {
        /* لا بأس */
      }
      applyPlanDefaults();
      applyShowDefaults();
      computeDates();
      syncControls();
      renderReview();
      updateStudentLine();
      regenerate();
    }
    if (!$("view-admin").hidden && lib.owner && !defaultsDirty) renderDefaultsAdmin();
  }
  // نموذج الإعدادات في لوحة التحكم
  let defaultsDirty = false;
  function fillDefaultsForm(st) {
    $("dLinkOn").checked = st.link.enabled;
    $("dLinkPages").checked = st.link.mode === "pages";
    $("dLinkDays").checked = st.link.mode === "days";
    $("dLinkPagesN").value = AR(st.link.pages);
    $("dLinkDaysN").value = st.link.days ? AR(st.link.days) : "";
    $("dLinkCont").checked = st.link.cont;
    $("dRevOn").checked = st.review.enabled;
    $("dRevLevels").checked = st.review.method === "levels";
    $("dRevList").checked = st.review.method === "list";
    $("dRevPages").value = AR(st.review.pages);
    $("dRevItemN").value = AR(st.review.itemValue);
    $("dRevItemMode").value = st.review.itemMode;
    $("dRevSelf").checked = st.review.self;
    $("dRevRepeat").checked = st.review.repeat;
    $("dRevMerge").checked = st.review.mergeShort;
    $("dStudent").checked = st.show.student;
    $("dHalaqa").checked = st.show.halaqa;
    $("dDates").checked = st.show.dates;
    $("dWeekdays").innerHTML = Hijri.WEEKDAYS.map(
      (w, i) => `<button type="button" class="chip" data-wd="${i}" aria-pressed="${st.show.weekdays.includes(i)}">${w}</button>`
    ).join("");
    $("dNotice").value = st.notice;
    $("dExcelDaily").checked = st.excel === "daily";
    $("dExcelSimple").checked = st.excel !== "daily";
  }
  function renderDefaultsAdmin() {
    fillDefaultsForm(settings);
    defaultsDirty = false;
  }
  function collectDefaults() {
    const num = (id, d) => {
      const n = parseIntAny($(id).value);
      return Number.isFinite(n) ? n : d;
    };
    return validSettings({
      link: {
        enabled: $("dLinkOn").checked,
        mode: $("dLinkDays").checked ? "days" : "pages",
        pages: num("dLinkPagesN", BASE_SETTINGS.link.pages),
        days: num("dLinkDaysN", 0),
        cont: $("dLinkCont").checked,
      },
      review: {
        enabled: $("dRevOn").checked,
        method: $("dRevList").checked ? "list" : "levels",
        pages: num("dRevPages", BASE_SETTINGS.review.pages),
        itemMode: $("dRevItemMode").value,
        itemValue: num("dRevItemN", BASE_SETTINGS.review.itemValue),
        self: $("dRevSelf").checked,
        repeat: $("dRevRepeat").checked,
        mergeShort: $("dRevMerge").checked,
      },
      show: {
        student: $("dStudent").checked,
        halaqa: $("dHalaqa").checked,
        dates: $("dDates").checked,
        weekdays: [...$("dWeekdays").querySelectorAll('[aria-pressed="true"]')].map((b) => +b.dataset.wd),
      },
      notice: $("dNotice").value,
      excel: $("dExcelDaily").checked ? "daily" : "simple",
    });
  }
  async function saveDefaults() {
    const st = $("defaultsStatus");
    if (!lib.db) {
      setStatus(st, "الحفظ غير متاح في هذا العرض.", "error");
      return;
    }
    const next = collectDefaults();
    if (!next.show.weekdays.length) {
      setStatus(st, "اختر يوماً دراسياً واحداً على الأقل.", "error");
      return;
    }
    $("dSave").disabled = true;
    setStatus(st, "جارٍ الحفظ…", "busy");
    try {
      const doc = { settings: next, savedAt: new Date().toISOString() };
      await lib.db.doc(SETTINGS_DOC).set(doc);
      defaultsDirty = false;
      receiveSettings(doc);
      renderDefaultsAdmin();
      setStatus(st, "حُفظت الإعدادات، وصارت هي الأصل عند كل من يفتح الصفحة.", "ok");
    } catch (err) {
      setStatus(st, err && err.code === "invalid_argument" ? "حفظ الإعدادات لصاحب الصفحة والمشرفين فقط." : "تعذّر الحفظ؛ حاول مرة أخرى.", "error");
    } finally {
      $("dSave").disabled = false;
    }
  }

  // نموذج لوحة التحكم: خانة لكل اسم، وفيها الاسم الأصلي ظاهراً حين تكون فارغة
  function renderAdmin() {
    const owner = lib.owner;
    $("adminLock").hidden = owner;
    $("adminLock").textContent = !(lib.ownerKnown || lib.status !== "loading")
      ? "جارٍ التحقق…"
      : SITE_MODE
        ? "لوحة التحكم لصاحب الصفحة فقط؛ سجّل دخولك من «دخول صاحب الصفحة» أسفل الصفحة."
        : "لوحة التحكم لصاحب الصفحة فقط.";
    $("adminForm").hidden = !owner;
    $("adminDefaults").hidden = !owner;
    if (owner && !defaultsDirty) renderDefaultsAdmin();
    // في الموقع: المشرفون لصاحب الموقع وحده، والنسخة الاحتياطية لكل مشرف
    $("adminPeople").hidden = !(SITE_MODE && owner && lib.main);
    $("adminBackup").hidden = !(SITE_MODE && owner);
    $("adminFiles").hidden = !(SITE_MODE && owner);
    if (SITE_MODE && owner && lib.main) watchAdmins();
    if (SITE_MODE && owner) {
      watchExtra();
      renderFilesAdmin();
    }
    if (!owner || !NAME_DEFAULTS) return;
    const d = NAME_DEFAULTS;
    const n = effectiveNames(nameOverrides);
    let k = 0;
    const field = (key, label, value, def, wide) => {
      const id = "nm-" + k++;
      return `<div class="admin-field"${wide ? ' style="grid-column:1/-1"' : ""}><label for="${id}">${esc(label)}</label><input id="${id}" type="text" data-key="${esc(key)}" value="${esc(value === def ? "" : value)}" placeholder="${esc(def)}" autocomplete="off"></div>`;
    };
    const sec = (title, hint, body, open) => `<details class="admin-sec"${open ? " open" : ""}><summary>${esc(title)}<span>${esc(hint)}</span></summary>${body}</details>`;
    let html = "";
    html += sec("الصفحة", "العنوان وأسماء الصفحات", `<div class="admin-grid">${field("site", "عنوان الصفحة", n.site, d.site, true)}${TAB_IDS.map((t) => field("tabs|" + t, "صفحة: " + d.tabs[t], n.tabs[t], d.tabs[t])).join("")}</div>`, true);
    html += sec("المستويات", "أسماء المستويات الستة والمتون الإضافية", `<div class="admin-grid">${Object.keys(d.levels).map((l) => field("levels|" + l, d.levels[l], n.levels[l], d.levels[l])).join("")}</div>`);
    const byLevel = {};
    TEXTS.forEach((t) => (byLevel[t.level] = byLevel[t.level] || []).push(t));
    const textsHtml = Object.keys(byLevel)
      .map((l) => `<h3 class="admin-level">${esc(n.levels[l] || "")}</h3>` + byLevel[l]
        .map((t) => `<div class="admin-text"><h4>${esc(AR(d.texts[t.id].name))}</h4><div class="admin-grid">
          ${field(`texts|${t.id}|name`, "الاسم في القوائم", n.texts[t.id].name, d.texts[t.id].name)}
          ${field(`texts|${t.id}|title`, "عنوان الخطة في الملف", n.texts[t.id].title, d.texts[t.id].title)}
          ${field(`texts|${t.id}|short`, "الاسم المختصر (الملاحظات وصندوق الاستماع)", n.texts[t.id].short, d.texts[t.id].short)}
        </div></div>`)
        .join(""))
      .join("");
    html += sec("المتون", "اسم كل متن وعنوان خطته واسمه المختصر", textsHtml);
    const hid = "nm-" + k++;
    html += sec("الحلقات", "اسم كل حلقة في سطر", `<div class="admin-field"><label for="${hid}">الحلقات بالترتيب الذي تظهر به في القائمة</label><textarea id="${hid}" data-key="halaqat" rows="${Math.min(14, n.halaqat.length + 2)}" placeholder="${esc(d.halaqat.join("\n"))}">${esc(n.halaqat.join("\n"))}</textarea></div>`);
    const tid = "nm-" + k++;
    html += sec("المعلمون", "اسم كل معلم في سطر؛ يُحفظ مع الخطة ولا يظهر فيها", `<div class="admin-field"><label for="${tid}">المعلمون بالترتيب الذي يظهرون به عند اعتماد الخطة</label><textarea id="${tid}" data-key="teachers" rows="${Math.min(14, n.teachers.length + 2)}" placeholder="${esc(d.teachers.join("\n"))}">${esc(n.teachers.join("\n"))}</textarea></div>`);
    const L = typeof LIBRARY !== "undefined" ? LIBRARY : {};
    html += sec("الخطط الجاهزة", "عنوان كل خطة وملاحظتها", (L.ready || [])
      .map((e) => {
        const key = entryKey(e);
        return `<div class="admin-text"><h4>${esc(AR(d.ready[key].title))}</h4><div class="admin-grid">${field(`ready|${key}|title`, "العنوان", n.ready[key].title, d.ready[key].title)}${field(`ready|${key}|note`, "الملاحظة (المدة)", n.ready[key].note, d.ready[key].note)}</div></div>`;
      })
      .join(""));
    html += sec("المتون PDF", "عنوان كل ملف", `<div class="admin-grid">${(L.texts || [])
      .map((e) => {
        const key = entryKey(e);
        return field(`files|${key}|title`, d.files[key].title, n.files[key].title, d.files[key].title);
      })
      .join("")}</div>`);
    // تبقى الأقسام المفتوحة مفتوحة عند إعادة الرسم
    const open = [...document.querySelectorAll("#adminFields details")].map((x) => x.open);
    $("adminFields").innerHTML = html;
    if (open.length) document.querySelectorAll("#adminFields details").forEach((x, i) => (x.open = !!open[i]));
    adminDirty = false;
  }
  // ما يختلف عن الأصل فقط هو ما يُحفظ
  function collectNames() {
    const d = NAME_DEFAULTS;
    const over = {};
    document.querySelectorAll("#adminFields [data-key]").forEach((el) => {
      const key = el.dataset.key;
      if (key === "halaqat" || key === "teachers") {
        const list = [...new Set(el.value.split("\n").map(cleanName).filter(Boolean))];
        if (list.length && list.join("\n") !== d[key].join("\n")) over[key] = list;
        return;
      }
      const path = key.split("|");
      const def = path.reduce((o, p) => (o ? o[p] : undefined), d);
      const v = cleanName(el.value);
      if (!v || v === def) return;
      let o = over;
      path.slice(0, -1).forEach((p) => (o = o[p] = o[p] || {}));
      o[path[path.length - 1]] = v;
    });
    return over;
  }
  async function saveNames(over, okMsg) {
    const st = $("adminStatus");
    if (!lib.db) {
      setStatus(st, "الحفظ غير متاح في هذا العرض.", "error");
      return;
    }
    $("adminSave").disabled = true;
    setStatus(st, "جارٍ الحفظ…", "busy");
    try {
      await lib.db.doc(NAMES_DOC).set({ names: over, savedAt: new Date().toISOString() });
      adminDirty = false;
      receiveNames(over);
      renderAdmin();
      setStatus(st, okMsg, "ok");
    } catch (err) {
      const code = err && err.code;
      setStatus(st, code === "invalid_argument" ? "حفظ المسميات لصاحب الصفحة فقط." : "تعذّر الحفظ؛ حاول مرة أخرى.", "error");
    } finally {
      $("adminSave").disabled = false;
    }
  }
  /* ---------- المشرفون (في الموقع): يضيفهم صاحب الموقع ويحذفهم، وقواعد Firestore تمنح المضافين صلاحية الحذف والتعديل ---------- */
  let adminsOn = false;
  const armedAdmin = {};
  function watchAdmins() {
    if (adminsOn || !lib.db) return;
    adminsOn = true;
    lib.db.collection("admins").onSnapshot(
      (snap) => {
        lib.admins = snap.docs.filter((d) => d.exists).map((d) => Object.assign({ email: d.id }, d.data()));
        lib.adminsError = false;
        renderAdminPeople();
      },
      () => {
        lib.adminsError = true;
        renderAdminPeople();
      }
    );
  }
  function renderAdminPeople() {
    const me = (lib.user && lib.user.email) || "";
    const rows = [`<li><span dir="ltr">${esc(me)}</span><span class="hint">صاحب الموقع</span></li>`];
    if (lib.adminsError) rows.push(`<li class="hint">تعذّر تحميل قائمة المشرفين؛ تأكّد أن قواعد الحماية في Firebase محدّثة.</li>`);
    for (const a of (lib.admins || []).slice().sort((x, y) => x.email.localeCompare(y.email)))
      rows.push(
        `<li><span dir="ltr">${esc(a.email)}</span><button type="button" class="danger-btn${armedAdmin[a.email] ? " is-armed" : ""}" data-unadmin="${esc(a.email)}">${armedAdmin[a.email] ? "تأكيد الحذف" : "حذف"}</button></li>`
      );
    $("adminList").innerHTML = rows.join("");
  }
  async function addAdmin() {
    const st = $("adminPeopleStatus");
    const email = $("adminEmail").value.trim().toLowerCase();
    if (!/^[^\s@/]+@[^\s@/]+\.[^\s@/]+$/.test(email)) {
      setStatus(st, "اكتب بريداً صحيحاً، مثل name@gmail.com.", "error");
      return;
    }
    if (email === ((lib.user && lib.user.email) || "").toLowerCase() || (lib.admins || []).some((a) => a.email === email)) {
      setStatus(st, "هذا البريد مضاف من قبل.", "error");
      return;
    }
    $("adminAdd").disabled = true;
    try {
      await lib.db.collection("admins").doc(email).set({ addedAt: new Date().toISOString(), addedBy: lib.user.email });
      $("adminEmail").value = "";
      setStatus(st, `أُضيف ${email}. يدخل من «دخول صاحب الصفحة» بحساب Google بهذا البريد.`, "ok");
    } catch (err) {
      setStatus(st, err && err.code === "invalid_argument" ? "لم تسمح قاعدة البيانات بالإضافة؛ تأكّد أن قواعد الحماية محدّثة." : "تعذّرت الإضافة الآن.", "error");
    } finally {
      $("adminAdd").disabled = false;
    }
  }
  async function removeAdmin(email) {
    const st = $("adminPeopleStatus");
    if (!armedAdmin[email]) {
      armedAdmin[email] = setTimeout(() => {
        delete armedAdmin[email];
        renderAdminPeople();
      }, 4000);
      renderAdminPeople();
      return;
    }
    clearTimeout(armedAdmin[email]);
    delete armedAdmin[email];
    try {
      await lib.db.collection("admins").doc(email).delete();
      setStatus(st, `حُذف ${email} من المشرفين.`, "ok");
    } catch (err) {
      setStatus(st, "تعذّر الحذف الآن.", "error");
      renderAdminPeople();
    }
  }

  /* ---------- النسخة الاحتياطية (في الموقع): ملف فيه كل الخطط المحفوظة والمسميات، واسترجاعه ---------- */
  async function downloadBackup() {
    const st = $("backupStatus");
    const btn = $("backupDown");
    btn.disabled = true;
    setStatus(st, "جارٍ تجهيز النسخة…", "busy");
    try {
      const snap = await lib.db.collection("plans").get();
      const plans = snap.docs.filter((d) => d.exists).map((d) => Object.assign({ id: d.id }, d.data()));
      const names = Object.keys(nameOverrides || {}).length ? nameOverrides : null;
      const setts = settingsStamp ? settings : null;
      const data = { app: "khutat", kind: "backup", version: 1, exportedAt: new Date().toISOString(), site: location.origin + location.pathname, plans, names, settings: setts };
      const d = new Date();
      const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      await offerFile(new Blob([JSON.stringify(data, null, 1)], { type: "application/json" }), `نسخة احتياطية - الخطط المحفوظة ${stamp}.json`, st);
      if (st.dataset.kind !== "error") setStatus(st, `نُزّلت نسخة فيها ${plansWord(plans.length)}${names ? " والمسميات المعدّلة" : ""}${setts ? " والإعدادات التلقائية" : ""}.`, "ok");
    } catch (err) {
      setStatus(st, "تعذّر تجهيز النسخة الآن.", "error");
    } finally {
      btn.disabled = false;
    }
  }
  let pendingRestore = null;
  async function readBackup(file) {
    const st = $("backupStatus");
    pendingRestore = null;
    $("backupConfirm").hidden = true;
    try {
      const data = JSON.parse(await file.text());
      if (!data || data.app !== "khutat" || !Array.isArray(data.plans)) throw new Error("not a backup");
      const plans = data.plans.filter((p) => p && typeof p === "object" && typeof p.name === "string" && Array.isArray(p.rows));
      const names = data.names && typeof data.names === "object" && !Array.isArray(data.names) ? data.names : null;
      const setts = data.settings && typeof data.settings === "object" && !Array.isArray(data.settings) ? validSettings(data.settings) : null;
      if (!plans.length && !names && !setts) throw new Error("empty");
      pendingRestore = { plans, names, settings: setts };
      $("backupConfirm").textContent = `تأكيد استرجاع ${plansWord(plans.length)}`;
      $("backupConfirm").hidden = false;
      setStatus(st, `في الملف ${plansWord(plans.length)}${names ? " والمسميات" : ""}${setts ? " والإعدادات التلقائية" : ""}. الاسترجاع يضيفها ويحدّث المتطابق منها، ولا يحذف شيئاً.`, "");
    } catch (err) {
      setStatus(st, "هذا الملف ليس نسخة احتياطية من هذه الصفحة.", "error");
    }
  }
  async function restoreBackup() {
    const st = $("backupStatus");
    const r = pendingRestore;
    if (!r) return;
    const btn = $("backupConfirm");
    btn.disabled = true;
    setStatus(st, "جارٍ الاسترجاع…", "busy");
    try {
      const items = r.plans.map((p) => {
        const body = Object.assign({}, p);
        const id = typeof body.id === "string" && /^[A-Za-z0-9_-]{1,120}$/.test(body.id) ? body.id : null;
        delete body.id;
        return { id, data: body };
      });
      await lib.db.collection("plans").setMany(items);
      if (r.names) {
        await lib.db.doc(NAMES_DOC).set({ names: r.names, savedAt: new Date().toISOString() });
        receiveNames(r.names);
      }
      if (r.settings) {
        const doc = { settings: r.settings, savedAt: new Date().toISOString() };
        await lib.db.doc(SETTINGS_DOC).set(doc);
        receiveSettings(doc);
      }
      pendingRestore = null;
      btn.hidden = true;
      setStatus(st, `استُرجع ${plansWord(items.length)}${r.names ? " والمسميات" : ""}${r.settings ? " والإعدادات التلقائية" : ""}.`, "ok");
    } catch (err) {
      setStatus(st, err && err.code === "invalid_argument" ? "لم تسمح قاعدة البيانات بالاسترجاع." : "تعذّر الاسترجاع الآن؛ أعد المحاولة.", "error");
    } finally {
      btn.disabled = false;
    }
  }

  let resetArmed = null;
  function bindAdmin() {
    // الإعدادات التلقائية للخطط
    const dirty = () => (defaultsDirty = true);
    $("defaultsForm").addEventListener("input", dirty);
    $("defaultsForm").addEventListener("change", dirty);
    $("dWeekdays").addEventListener("click", (e) => {
      const b = e.target.closest("[data-wd]");
      if (!b) return;
      b.setAttribute("aria-pressed", String(b.getAttribute("aria-pressed") !== "true"));
      defaultsDirty = true;
    });
    $("defaultsForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveDefaults();
    });
    $("dReset").addEventListener("click", () => {
      fillDefaultsForm(clone(BASE_SETTINGS));
      defaultsDirty = true;
      setStatus($("defaultsStatus"), "مُلئت الإعدادات الأصلية؛ احفظها لتُعتمد.", "");
    });
    $("adminAdd").addEventListener("click", addAdmin);
    $("adminEmail").addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addAdmin();
      }
    });
    $("adminList").addEventListener("click", (e) => {
      const b = e.target.closest("[data-unadmin]");
      if (b) removeAdmin(b.dataset.unadmin);
    });
    $("backupDown").addEventListener("click", downloadBackup);
    $("backupUp").addEventListener("click", () => $("backupFile").click());
    $("backupFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) readBackup(f);
      e.target.value = "";
    });
    $("backupConfirm").addEventListener("click", restoreBackup);
    // الخطط الجاهزة والمتون
    $("filesAdmin").addEventListener("click", (e) => {
      const h = e.target.closest("[data-hide]");
      if (h) return toggleHidden(h.dataset.hide);
      const ed = e.target.closest("[data-edit]");
      if (ed) return startFilesEdit(ed.dataset.edit);
      const rm = e.target.closest("[data-remove]");
      if (rm) return removeExtra(rm.dataset.remove);
    });
    $("filesKind").addEventListener("change", syncFilesForm);
    $("filesForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveFilesForm();
    });
    $("fCancel").addEventListener("click", () => {
      resetFilesForm();
      setStatus($("filesStatus"), "", "");
    });
    $("adminFields").addEventListener("input", () => {
      adminDirty = true;
      setStatus($("adminStatus"), "", "");
    });
    $("adminForm").addEventListener("submit", (e) => {
      e.preventDefault();
      saveNames(collectNames(), "حُفظت المسميات، وتظهر الآن لكل من يفتح الصفحة.");
    });
    $("adminReset").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      if (!resetArmed) {
        btn.textContent = "تأكيد استعادة الأصل";
        resetArmed = setTimeout(() => {
          resetArmed = null;
          btn.textContent = "استعادة المسميات الأصلية";
        }, 4000);
        return;
      }
      clearTimeout(resetArmed);
      resetArmed = null;
      btn.textContent = "استعادة المسميات الأصلية";
      saveNames({}, "عادت المسميات الأصلية.");
    });
  }

  const armed = {};
  async function deletePlan(id, btn) {
    if (!armed[id]) {
      armed[id] = setTimeout(() => {
        delete armed[id];
        btn.textContent = "حذف";
        btn.classList.remove("is-armed");
      }, 4000);
      btn.textContent = "تأكيد الحذف";
      btn.classList.add("is-armed");
      return;
    }
    clearTimeout(armed[id]);
    delete armed[id];
    try {
      await lib.db.collection("plans").doc(id).delete();
      if (state.loaded && state.loaded.id === id) state.loaded = null;
      setStatus($("libStatus"), "حُذفت الخطة.", "ok");
      updateSaveArea();
    } catch (err) {
      setStatus($("libStatus"), "تعذّر الحذف.", "error");
    }
  }

  // بحث لا يتأثر بالتشكيل ولا بصور الهمزة والتاء المربوطة
  const fold = (s) =>
    norm(s)
      .replace(/[ً-ٰٟـ]/g, "")
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .toLowerCase();
  // التصفية: القوائم تُبنى مما في الخطط المحفوظة نفسها، وتختفي القائمة التي ليس فيها إلا خيار واحد
  const NONE = "__none__";
  const planLevel = (p) => {
    const t = p.textId ? getText(p.textId) : null;
    return t ? levelOf(t) : 0;
  };
  function fillFilter(sel, all, values) {
    const cur = sel.value;
    sel.innerHTML = `<option value="">${esc(all)}</option>` + values.map(([v, label]) => `<option value="${esc(v)}">${esc(label)}</option>`).join("");
    sel.value = values.some(([v]) => v === cur) ? cur : "";
    sel.hidden = values.length < 2;
  }
  function renderFilters() {
    const levels = [...new Set(lib.plans.map(planLevel))].sort((a, b) => (a || 9) - (b || 9));
    fillFilter($("libLevel"), "كل المستويات", levels.map((l) => [String(l), l ? LEVEL_NAMES[l] : "خطط مرفوعة"]));
    const order = (list) => (h) => (list.includes(h) ? list.indexOf(h) : h ? 500 : 999);
    const hal = [...new Set(lib.plans.map((p) => p.halaqa || ""))];
    const ho = order(HALAQAT);
    hal.sort((a, b) => ho(a) - ho(b) || a.localeCompare(b, "ar"));
    fillFilter($("libHalaqa"), "كل الحلقات", hal.map((h) => [h || NONE, h ? "حلقة " + h : "دون حلقة"]));
    const tea = [...new Set(lib.plans.map((p) => p.teacher || ""))];
    const to = order(TEACHERS);
    tea.sort((a, b) => to(a) - to(b) || a.localeCompare(b, "ar"));
    fillFilter($("libTeacher"), "كل المعلمين", tea.map((h) => [h || NONE, h || "دون معلم"]));
  }
  function renderLibrary() {
    if (SITE_MODE && lib.owner) watchExtra();
    const list = $("libList");
    const note = $("libNote");
    const n = lib.status === "ready" ? lib.plans.length : 0;
    $("navSavedCount").textContent = n ? AR(n) : "";
    $("navSavedCount").hidden = !n;
    $("libTools").hidden = n < 2;
    if (lib.status === "loading") {
      note.textContent = "جارٍ تحميل الخطط المحفوظة…";
      list.innerHTML = "";
    } else if (lib.status === "unavailable") {
      note.textContent = "تظهر الخطط المحفوظة لمن يفتح الصفحة من claude.ai وهو مسجّل الدخول.";
      list.innerHTML = "";
    } else if (lib.status === "error") {
      note.textContent = "تعذّر تحميل الخطط المحفوظة الآن.";
      list.innerHTML = "";
    } else if (!n) {
      note.textContent = lib.owner || SITE_MODE
        ? "لا خطط محفوظة بعد. أنشئ خطة في صفحة «إنشاء خطة» ثم اضغط «اعتماد الخطة» لتُحفظ هنا لكل من يفتح الصفحة."
        : "لم تُحفظ خطط بعد.";
      list.innerHTML = "";
    } else {
      note.textContent = SITE_MODE
        ? lib.owner
          ? "تُحفظ هنا كل خطة يعتمدها أحد في صفحة «إنشاء خطة»، وتستطيع حذف أيّ منها."
          : "تُحفظ هنا كل خطة يعتمدها أحد في صفحة «إنشاء خطة». افتح الخطة لتعديلها، أو نزّلها وورد أو PDF مباشرة، واحذف ما حفظتَه أنت من هذا الجهاز."
        : lib.owner
          ? "تُحفظ هنا كل خطة تعتمدها في صفحة «إنشاء خطة»، ويفتحها كل من يفتح الصفحة ويصدّرها."
          : "افتح الخطة لتعديلها قبل التصدير، أو نزّلها ملف وورد أو PDF مباشرة.";
      renderFilters();
      const q = fold($("libSearch").value);
      const fl = $("libLevel").value;
      const fh = $("libHalaqa").value;
      const ft = $("libTeacher").value;
      const shown = lib.plans.filter(
        (p) =>
          (!q || fold([p.name, p.textName, p.halaqa, p.teacher, savedDescription(p)].join(" ")).includes(q)) &&
          (!fl || String(planLevel(p)) === fl) &&
          (!fh || (p.halaqa || NONE) === fh) &&
          (!ft || (p.teacher || NONE) === ft)
      );
      const filtered = !!(q || fl || fh || ft);
      $("libCount").textContent = filtered && shown.length ? `تظهر ${AR(shown.length)} من ${plansWord(n)}.` : "";
      list.innerHTML = shown.length
        ? shown
            .map((p) => {
              const t = p.textId ? getText(p.textId) : null;
              const saved = p.savedAt ? Hijri.dmy(new Date(p.savedAt)) : "";
              const meta = [
                AR((t && t.name) || p.textName || ""),
                daysWord(p.days || (p.rows || []).length),
                p.halaqa ? "حلقة " + p.halaqa : "",
                p.teacher ? "المعلم: " + p.teacher : "",
                saved ? "حُفظت " + AR(saved) + " ه" : "",
              ].filter(Boolean).join("، ");
              const open = state.loaded && state.loaded.id === p.id;
              const pid = esc(p.id);
              return `<li class="lib-item${open ? " is-open" : ""}">
            <div class="lib-main"><b>${esc(AR(p.name || "خطة"))}</b><span class="hint">${esc(meta)}</span>${savedDescription(p) ? `<span class="lib-desc">${esc(savedDescription(p))}</span>` : ""}</div>
            <div class="lib-actions">
              <button type="button" class="link-btn" data-open="${pid}">${open ? "مفتوحة" : "فتح"}</button>
              <button type="button" class="link-btn" data-word="${pid}">تنزيل وورد</button>
              <button type="button" class="link-btn" data-pdf="${pid}">تنزيل PDF</button>
              ${SITE_MODE ? `<a class="link-btn wa-link" href="${esc(waHref(p))}" target="_blank" rel="noopener">إرسال بالواتساب</a>` : ""}
              ${SITE_MODE && lib.owner ? (promotedFrom(p.id) ? `<span class="hint">في «${esc(tabName("ready"))}»</span>` : `<button type="button" class="link-btn${armedPromote[p.id] ? " is-armed" : ""}" data-promote="${pid}">${armedPromote[p.id] ? "تأكيد النقل" : "إلى " + esc(tabName("ready"))}</button>`) : ""}
              ${canDelete(p) ? `<button type="button" class="danger-btn${armed[p.id] ? " is-armed" : ""}" data-del="${pid}">${armed[p.id] ? "تأكيد الحذف" : "حذف"}</button>` : ""}
            </div>
          </li>`;
            })
            .join("")
        : `<li class="lib-item lib-none">لا خطط تطابق ${filtered && !q ? "التصفية" : "البحث"}.</li>`;
    }
    updateSaveArea();
  }

  /* ---------- الصفحات: إنشاء خطة، الخطط المحفوظة، الخطط الجاهزة، المتون ---------- */
  const VIEWS = ["ready", "texts", "create", "saved", "admin"];
  function showView(name) {
    if (!VIEWS.includes(name)) name = "ready";
    if (name === "admin") renderAdmin();
    if (name === "saved") watchPlans();
    for (const v of VIEWS) $("view-" + v).hidden = v !== name;
    document.querySelectorAll(".pages-nav a").forEach((a) => {
      if (a.dataset.view === name) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    if (name === "ready" || name === "texts") {
      watchExtra();
      renderFiles(name);
    }
  }
  const route = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (SITE_MODE && h.startsWith("plan=")) {
      showView("create");
      openSharedPlan(h.slice(5));
      return;
    }
    showView(h);
  };
  function go(name) {
    if (location.hash.slice(1) !== name) location.hash = name;
    else showView(name);
    window.scrollTo(0, 0);
  }

  // ملفات منشورة مع الصفحة (قائمتها في LIBRARY)، تُنزَّل بطلب من الزائر
  const KIND_LABEL = { docx: "وورد", pdf: "PDF" };
  const sizeText = (b) => (b < 1048576 ? `${AR(Math.max(1, Math.round(b / 1024)))} ك.ب` : `${fmtNum(b / 1048576)} م.ب`);
  const EMPTY_FILES = {
    ready: "لم تُضف الخطط الجاهزة بعد. ستظهر هنا خطة كل متن بصيغتي وورد وPDF.",
    texts: "لم تُضف ملفات المتون بعد. سيظهر هنا كل متن بصيغة PDF.",
  };
  function renderFiles(kind) {
    const box = $(kind + "List");
    if (box.dataset.done) return;
    box.dataset.done = "1";
    const hidden = new Set(extra.hidden);
    const list = ((typeof LIBRARY !== "undefined" && LIBRARY[kind]) || [])
      .filter((e) => !hidden.has(hideKey(kind, e)))
      .concat(extra.entries.filter((e) => e.kind === kind));
    if (!list.length) {
      box.innerHTML = `<p class="empty">${EMPTY_FILES[kind]}</p>`;
      return;
    }
    const groups = {};
    list.forEach((e) => (groups[+e.level || 0] = groups[+e.level || 0] || []).push(e));
    // المستويات بالترتيب، و«أخرى» آخراً
    box.innerHTML = Object.keys(groups)
      .sort((a, b) => (+a || 99) - (+b || 99))
      .map(
        (lvl) => `
      <section class="file-group">
        <h3>${LEVEL_NAMES[lvl] || "أخرى"}</h3>
        <ul class="lib-list">${groups[lvl]
          .map(
            (e) => `
          <li class="lib-item">
            <div class="lib-main"><b>${esc(AR(e.title))}</b>${e.note ? `<span class="hint">${esc(AR(e.note))}</span>` : ""}</div>
            <div class="file-actions">${
              e.id
                ? e.files
                    .map((f, i) => `<button type="button" class="secondary file-btn" data-blob="${esc(e.id)}|${i}">${KIND_LABEL[f.kind] || esc(f.kind)} <span>${sizeText(+f.size || 0)}</span></button>`)
                    .join("")
                : e.gen
                ? ["docx", "pdf"]
                    .map((k) => `<button type="button" class="secondary file-btn" data-gen="${esc(e.gen.text)}" data-days="${+e.gen.days || 0}" data-kind="${k}">${KIND_LABEL[k]}</button>`)
                    .join("")
                : e.files
                    .map((f) => `<button type="button" class="secondary file-btn" data-path="${esc(f.path)}" data-name="${esc(f.name)}">${KIND_LABEL[f.kind] || esc(f.kind)} <span>${sizeText(f.size)}</span></button>`)
                    .join("")
            }</div>
          </li>`
          )
          .join("")}</ul>
      </section>`
      )
      .join("");
  }
  // خطة جاهزة تُبنى عند طلبها بالإعداد الأصلي (لا تتأثر بما في صفحة الإنشاء): أيامها الأصلية،
  // والربط بآخر ١٠ صفحات، والمراجعة على حسب المستويات، والمستوى الأول المختصر (ط. ٤٥) مع الأذكار والآداب
  function readyPlan(gen) {
    const t = getText(gen.text);
    if (!t) throw new Error("متن هذه الخطة غير موجود");
    const saved = Object.assign({}, state);
    try {
      state.prevInLevel = true;
      state.text = t;
      state.maxDays = pagesOf(t.id);
      state.days = Math.min(gen.days || t.days.length, state.maxDays);
      state.link = Object.assign({}, DEFAULT_LINK);
      state.withReview = true;
      state.level1 = validLevel1(null);
      state.review = validReview({ method: "levels", items: defaultItems(t), levels: {} });
      state.halaqa = { enabled: false, name: HALAQAT[0] };
      state.student = { enabled: false, name: "" };
      state.dates = { enabled: false, start: null, weekdays: [0, 1, 2, 3, 4], fill: true };
      state.studyDates = [];
      state.title = AR(t.title);
      state.edits = {};
      state.link.days = autoLinkDays();
      state.plan = buildPlan();
      const rows = currentRows();
      return { rows, sheets: sheetInfo(rows), title: state.title, file: `خطة ${t.name} - ${asciiDays(state.plan.D)}` };
    } finally {
      Object.assign(state, saved);
    }
  }
  function downloadReady(btn, st) {
    const gen = { text: btn.dataset.gen, days: +btn.dataset.days || 0 };
    const kind = btn.dataset.kind;
    return withBusy(btn, kind === "pdf" ? "جارٍ إعداد ملف PDF…" : "جارٍ إعداد ملف وورد…", async () => {
      const p = readyPlan(gen);
      const blob =
        kind === "pdf"
          ? await buildPdf(p.rows, p.sheets, { student: "", halaqa: "", duration: null, title: p.file })
          : await DocxBuilder.build({ templateB64: TEMPLATE_DOCX, title: p.title, rows: p.rows, sheets: p.sheets, halaqa: "", student: "", duration: null });
      await offerFile(blob, p.file.replace(/[\\/:*?"<>|]/g, "-") + "." + kind, st);
    }, st);
  }
  // ملف وورد مضمّن في الصفحة، أو ملف PDF منشور معها
  function downloadStatic(btn, st) {
    return withBusy(btn, "جارٍ تجهيز الملف…", async () => {
      const path = btn.dataset.path;
      const b64 = typeof LIBRARY_EMBED !== "undefined" && LIBRARY_EMBED[path];
      let blob;
      if (b64) {
        const bin = atob(b64);
        const bytes = new Uint8Array(bin.length);
        for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
        blob = new Blob([bytes]);
      } else {
        const res = await fetch(path);
        if (!res.ok) throw new Error("الملف غير متاح الآن");
        blob = await res.blob();
      }
      await offerFile(blob, btn.dataset.name, st);
    }, st);
  }

  /* ---------- ما يضيفه المشرفون إلى «الخطط الجاهزة» و«المتون PDF» (الموقع) ----------
     تخزين الملفات في Firebase (Storage) يحتاج الخطة المدفوعة، فيُحفظ كل ملف في Firestore أجزاءً:
     blobs/{رقم}-{ترتيب} فيها نص base64 لا يزيد على BLOB_CHUNK حرف (المستند ١ م.ب على الأكثر)، وبياناته في library/{رقم}.
     وما في الصفحة أصلاً (LIBRARY) لا يُحذف بل يُخفى، بقائمة في config/library. */
  const LIBRARY_DOC = "config/library";
  const BLOB_CHUNK = 900000;
  const MAX_FILE = 15 * 1048576;
  const MIME = { docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", pdf: "application/pdf" };
  const extra = { status: "idle", entries: [], hidden: [] };
  let extraWatching = false;
  let filesEdit = null;
  const armedFiles = {};
  const armedPromote = {};
  const hideKey = (kind, e) => kind + ":" + entryKey(e);
  const tabName = (kind) => document.querySelector(`[data-tab="${kind}"]`).textContent.trim();
  const daysNote = (n) => pick(n, { one: "يوم واحد", two: "يومان", pl: `${n} أيام`, acc: `${n} يوماً`, gen: `${n} يوم` });
  const validExtra = (e) => !!e && (e.kind === "ready" || e.kind === "texts") && typeof e.title === "string" && Array.isArray(e.files);
  const promotedFrom = (id) => extra.entries.find((e) => e.from === id);
  function watchExtra() {
    if (!SITE_MODE || extraWatching) return;
    extraWatching = true;
    extra.status = "loading";
    cloudReady.then(
      (c) => {
        c.db.collection("library").onSnapshot(
          (snap) => {
            extra.entries = snap.docs
              .map((d) => Object.assign({}, d.data(), { id: d.id }))
              .filter(validExtra)
              .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
            extra.status = "ready";
            extraChanged();
          },
          () => {
            extra.status = "error";
            extraChanged();
          }
        );
        c.db.doc(LIBRARY_DOC).onSnapshot(
          (snap) => {
            const d = (snap.exists && snap.data()) || {};
            extra.hidden = Array.isArray(d.hidden) ? d.hidden.filter((x) => typeof x === "string") : [];
            extraChanged();
          },
          () => {}
        );
      },
      () => {
        extra.status = "error";
        extraChanged();
      }
    );
  }
  function extraChanged() {
    for (const kind of ["ready", "texts"]) {
      delete $(kind + "List").dataset.done;
      if (!$("view-" + kind).hidden) renderFiles(kind);
    }
    if (!$("view-admin").hidden && lib.owner) renderFilesAdmin();
    if (!$("view-saved").hidden) renderLibrary();
  }
  const filesError = (err) =>
    err && err.code === "invalid_argument"
      ? "لم يُحفظ: قواعد Firebase لا تسمح بعد بهذا، أو انتهى دخولك. انشر القواعد الجديدة في Firebase ثم أعد المحاولة."
      : err && err.code === "quota_exceeded"
        ? "لم يُحفظ: بلغت قاعدة البيانات حدّها اليومي؛ أعد المحاولة غداً."
        : "لم يُحفظ: " + (err && err.message ? err.message : "خطأ غير معروف");
  function b64Bytes(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  function fileB64(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ""));
      r.onerror = () => reject(new Error("تعذّرت قراءة الملف"));
      r.readAsDataURL(blob);
    });
  }
  const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(10)), (b) => b.toString(16).padStart(2, "0")).join("");
  async function storeBlob(blob, kind, name) {
    const b64 = await fileB64(blob);
    const id = randomId();
    const items = [];
    for (let i = 0, k = 0; i < b64.length; i += BLOB_CHUNK, k++) items.push({ id: `${id}-${k}`, data: { data: b64.slice(i, i + BLOB_CHUNK), i: k } });
    await lib.db.collection("blobs").setMany(items);
    return { kind, name, size: blob.size, blob: id, parts: items.length };
  }
  const blobIds = (files) => files.flatMap((f) => Array.from({ length: Math.max(1, +f.parts || 1) }, (_, i) => `${f.blob}-${i}`));
  async function dropBlobs(files) {
    if (files.length) await lib.db.collection("blobs").deleteMany(blobIds(files)).catch(() => {});
  }
  async function blobOf(f) {
    const snaps = await Promise.all(blobIds([f]).map((id) => lib.db.collection("blobs").doc(id).get()));
    if (snaps.some((sn) => !sn.exists)) throw new Error("الملف غير موجود");
    return new Blob([b64Bytes(snaps.map((sn) => sn.data().data).join(""))], { type: MIME[f.kind] || "application/octet-stream" });
  }
  function downloadBlob(btn, st) {
    return withBusy(btn, "جارٍ تجهيز الملف…", async () => {
      const [id, i] = btn.dataset.blob.split("|");
      const e = extra.entries.find((x) => x.id === id);
      const f = e && e.files[+i];
      if (!f) throw new Error("الملف غير موجود");
      await cloudReady;
      await offerFile(await blobOf(f), f.name, st);
    }, st);
  }
  // لوحة التحكم: القائمتان، ونموذج الإضافة والتعديل
  function fillFilesLevel() {
    const sel = $("fLevel");
    const cur = sel.value;
    sel.innerHTML =
      [1, 2, 3, 4, 5, 6, 7].filter((l) => LEVEL_NAMES[l]).map((l) => `<option value="${l}">${esc(LEVEL_NAMES[l])}</option>`).join("") + `<option value="0">أخرى</option>`;
    if (cur) sel.value = cur;
  }
  function syncFilesForm() {
    const editing = filesEdit ? extra.entries.find((e) => e.id === filesEdit) : null;
    const kind = editing ? editing.kind : document.querySelector('input[name="fkind"]:checked').value;
    $("fDocxRow").hidden = kind !== "ready";
    $("fNoteRow").hidden = kind !== "ready";
    $("filesKind").hidden = !!editing;
    $("filesForm").classList.toggle("is-editing", !!editing);
    $("filesFormTitle").textContent = editing ? `تعديل «${AR(editing.title)}»` : "إضافة ملف";
    $("fSave").textContent = editing ? "حفظ التعديل" : "إضافة";
    $("fCancel").hidden = !editing;
    $("filesFormHint").textContent = editing
      ? "اختر ملفاً جديداً لتستبدل به الموجود، أو اتركه فيبقى كما هو."
      : kind === "ready"
        ? `يظهر في «${tabName("ready")}»: ملف وورد أو PDF أو كلاهما.`
        : `يظهر في «${tabName("texts")}»: ملف PDF للمتن.`;
  }
  function renderFilesAdmin() {
    fillFilesLevel();
    syncFilesForm();
    const box = $("filesAdmin");
    if (extra.status === "idle" || extra.status === "loading") {
      box.innerHTML = `<p class="hint">جارٍ تحميل القائمة…</p>`;
      return;
    }
    const hidden = new Set(extra.hidden);
    const lvl = (e) => LEVEL_NAMES[+e.level] || "أخرى";
    const group = (kind) => {
      const base = ((typeof LIBRARY !== "undefined" && LIBRARY[kind]) || []).map((e) => {
        const key = hideKey(kind, e);
        const off = hidden.has(key);
        const meta = [lvl(e), e.note ? AR(e.note) : "", off ? "مخفية عن الزوار" : "من ملفات الصفحة"].filter(Boolean).join("، ");
        return `<li class="lib-item${off ? " is-hidden" : ""}"><div class="lib-main"><b>${esc(AR(e.title))}</b><span class="hint">${esc(meta)}</span></div>
          <div class="lib-actions"><button type="button" class="link-btn" data-hide="${esc(key)}">${off ? "إظهار" : "إخفاء"}</button></div></li>`;
      });
      const added = extra.entries
        .filter((e) => e.kind === kind)
        .map((e) => {
          const kinds = e.files.map((f) => KIND_LABEL[f.kind] || f.kind).join(" و");
          const meta = [lvl(e), e.note ? AR(e.note) : "", kinds, e.from ? "منقولة من الخطط المحفوظة" : "مضافة"].filter(Boolean).join("، ");
          return `<li class="lib-item${filesEdit === e.id ? " is-open" : ""}"><div class="lib-main"><b>${esc(AR(e.title))}</b><span class="hint">${esc(meta)}</span></div>
          <div class="lib-actions"><button type="button" class="link-btn" data-edit="${esc(e.id)}">تعديل</button><button type="button" class="danger-btn${armedFiles[e.id] ? " is-armed" : ""}" data-remove="${esc(e.id)}">${armedFiles[e.id] ? "تأكيد الحذف" : "حذف"}</button></div></li>`;
        });
      const items = base.concat(added).join("") || `<li class="lib-item lib-none">لا شيء بعد.</li>`;
      return `<div class="files-admin-group"><h3 class="admin-level">${esc(tabName(kind))}</h3><ul class="lib-list">${items}</ul></div>`;
    };
    box.innerHTML =
      (extra.status === "error" ? `<p class="status" data-kind="error">تعذّر تحميل ما أُضيف؛ تظهر هنا ملفات الصفحة وحدها.</p>` : "") + group("ready") + group("texts");
  }
  function resetFilesForm() {
    filesEdit = null;
    for (const id of ["fTitle", "fNote", "fDocx", "fPdf"]) $(id).value = "";
    renderFilesAdmin();
  }
  function startFilesEdit(id) {
    const e = extra.entries.find((x) => x.id === id);
    if (!e) return;
    filesEdit = id;
    renderFilesAdmin();
    $("fTitle").value = e.title;
    $("fNote").value = e.note || "";
    $("fLevel").value = String(+e.level || 0);
    $("fDocx").value = "";
    $("fPdf").value = "";
    setStatus($("filesStatus"), "", "");
    $("filesForm").scrollIntoView({ block: "nearest", behavior: "smooth" });
    $("fTitle").focus();
  }
  async function saveFilesForm() {
    const st = $("filesStatus");
    const editing = filesEdit ? extra.entries.find((e) => e.id === filesEdit) : null;
    const kind = editing ? editing.kind : document.querySelector('input[name="fkind"]:checked').value;
    const title = cleanName($("fTitle").value);
    const note = kind === "ready" ? cleanName($("fNote").value) : "";
    const level = clampInt($("fLevel").value, 0, 7, 0);
    const docx = kind === "ready" ? $("fDocx").files[0] : null;
    const pdf = $("fPdf").files[0];
    if (!title) return setStatus(st, "اكتب العنوان.", "error");
    if (docx && !/\.docx$/i.test(docx.name)) return setStatus(st, "ملف وورد يكون بصيغة docx.", "error");
    if (pdf && !/\.pdf$/i.test(pdf.name)) return setStatus(st, "ملف PDF يكون بصيغة pdf.", "error");
    if ([docx, pdf].some((f) => f && f.size > MAX_FILE)) return setStatus(st, "الملف أكبر من ١٥ م.ب.", "error");
    if (!editing && !docx && !pdf) return setStatus(st, kind === "ready" ? "اختر ملف وورد أو PDF." : "اختر ملف PDF.", "error");
    const btn = $("fSave");
    btn.disabled = true;
    setStatus(st, docx || pdf ? "جارٍ رفع الملفات…" : "جارٍ الحفظ…", "busy");
    const fresh = [];
    try {
      await cloudReady;
      const files = editing ? editing.files.slice() : [];
      const old = [];
      for (const [k, f] of [["docx", docx], ["pdf", pdf]]) {
        if (!f) continue;
        const stored = await storeBlob(f, k, f.name);
        fresh.push(stored);
        const at = files.findIndex((x) => x.kind === k);
        if (at >= 0) old.push(files.splice(at, 1, stored)[0]);
        else files.push(stored);
      }
      files.sort((a, b) => (a.kind === "docx" ? 0 : 1) - (b.kind === "docx" ? 0 : 1));
      const now = new Date().toISOString();
      const data = { kind, title, note, level, files, by: (lib.user && lib.user.uid) || "", createdAt: (editing && editing.createdAt) || now, updatedAt: now };
      if (editing && editing.from) data.from = editing.from;
      await lib.db.collection("library").doc(editing ? editing.id : undefined).set(data);
      await dropBlobs(old);
      resetFilesForm();
      setStatus(st, editing ? `حُفظ تعديل «${AR(title)}».` : `أُضيفت «${AR(title)}» إلى «${tabName(kind)}».`, "ok");
    } catch (err) {
      await dropBlobs(fresh);
      setStatus(st, filesError(err), "error");
    } finally {
      btn.disabled = false;
    }
  }
  async function removeExtra(id) {
    const st = $("filesStatus");
    if (!armedFiles[id]) {
      armedFiles[id] = setTimeout(() => {
        delete armedFiles[id];
        renderFilesAdmin();
      }, 4000);
      renderFilesAdmin();
      return;
    }
    clearTimeout(armedFiles[id]);
    delete armedFiles[id];
    const e = extra.entries.find((x) => x.id === id);
    if (!e) return;
    setStatus(st, "جارٍ الحذف…", "busy");
    try {
      await lib.db.collection("library").doc(id).delete();
      await dropBlobs(e.files);
      if (filesEdit === id) resetFilesForm();
      setStatus(st, `حُذفت «${AR(e.title)}».`, "ok");
    } catch (err) {
      setStatus(st, filesError(err), "error");
    }
  }
  async function toggleHidden(key) {
    const st = $("filesStatus");
    const set = new Set(extra.hidden);
    const off = set.has(key);
    if (off) set.delete(key);
    else set.add(key);
    try {
      await lib.db.doc(LIBRARY_DOC).set({ hidden: [...set], savedAt: new Date().toISOString() });
      setStatus(st, off ? "ظهرت للزوار من جديد." : "أُخفيت عن الزوار، وتستطيع إظهارها متى شئت.", "ok");
    } catch (err) {
      setStatus(st, filesError(err), "error");
    }
  }
  // خطة محفوظة إلى «الخطط الجاهزة»: يُبنى ملفا وورد وPDF منها في متصفح المشرف، ويُحفظان كبقية الملفات المضافة
  async function promotePlan(id) {
    const st = $("libStatus");
    const p = lib.plans.find((x) => x.id === id);
    if (!p) return;
    if (!armedPromote[id]) {
      armedPromote[id] = setTimeout(() => {
        delete armedPromote[id];
        renderLibrary();
      }, 4000);
      renderLibrary();
      return;
    }
    clearTimeout(armedPromote[id]);
    delete armedPromote[id];
    if (!openPlan(p)) {
      setStatus(st, "متن هذه الخطة غير موجود في الصفحة.", "error");
      return;
    }
    setStatus(st, "جارٍ إعداد ملفي وورد وPDF ورفعهما…", "busy");
    const stored = [];
    try {
      await cloudReady;
      const base = baseFilename();
      stored.push(await storeBlob(await docxBlob(), "docx", base + ".docx"));
      stored.push(await storeBlob(await pdfBlob(), "pdf", base + ".pdf"));
      const now = new Date().toISOString();
      await lib.db.collection("library").doc().set({
        kind: "ready",
        title: cleanName(p.name) || AR(state.text.name),
        note: daysNote(state.plan.D),
        level: levelOf(state.text),
        files: stored,
        from: p.id,
        by: (lib.user && lib.user.uid) || "",
        createdAt: now,
        updatedAt: now,
      });
      setStatus(st, `أُضيفت «${AR(p.name)}» إلى «${tabName("ready")}» بصيغتي وورد وPDF، وتعدّلها أو تحذفها من لوحة التحكم.`, "ok");
    } catch (err) {
      await dropBlobs(stored);
      setStatus(st, filesError(err), "error");
    }
  }

  /* ---------- ربط العناصر ---------- */
  function bind() {
    $("level").addEventListener("change", (e) => {
      const lvl = +e.target.value;
      const prefs = loadPrefs();
      // متون المستوى كلها معلَّمة في الأصل، والخطة من أول متونها
      const id = lvl === 0 ? customTexts[0] && customTexts[0].id : selectionId(lvl, levelTexts(lvl).map((t) => t.id));
      startPending = null;
      state.loaded = null;
      state.approved = null;
      selectText(id, prefs.days && prefs.days[id]);
      renderLibrary();
    });
    $("text").addEventListener("change", (e) => {
      const prefs = loadPrefs();
      state.loaded = null;
      state.approved = null;
      selectText(e.target.value, prefs.days && prefs.days[e.target.value]);
      renderLibrary();
    });
    // علامة صح على متن: الخطة من المتون المعلَّمة (ومتن واحد على الأقل)، و«البدء» تحت كل متن، ومتن أو مستوى يُضاف بعدها
    const noKeep = () => setStatus($("textChecksNote"), "يبقى متن واحد على الأقل يُحفظ في الخطة.", "error");
    $("textChecks").addEventListener("change", (e) => {
      const el = e.target;
      const lvl = +$("level").value;
      const ents = composition(lvl).entries;
      if (el.id === "l1Edition") return setLevel1({ edition: el.value });
      if (el.id === "appendText") {
        const v = el.value;
        if (!v) return;
        const ids = v.startsWith("level:") ? levelAppendIds(+v.slice(6), ents) : [v];
        startPending = null;
        recompose(ents.concat(ids.filter((id) => !ents.some((x) => x.id === id)).map((id) => ({ id, mode: "whole", from: 0 }))));
        return;
      }
      // طريقة البدء في متن: «من صفحة…» تنتظر رقم الصفحة، وغيرها تُطبَّق مباشرة
      if (el.matches("select[data-start]")) {
        const id = el.dataset.start;
        if (!ents.some((x) => x.id === id)) return;
        if (el.value === "from") {
          startPending = id;
          fillTextSelect(lvl);
          const inp = $("textChecks").querySelector(`input[data-page="${id}"]`);
          if (inp) inp.focus();
          return;
        }
        startPending = null;
        if (!recompose(ents.map((x) => (x.id === id ? { id, mode: el.value, from: 0 } : x)))) {
          fillTextSelect(lvl);
          noKeep();
        }
        return;
      }
      if (el.matches("input[data-page]")) {
        const id = el.dataset.page;
        const span = pageSpan(getText(id));
        const n = parseIntAny(el.value);
        const hint = $("textChecks").querySelector(`[data-hint="${id}"]`);
        if (!(n >= span.a && n <= span.b)) {
          if (hint) setStatus(hint, `اكتب صفحة من ${AR(span.a + 1)} إلى ${AR(span.b)}.`, "error");
          return;
        }
        startPending = null;
        // أول صفحة في المتن: من أوله
        const from = n === span.a ? 0 : n;
        recompose(ents.map((x) => (x.id === id ? { id, mode: from ? "from" : "whole", from } : x)));
        return;
      }
      if (!el.matches("input[type=checkbox][data-id]")) return;
      const inLevel = levelTexts(lvl).map((t) => t.id);
      const checked = inLevel.filter((id) => $("textChecks").querySelector(`input[data-id="${id}"]`).checked);
      const next = checked.map((id) => ents.find((x) => x.id === id) || { id, mode: "whole", from: 0 }).concat(ents.filter((x) => !inLevel.includes(x.id)));
      if (!checked.length) {
        el.checked = true;
        setStatus($("textChecksNote"), "علّم متناً واحداً على الأقل.", "error");
        return;
      }
      if (startPending && !checked.includes(startPending)) startPending = null;
      if (!recompose(next)) {
        el.checked = true;
        noKeep();
      }
    });
    $("textChecks").addEventListener("click", (e) => {
      const b = e.target.closest("[data-unappend], [data-unappend-level]");
      if (!b) return;
      const lvl = +$("level").value;
      const inLevel = levelTexts(lvl).map((t) => t.id);
      const ents = composition(lvl).entries;
      const next = b.dataset.unappend
        ? ents.filter((x) => x.id !== b.dataset.unappend)
        : ents.filter((x) => inLevel.includes(x.id) || String(getText(x.id).level) !== b.dataset.unappendLevel);
      if (!recompose(next)) noKeep();
    });
    $("textChecks").addEventListener("keydown", (e) => {
      if (e.target.matches("input[data-page]") && e.key === "Enter") {
        e.preventDefault();
        e.target.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    $("days").addEventListener("input", (e) => {
      const n = parseIntAny(e.target.value);
      if (Number.isFinite(n) && n >= 1) setDays(n);
    });
    $("days").addEventListener("blur", () => ($("days").value = AR(state.days)));
    $("daysRange").addEventListener("input", (e) => setDays(+e.target.value));
    $("dec").addEventListener("click", () => setDays(state.days - 1));
    $("inc").addEventListener("click", () => setDays(state.days + 1));

    // اسم الطالب
    $("withStudent").addEventListener("change", (e) => {
      state.student.enabled = e.target.checked;
      syncControls();
      renderReadout();
      updateStudentLine();
      updateSaveArea();
      savePrefs();
      if (e.target.checked) $("student").focus();
    });
    $("student").addEventListener("input", (e) => {
      state.student.name = e.target.value;
      renderReadout();
      updateStudentLine();
      updateSaveArea();
    });

    // الحلقة
    fillHalaqa();
    $("withHalaqa").addEventListener("change", (e) => {
      state.halaqa.enabled = e.target.checked;
      syncControls();
      renderReadout();
      renderSheets();
      updateSaveArea();
      savePrefs();
    });
    $("halaqa").addEventListener("change", (e) => {
      state.halaqa.name = e.target.value;
      renderReadout();
      renderSheets();
      updateSaveArea();
      savePrefs();
    });
    // المعلم لا يدخل في ورقة الخطة، فلا تُعاد المعاينة؛ يتغير الاعتماد وحده
    $("teacher").addEventListener("change", (e) => {
      state.teacher = e.target.value;
      updateSaveArea();
      savePrefs();
    });

    // التاريخ الهجري
    if (!Hijri.available) $("datesBox").hidden = true;
    else {
      fillDateSelects();
      $("withDates").addEventListener("change", (e) => {
        state.dates.enabled = e.target.checked;
        if (state.dates.enabled && !state.dates.start) state.dates.start = Hijri.today();
        $("datesBody").hidden = !state.dates.enabled;
        datesChanged();
      });
      for (const id of ["sd", "sm", "sy"]) {
        $(id).addEventListener("change", () => {
          const d = readDate("s");
          if (d) state.dates.start = d;
          datesChanged();
        });
      }
      for (const id of ["ed", "em", "ey"]) {
        $(id).addEventListener("change", () => {
          const end = readDate("e");
          if (!end || end < state.dates.start) {
            $("datesInfo").textContent = "تاريخ النهاية قبل تاريخ البداية.";
            return;
          }
          const n = Hijri.countStudyDays(state.dates.start, end, state.dates.weekdays);
          if (n >= 1) setDays(n);
        });
      }
      $("weekdays").addEventListener("click", (e) => {
        const b = e.target.closest("[data-wd]");
        if (!b) return;
        const wd = +b.dataset.wd;
        const set = new Set(state.dates.weekdays);
        if (set.has(wd)) {
          if (set.size > 1) set.delete(wd);
        } else set.add(wd);
        state.dates.weekdays = [...set].sort();
        datesChanged();
      });
      $("fillDays").addEventListener("change", (e) => {
        state.dates.fill = e.target.checked;
        datesChanged();
      });
    }

    // الربط
    $("withLink").addEventListener("change", (e) => {
      state.link.enabled = e.target.checked;
      regenerate();
    });
    for (const id of ["linkByPages", "linkByDays"]) {
      $(id).addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.link.mode = e.target.value;
        regenerate();
      });
    }
    $("linkPages").addEventListener("input", (e) => {
      const n = parseIntAny(e.target.value);
      if (!Number.isFinite(n) || n < 1) return;
      state.link.pages = Math.min(n, 300);
      state.link.mode = "pages";
      regenerate();
    });
    $("linkDays").addEventListener("input", (e) => {
      const n = parseIntAny(e.target.value);
      if (!Number.isFinite(n) || n < 1) return;
      state.link.days = Math.min(n, 30);
      state.link.daysManual = true;
      state.link.mode = "days";
      regenerate();
    });
    for (const id of ["linkPages", "linkDays"]) $(id).addEventListener("blur", () => syncControls());
    $("linkCont").addEventListener("change", (e) => {
      state.link.cont = e.target.checked;
      regenerate();
    });
    $("linkPrev").addEventListener("change", (e) => {
      state.link.prevId = e.target.value || null;
      regenerate();
    });
    $("linkAuto").addEventListener("click", () => {
      state.link.daysManual = false;
      regenerate();
    });

    // إعدادات الربط والمراجعة كما ضبطها صاحب الصفحة
    $("resetDefaults").addEventListener("click", () => {
      applyPlanDefaults();
      renderReview();
      regenerate();
      setStatus($("status"), "عادت إعدادات الربط والمراجعة الكبرى إلى الإعدادات التلقائية.", "ok");
    });

    // المراجعة الكبرى
    $("withReview").addEventListener("change", (e) => {
      state.withReview = e.target.checked;
      regenerate();
    });
    const list = $("reviewList");
    list.addEventListener("change", (e) => {
      const t = e.target;
      const it = state.review.items[+t.dataset.i];
      if (!it) return;
      if (t.classList.contains("ritem-src")) {
        const wasSelf = it.source === "self";
        it.source = t.value;
        if (wasSelf !== (it.source === "self") && it.mode === "days") it.value = it.source === "self" ? 3 : Math.min(10, pagesOf(it.source));
        // اختيار طبعة للمختصر تصير هي المعتمدة في المراجعة على حسب المستويات أيضاً
        if (MUKHTASAR_EDITIONS.includes(it.source) && state.text.level > 1) state.level1.edition = it.source;
        reviewChanged(true);
      } else if (t.classList.contains("ritem-mode")) {
        if (t.value === it.mode) return;
        if (it.source === "self") it.value = t.value === "days" ? 3 : 20;
        else {
          const P = pagesOf(it.source);
          it.value = Math.max(1, Math.min(P, Math.ceil(P / it.value)));
        }
        it.mode = t.value;
        reviewChanged(true);
      }
    });
    list.addEventListener("input", (e) => {
      const t = e.target;
      if (!t.classList.contains("ritem-val")) return;
      const i = +t.dataset.i;
      const it = state.review.items[i];
      const n = parseIntAny(t.value);
      if (!it || !Number.isFinite(n) || n < 1) return;
      it.value = Math.min(n, it.source === "self" || it.mode === "pages" ? 999 : pagesOf(it.source));
      $("rnote-" + i).textContent = reviewNote(it);
      reviewChanged(false);
    });
    list.addEventListener("focusout", (e) => {
      const t = e.target;
      if (!t.classList || !t.classList.contains("ritem-val")) return;
      const it = state.review.items[+t.dataset.i];
      if (it) t.value = AR(it.value);
    });
    list.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-act]");
      if (!b) return;
      const i = +b.dataset.i;
      const items = state.review.items;
      const act = b.dataset.act;
      if (act === "del") items.splice(i, 1);
      else if (act === "up" && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
      else if (act === "down" && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
      reviewChanged(true);
      const at = act === "up" ? i - 1 : act === "down" ? i + 1 : Math.min(i, items.length - 1);
      const target = list.querySelector(`button[data-act="${act}"][data-i="${at}"]:not(:disabled)`) || $("rsrc-" + at) || $("addReview");
      target.focus();
    });
    $("addReview").addEventListener("click", () => {
      const items = state.review.items;
      if (items.length >= MAX_REVIEW) return;
      const source = nextReviewSource();
      if (!source) {
        setStatus($("status"), "لا متن بعد آخر متن في القائمة.", "");
        return;
      }
      items.push({ source, mode: "pages", value: 20 });
      reviewChanged(true);
      $("rsrc-" + (items.length - 1)).focus();
    });
    $("fillPrev").addEventListener("click", () => {
      const before = previousTexts(state.text);
      if (!before.length) return;
      state.review.items = before.slice(0, MAX_REVIEW).map((t) => ({ source: t.id, mode: "pages", value: 20 }));
      reviewChanged(true);
    });
    $("reviewRepeat").addEventListener("change", (e) => {
      state.review.repeat = e.target.checked;
      reviewChanged(false);
    });
    $("mergeShort").addEventListener("change", (e) => {
      state.review.mergeShort = e.target.checked;
      reviewChanged(false);
    });
    // طريقة المراجعة
    for (const id of ["methodList", "methodLevels"]) {
      $(id).addEventListener("change", (e) => {
        if (!e.target.checked) return;
        state.review.method = e.target.value;
        renderReview();
        regenerate();
      });
    }
    // محتوى المستوى الأول (المختصر بإحدى طبعتيه، والأذكار والآداب)
    const editions = MUKHTASAR_EDITIONS.map((id) => `<option value="${id}">${esc(AR(getText(id).name))}</option>`).join("");
    $("revEdition").innerHTML = editions;
    // طبعة المختصر (في قائمة «المتون» للمستوى الأول وفي المراجعة) والأذكار والآداب في مراجعة المستوى الأول
    function setLevel1(patch) {
      Object.assign(state.level1, patch);
      const t = state.text;
      const swap = patch.edition && /^mix:/.test(t.id) ? t.id.replace(/(^mix:|[;~])(mukhtasar\d+)(?=$|[;@])/, `$1${patch.edition}`) : null;
      if (t.id === "level-1") selectText("level-1", undefined, { keepLink: true, review: state.review, title: state.title });
      else if (swap && swap !== t.id && getText(swap)) selectText(swap, undefined, { keepLink: true, review: state.review });
      else if (patch.edition && isMukhtasar(t)) selectText(patch.edition, undefined, { keepLink: true, review: state.review });
      else {
        if (levelOf(t) === 1) fillTextSelect(1);
        if (state.review.method === "levels") renderLevels();
        regenerate();
      }
    }
    $("revEdition").addEventListener("change", (e) => setLevel1({ edition: e.target.value }));
    $("revAdhkar").addEventListener("change", (e) => setLevel1({ adhkar: e.target.checked }));
    $("levelStartOn").addEventListener("change", (e) => {
      const lv = state.review.levels;
      lv.startOn = e.target.checked;
      // أول تفعيل: المجموعة الثانية في الدورة
      if (lv.startOn) {
        const base = levelSequence(state.text, Object.assign({}, lv, { startOn: false }));
        if (!base.some((g) => g.lvl === lv.start) && base[1]) lv.start = base[1].lvl;
      }
      renderLevels();
      regenerate();
    });
    $("levelStart").addEventListener("change", (e) => {
      state.review.levels.start = +e.target.value;
      renderLevels();
      regenerate();
    });
    $("levelPages").addEventListener("input", (e) => {
      const n = parseIntAny(e.target.value);
      if (!Number.isFinite(n) || n < 1) return;
      state.review.levels.pages = Math.min(n, 999);
      renderLevels();
      regenerate();
    });
    $("levelPages").addEventListener("blur", () => ($("levelPages").value = AR(state.review.levels.pages)));
    $("levelSelf").addEventListener("change", (e) => {
      state.review.levels.self = e.target.checked;
      renderLevels();
      regenerate();
    });

    // العنوان والمعاينة
    $("title").addEventListener("input", (e) => {
      state.title = e.target.value;
      updateSheetTitles();
      updateSaveArea();
    });
    $("resetTitle").addEventListener("click", () => {
      state.title = AR(state.text.title);
      $("title").value = state.title;
      updateSheetTitles();
      updateSaveArea();
    });
    $("sheets").addEventListener("input", (e) => {
      const inp = e.target;
      if (!inp.classList.contains("cell")) return;
      const i = +inp.dataset.i;
      const col = inp.dataset.col;
      const k = i + ":" + col;
      const raw = ASCII(stripMarks(inp.value)).trim();
      if (raw === state.plan.rows[i][col]) delete state.edits[k];
      else state.edits[k] = raw;
      inp.parentElement.classList.toggle("is-edited", k in state.edits);
      renderEdits();
    });
    $("sheets").addEventListener("focusout", (e) => {
      if (e.target.classList && e.target.classList.contains("cell")) e.target.value = disp(e.target.value);
    });
    $("undoEdits").addEventListener("click", () => {
      state.edits = {};
      renderSheets();
      renderEdits();
    });

    // الملفات
    $("export").addEventListener("click", () => exportDocx());
    $("exportPdf").addEventListener("click", () => exportPdf());
    $("exportXlsx").addEventListener("click", exportXlsx);
    $("importBtn").addEventListener("click", () => $("importFile").click());
    $("importFile").addEventListener("change", (e) => {
      const f = e.target.files && e.target.files[0];
      if (f) importFile(f);
      e.target.value = "";
    });

    // الخطط المحفوظة
    $("approve").addEventListener("click", () => approvePlan());
    $("ownerIn").addEventListener("click", siteSignIn);
    $("ownerOut").addEventListener("click", () => {
      ownerMsg("", "");
      if (lib.cloud) lib.cloud.auth.signOut().catch(() => {});
    });
    $("libSearch").addEventListener("input", renderLibrary);
    for (const id of ["libLevel", "libHalaqa", "libTeacher"]) $(id).addEventListener("change", renderLibrary);
    $("libList").addEventListener("click", (e) => {
      const st = $("libStatus");
      const openBtn = e.target.closest("[data-open]");
      const wordBtn = e.target.closest("[data-word]");
      const pdfBtn = e.target.closest("[data-pdf]");
      const delBtn = e.target.closest("[data-del]");
      if (delBtn) return deletePlan(delBtn.dataset.del, delBtn);
      const promoteBtn = e.target.closest("[data-promote]");
      if (promoteBtn) return promotePlan(promoteBtn.dataset.promote);
      const btn = openBtn || wordBtn || pdfBtn;
      if (!btn) return;
      const p = lib.plans.find((x) => x.id === (btn.dataset.open || btn.dataset.word || btn.dataset.pdf));
      if (!p) return;
      if (!openPlan(p)) {
        setStatus(st, "متن هذه الخطة غير موجود في الصفحة.", "error");
        return;
      }
      if (wordBtn) exportDocx(wordBtn, st);
      else if (pdfBtn) exportPdf(pdfBtn, st);
      else {
        setStatus($("status"), `فُتحت «${AR(p.name)}»؛ صدّرها، أو عدّلها ثم اعتمدها من جديد.`, "ok");
        go("create");
      }
    });

    // الخطط الجاهزة والمتون
    for (const kind of ["ready", "texts"]) {
      $(kind + "List").addEventListener("click", (e) => {
        const g = e.target.closest("[data-gen]");
        if (g) return downloadReady(g, $(kind + "Status"));
        const bl = e.target.closest("[data-blob]");
        if (bl) return downloadBlob(bl, $(kind + "Status"));
        const b = e.target.closest("[data-path]");
        if (b) downloadStatic(b, $(kind + "Status"));
      });
    }

    // التنقل بين الصفحات
    window.addEventListener("hashchange", () => {
      route();
      window.scrollTo(0, 0);
    });
  }

  function start() {
    $("logo").src = "data:image/jpeg;base64," + LOGO_JPG;
    captureNameDefaults();
    nameOverrides = loadCachedNames();
    applyNames(effectiveNames(nameOverrides));
    fillLevelSelect();
    bind();
    bindAdmin();
    // الإعدادات التلقائية (آخر ما وصل منها)، ثم تفضيلات العارض ما لم تتغير الإعدادات بعدها
    loadCachedSettings();
    renderNotice();
    let prefs = loadPrefs();
    prefsStamp = prefs.settingsStamp || "";
    if (prefsStamp !== settingsStamp) {
      prefs = dropStalePrefs(prefs);
      delete prefs.stale;
      prefsStamp = prefs.settingsStamp = settingsStamp;
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(prefs));
      } catch (e) {
        /* لا بأس */
      }
    }
    state.link = linkDefaults();
    state.withReview = settings.review.enabled;
    applyShowDefaults();
    if (prefs.link) Object.assign(state.link, prefs.link);
    if (typeof prefs.withReview === "boolean") state.withReview = prefs.withReview;
    if (prefs.halaqa && HALAQAT.includes(prefs.halaqa.name))
      state.halaqa = { enabled: typeof prefs.halaqa.enabled === "boolean" ? prefs.halaqa.enabled : state.halaqa.enabled, name: prefs.halaqa.name };
    if (typeof prefs.teacher === "string" && TEACHERS.includes(prefs.teacher)) state.teacher = prefs.teacher;
    fillTeacher();
    if (prefs.student && typeof prefs.student.enabled === "boolean") state.student.enabled = prefs.student.enabled;
    if (prefs.dates && Hijri.available) {
      const d = prefs.dates;
      const startDate = fromHijriShort(d.start);
      const on = typeof d.enabled === "boolean" ? d.enabled : state.dates.enabled;
      state.dates = {
        enabled: on && !!(startDate || state.dates.start),
        start: startDate || state.dates.start,
        weekdays: Array.isArray(d.weekdays) && d.weekdays.length ? d.weekdays : state.dates.weekdays,
        fill: d.fill !== false,
      };
    }
    state.level1 = level1FromPrefs(prefs);
    // حفظ قديم: «المستوى الأول كاملاً» بلا الأذكار والآداب هو المختصر وحده
    const saved = prefs.text && getText(prefs.text) ? prefs.text : "level-1";
    const id = saved === "level-1" && prefs.level1 && prefs.level1.adhkar === false ? state.level1.edition : saved;
    const days = prefs.days && prefs.days[id] ? prefs.days[id] : undefined;
    selectText(id, days, { keepLink: !!(prefs.link && prefs.link.daysManual) });
    renderLibrary();
    route();
    getDownloads();
    initLibrary();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
})();

