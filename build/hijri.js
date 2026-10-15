
/* ===== التاريخ الهجري (تقويم أم القرى) ===== */
const Hijri = (() => {
  const MONTHS = ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"];
  const WEEKDAYS = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const DAY = 86400000;
  let formatter = null;
  try {
    formatter = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura-nu-latn", { timeZone: "UTC", year: "numeric", month: "numeric", day: "numeric" });
  } catch (e) {
    formatter = null;
  }

  // تاريخ ميلادي (منتصف النهار بتوقيت غرينتش) ← {y, m, d} هجري
  function parts(date) {
    const p = formatter.formatToParts(date);
    const v = (t) => parseInt((p.find((x) => x.type === t) || {}).value, 10);
    return { y: v("year"), m: v("month"), d: v("day") };
  }
  function today() {
    const n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate(), 12));
  }
  // {y, m, d} هجري ← تاريخ ميلادي، أو null إن لم يوجد اليوم (كالثلاثين في شهر ناقص)
  function toGregorian(y, m, d) {
    const approx = Date.UTC(622, 6, 19, 12) + ((y - 1) * 354.36667 + (m - 1) * 29.5306 + (d - 1)) * DAY;
    for (let off = 0; off <= 45; off++) {
      for (const s of off ? [off, -off] : [0]) {
        const dt = new Date(approx + s * DAY);
        const h = parts(dt);
        if (h.y === y && h.m === m && h.d === d) return dt;
      }
    }
    return null;
  }
  function monthLength(y, m) {
    return toGregorian(y, m, 30) ? 30 : 29;
  }
  // أيام الدراسة بدءاً من start (أيام الأسبوع: ٠ الأحد … ٦ السبت)
  function studyDates(start, weekdays, count) {
    const set = new Set(weekdays);
    const out = [];
    if (!set.size) return out;
    for (let i = 0; out.length < count && i < count * 7 + 14; i++) {
      const dt = new Date(start.getTime() + i * DAY);
      if (set.has(dt.getUTCDay())) out.push(dt);
    }
    return out;
  }
  function countStudyDays(start, end, weekdays) {
    const set = new Set(weekdays);
    let n = 0;
    for (let t = start.getTime(); t <= end.getTime(); t += DAY) if (set.has(new Date(t).getUTCDay())) n++;
    return n;
  }
  // صيغة التخزين: السنة/الشهر/اليوم
  function short(date) {
    const h = parts(date);
    return `${h.y}/${h.m}/${h.d}`;
  }
  // صيغة العرض والطباعة: اليوم/الشهر/السنة، وبعد كل خط مائل علامة اتجاه (RLM) تمنع وورد
  // والمتصفح من دمج الأرقام، فيُقرأ التاريخ من اليمين: اليوم ثم الشهر ثم السنة.
  const RLM = "\u200f";
  function dmy(date) {
    const h = parts(date);
    return `${h.d}/${RLM}${h.m}/${RLM}${h.y}`;
  }
  function dm(date) {
    const h = parts(date);
    return `${h.d}/${RLM}${h.m}`;
  }
  function long(date) {
    const h = parts(date);
    return `${WEEKDAYS[date.getUTCDay()]} ${h.d} ${MONTHS[h.m - 1]} ${h.y}`;
  }

  return { available: !!formatter, MONTHS, WEEKDAYS, parts, today, toGregorian, monthLength, studyDates, countStudyDays, short, dmy, dm, long };
})();

