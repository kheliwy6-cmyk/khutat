
/* ===== منطق الخطة =====
   كل يوم في الخطة الأصلية «وحدة جهد» تتوزع على صفحاته بالتساوي. لإنشاء خطة في D يوماً
   تُقسَّم صفحات المتن بالترتيب إلى D مجموعة متتالية يقترب جهد كل منها من N/D،
   مع تفضيل القطع عند نهايات الأيام الأصلية. */
const PlanCore = (() => {
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const FA_DIGITS = "۰۱۲۳۴۵۶۷۸۹";

  function toAscii(s) {
    return String(s).replace(/[٠-٩۰-۹]/g, (c) => {
      const i = AR_DIGITS.indexOf(c);
      return String(i >= 0 ? i : FA_DIGITS.indexOf(c));
    });
  }
  function toArabicDigits(s) {
    return String(s).replace(/[0-9]/g, (d) => AR_DIGITS[+d]);
  }

  function parseRange(s) {
    const t = toAscii(s).replace(/[–—]/g, "-").replace(/\s+/g, "");
    const m = t.match(/^(?:(\d+)\/)?(\d+)(?:-(\d+))?$/);
    if (!m) return null;
    let a = +m[2];
    let b = m[3] ? +m[3] : a;
    if (b < a) [a, b] = [b, a];
    return { level: m[1] ? +m[1] : null, a, b };
  }

  function fmt(level, a, b) {
    const core = a === b ? String(a) : `${a}-${b}`;
    return level != null ? `${level}/${core}` : core;
  }

  /* صفحات المتن بالترتيب، لكل صفحة وزنها ورقم يومها الأصلي */
  function buildUnits(days) {
    const units = [];
    days.forEach((d, i) => {
      const r = parseRange(d);
      if (!r) throw new Error("مقدار غير مفهوم: " + d);
      const p = r.b - r.a + 1;
      for (let pg = r.a; pg <= r.b; pg++) units.push({ level: r.level, page: pg, w: 1 / p, day: i });
    });
    return units;
  }

  /* تقسيم بالبرمجة الديناميكية: يقلل انحراف جهد كل يوم عن الهدف، مع غرامة صغيرة على القطع
     داخل يوم أصلي، وحدٍّ يُبقي التقدّم التراكمي قريباً من الوتيرة المثلى. */
  const LAMBDA = 0.045;
  const PACE = 0.02;
  function partition(units, D, N) {
    const P = units.length;
    D = Math.max(1, Math.min(Math.round(D), P));
    const T = N / D;
    const S = new Float64Array(P + 1);
    for (let k = 0; k < P; k++) S[k + 1] = S[k] + units[k].w;
    const clean = new Uint8Array(P + 1);
    clean[0] = 1;
    clean[P] = 1;
    for (let m = 1; m < P; m++) clean[m] = units[m - 1].day !== units[m].day ? 1 : 0;

    let prev = new Float64Array(P + 1).fill(Infinity);
    prev[0] = 0;
    const back = [];
    for (let j = 1; j <= D; j++) {
      const cur = new Float64Array(P + 1).fill(Infinity);
      const bk = new Int32Array(P + 1).fill(-1);
      const kmax = P - (D - j);
      for (let k = j; k <= kmax; k++) {
        let best = Infinity;
        let bm = -1;
        const lag = (S[k] - j * T) / T;
        const track = PACE * lag * lag;
        for (let m = k - 1; m >= j - 1; m--) {
          const W = S[k] - S[m];
          const rel = (W - T) / T;
          const dev = rel * rel;
          if (W > T && dev + track >= best) break;
          if (prev[m] === Infinity) continue;
          const c = prev[m] + dev + track + (clean[m] ? 0 : LAMBDA);
          if (c < best - 1e-12) {
            best = c;
            bm = m;
          }
        }
        cur[k] = best;
        bk[k] = bm;
      }
      back.push(bk);
      prev = cur;
    }
    const groups = [];
    let k = P;
    for (let j = D; j >= 1; j--) {
      const m = back[j - 1][k];
      groups.push([m, k]);
      k = m;
    }
    groups.reverse();
    return groups.map(([s, e]) => {
      let w = 0;
      for (let x = s; x < e; x++) w += units[x].w;
      return { s, e, level: units[s].level, from: units[s].page, to: units[e - 1].page, pages: e - s, effort: w };
    });
  }

  /* صيغة مقدار يمتد على صفحات units[s..e] بأسلوب الخطط الأصلية:
     - في متن واحد أو متون متتالية من كتاب المستوى نفسه: «2/25-34» (تُتجاوز الصفحات بين المتون)
     - إذا رجعت الصفحات في المستوى نفسه (من آخر الأربعين إلى أول النواقض): «133-140+25-26»
     - إذا انتقل من مستوى إلى آخر: «1/258←2/82» (يُكتب السهم في وورد برمز Wingdings كالأصل) */
  // صفحات units[s..e] قطعاً: كل قطعة في جزء واحد وصفحاتها متقدمة (تبدأ قطعة جديدة إذا رجعت الصفحات أو تغيّر الجزء)
  function spanRuns(units, s, e) {
    const runs = [];
    for (let x = s; x <= e; x++) {
      const u = units[x];
      const r = runs[runs.length - 1];
      if (r && r.level === u.level && u.page > r.to) r.to = u.page;
      else runs.push({ level: u.level, from: u.page, to: u.page });
    }
    return runs;
  }
  function fmtRuns(runs) {
    if (!runs || !runs.length) return "";
    if (runs.length === 1) return fmt(runs[0].level, runs[0].from, runs[0].to);
    if (runs.every((r) => r.level === runs[0].level)) return runs.map((r) => fmt(null, r.from, r.to)).join("+");
    const a = runs[0];
    const b = runs[runs.length - 1];
    return `${fmt(a.level, a.from, a.from)}←${fmt(b.level, b.to, b.to)}`;
  }
  function fmtSpan(units, s, e) {
    return fmtRuns(spanRuns(units, s, e));
  }

  function spanText(units, groups, i, j) {
    return fmtSpan(units, groups[i].s, groups[j].e - 1);
  }
  const spanRunsG = (units, groups, i, j) => spanRuns(units, groups[i].s, groups[j].e - 1);

  // مجموعات الأيام الأصلية لمتن (لمتابعة الربط منه بالأيام)
  function dayGroups(units) {
    const out = [];
    units.forEach((u, i) => {
      const g = out[out.length - 1];
      if (g && units[g.s].day === u.day) g.e = i + 1;
      else out.push({ s: i, e: i + 1 });
    });
    return out;
  }

  /* الربط: آخر X صفحة محفوظة قبل يوم الحفظ، أو حفظ آخر K أيام.
     يعيد نص الخانة وبداية نافذة الربط (رقم الصفحة في ترتيب المتن) لكل يوم.
     تُحسب النافذة حتى لو أُلغي الربط، فتبقى خانته فارغة ولا تدخل صفحاته في المراجعة. */
  /* prevUnits: صفحات المتن السابق إن طُلبت متابعة الربط منه؛ تسبق صفحات الخطة، فيبدأ ربط
     أول الأيام من آخر المتن السابق ثم يتناقص منه ويزيد من المتن الجديد.
     startUnit سالب إذا بدأت نافذة الربط في المتن السابق. */
  function linkColumn(units, groups, link, prevUnits) {
    const D = groups.length;
    const pU = prevUnits || [];
    const off = pU.length;
    const all = off ? pU.concat(units) : units;
    const G = dayGroups(pU).concat(groups.map((g) => ({ s: g.s + off, e: g.e + off })));
    const P0 = G.length - D;
    const startUnit = groups.map((g) => g.s);
    const on = !!(link && link.enabled);
    const text = groups.map(() => (on ? "-" : ""));
    // قطع صفحات كل خانة (لملف اكسل: الجزء ومن وإلى وعدد الصفحات)
    const runs = groups.map(() => []);
    if (!link) return { text, startUnit, runs };
    for (let n = 0; n < D; n++) {
      const gi = P0 + n;
      if (gi === 0) continue;
      const endIdx = G[gi - 1].e - 1;
      const startIdx =
        link.mode === "days"
          ? G[Math.max(0, gi - Math.max(1, Math.round(link.days) || 1))].s
          : Math.max(0, endIdx - Math.max(1, Math.round(link.pages) || 1) + 1);
      startUnit[n] = startIdx - off;
      if (on) {
        runs[n] = spanRuns(all, startIdx, endIdx);
        text[n] = fmtRuns(runs[n]);
      }
    }
    return { text, startUnit, runs };
  }

  /* ===== المراجعة الكبرى =====
     قائمة مرتبة؛ كل عنصر متن محفوظ سابقاً (يُراجَع كاملاً من أول صفحة) أو عدة متون تُراجَع
     متصلة كأنها كتاب واحد (متون المستوى الواحد)، أو «المتن نفسه» (ما حُفظ منه قبل نافذة الربط).
     مقدار كل عنصر: صفحات في اليوم أو مدة بالأيام. ينتهي العنصر ثم يبدأ الذي يليه، وعند نهاية
     القائمة تعود إلى أولها إن طُلب التكرار. */
  function itemTexts(it, getText) {
    const ids = Array.isArray(it.ids) ? it.ids : [it.source];
    return getText ? ids.map((id) => getText(id)).filter(Boolean) : [];
  }

  // أجزاء المراجعة لمتن أو متون متصلة؛ لكل جزء نصه والمتون التي تبدأ فيه
  function reviewChunks(texts, mode, value) {
    const units = [];
    const firsts = [];
    let dayBase = 0;
    for (const t of texts) {
      firsts.push({ id: t.id, at: units.length });
      for (const u of buildUnits(t.days)) units.push({ level: u.level, page: u.page, w: 1, day: dayBase + u.day });
      dayBase += t.days.length;
    }
    const P = units.length;
    const v = Math.max(1, Math.round(value) || 1);
    const D = Math.max(1, Math.min(mode === "days" ? v : Math.ceil(P / v), P));
    // المتن الذي تقع فيه صفحة معيّنة
    const textAt = (u) => {
      let id = firsts.length ? firsts[0].id : null;
      for (const f of firsts) if (f.at <= u) id = f.id;
      return id;
    };
    return partition(units, D, P).map((g) => {
      const runs = spanRuns(units, g.s, g.e - 1);
      return {
        text: fmtRuns(runs),
        runs,
        starts: firsts.filter((f) => f.at >= g.s && f.at < g.e).map((f) => f.id),
        last: textAt(g.e - 1),
      };
    });
  }

  function pagesBetween(groups, a, b) {
    let s = 0;
    for (let x = a; x <= b; x++) s += groups[x].pages;
    return s;
  }

  // أقرب نهاية لجزء يقارب C صفحة، مع ضمّ البقية إن كانت يسيرة
  function greedyEnd(groups, s, last, C) {
    let e = s;
    let sum = groups[s].pages;
    while (e < last) {
      const next = sum + groups[e + 1].pages;
      if (Math.abs(next - C) <= Math.abs(sum - C)) {
        sum = next;
        e++;
      } else break;
    }
    const rem = e < last ? pagesBetween(groups, e + 1, last) : 0;
    if (rem > 0 && rem < C / 3) e = last;
    return e;
  }

  // تقسيم الأيام s..last من المتن نفسه على عدد محدد من الأيام
  function selfDayChunks(groups, s, last, days) {
    const n = Math.max(1, Math.min(Math.round(days) || 1, last - s + 1));
    const out = [];
    let p = s;
    for (let c = 0; c < n; c++) {
      const left = n - c;
      if (left === 1) {
        out.push([p, last]);
        break;
      }
      const target = pagesBetween(groups, p, last) / left;
      let e = p;
      let sum = groups[p].pages;
      while (e < last - (left - 1)) {
        const next = sum + groups[e + 1].pages;
        if (Math.abs(next - target) <= Math.abs(sum - target)) {
          sum = next;
          e++;
        } else break;
      }
      out.push([p, e]);
      p = e + 1;
    }
    return out;
  }

  /* يعيد نص كل خانة، ومعه المتون التي يبدأ فيها مراجعتها («self» للمتن نفسه) لتُكتب في الملاحظات */
  function reviewColumn(units, groups, parts, lastAvail, review, getText) {
    // المتون التي تبدأ في الصفحات [us, ue) من متن الخطة، والمتن الذي تقع فيه صفحة
    const partsIn = (us, ue) => parts.filter((pt) => pt.at >= us && pt.at < ue).map((pt) => pt.id);
    const partAt = (u) => {
      let id = parts.length ? parts[0].id : null;
      for (const pt of parts) if (pt.at <= u) id = pt.id;
      return id;
    };
    // آخر متن رُوجع قبل هذا اليوم: لا يُكتب اسم متن في الملاحظات إذا عادت مراجعته بعد نفسه
    let lastText = null;
    const note = (n, ids, last) => {
      starts[n] = ids.filter((id) => id !== lastText);
      lastText = last;
    };
    const D = groups.length;
    const out = new Array(D).fill("-");
    const runs = groups.map(() => []);
    const starts = groups.map(() => []);
    const items = (review && Array.isArray(review.items) ? review.items : []).filter(
      (it) => it && (it.source === "self" || itemTexts(it, getText).length)
    );
    if (!items.length) return { out, starts, runs };
    let idx = 0;
    let started = false;
    let queue = null;
    let selfPtr = 0;
    let passEnd = -1;
    let finished = false;
    const advance = () => {
      idx++;
      started = false;
      queue = null;
      if (idx >= items.length) {
        if (review.repeat) idx = 0;
        else finished = true;
      }
    };
    for (let n = 0; n < D; n++) {
      const last = lastAvail[n];
      let produced = false;
      for (let tries = 0; tries <= items.length && !produced && !finished; tries++) {
        const it = items[idx];
        if (it.source !== "self") {
          if (!started) {
            queue = reviewChunks(itemTexts(it, getText), it.mode, it.value);
            started = true;
          }
          const c = queue.shift();
          out[n] = c.text;
          runs[n] = c.runs;
          note(n, c.starts, c.last);
          produced = true;
          if (!queue.length) advance();
          continue;
        }
        if (!started) {
          if (last < 0) {
            advance();
            continue;
          }
          started = true;
          passEnd = last;
          selfPtr = 0;
          queue =
            it.mode === "days"
              ? selfDayChunks(groups, 0, passEnd, it.value).map(([a, b]) => ({
                  text: spanText(units, groups, a, b),
                  runs: spanRunsG(units, groups, a, b),
                  starts: partsIn(groups[a].s, groups[b].e),
                  last: partAt(groups[b].e - 1),
                }))
              : null;
        }
        if (queue) {
          const c = queue.shift();
          out[n] = c.text;
          runs[n] = c.runs;
          note(n, c.starts, c.last);
          produced = true;
          if (!queue.length) advance();
        } else {
          const e = greedyEnd(groups, selfPtr, passEnd, Math.max(1, it.value || 20));
          out[n] = spanText(units, groups, selfPtr, e);
          runs[n] = spanRunsG(units, groups, selfPtr, e);
          note(n, partsIn(groups[selfPtr].s, groups[e].e), partAt(groups[e].e - 1));
          produced = true;
          selfPtr = e + 1;
          if (e >= passEnd) advance();
        }
      }
    }
    return { out, starts, runs };
  }

  /* text: { id, days, segments?: [{id, days}] } — segments لخطة المستوى كاملاً (متونه بالترتيب)
     opts: { days, link:{enabled,mode,pages,days}, prev?: متن سابق يُتابَع منه الربط, withReview,
             review:{items:[{source:"self"|id, ids?:[id…], mode, value}], repeat}, getText,
             noteName?(id) → اسم قصير للملاحظات } */
  function makePlan(text, opts) {
    const units = buildUnits(text.days);
    const N = text.days.length;
    const P = units.length;
    const D = Math.max(1, Math.min(Math.round(opts.days || N), P));
    const groups = partition(units, D, N);
    // أول صفحة لكل متن من متون الخطة
    const parts = [];
    let day0 = 0;
    for (const sg of text.segments || [{ id: text.id, days: N }]) {
      const at = units.findIndex((u) => u.day >= day0);
      if (at >= 0) parts.push({ id: sg.id, at });
      day0 += sg.days;
    }
    const partOf = (u) => {
      let id = parts.length ? parts[0].id : text.id;
      for (const pt of parts) if (pt.at <= u) id = pt.id;
      return id;
    };
    const prevUnits = opts.prev ? buildUnits(opts.prev.days) : null;
    const link = linkColumn(units, groups, opts.link, prevUnits);
    const groupOf = new Int32Array(P);
    groups.forEach((g, i) => groupOf.fill(i, g.s, g.e));
    const lastAvail = link.startUnit.map((u) => (u < 0 ? -1 : groupOf[u] - 1));
    const rev = opts.withReview ? reviewColumn(units, groups, parts, lastAvail, opts.review, opts.getText) : null;
    const noteName = opts.noteName || (() => "");
    return {
      N,
      P,
      D,
      groups,
      rows: groups.map((g, i) => {
        const memoRuns = spanRuns(units, g.s, g.e - 1);
        return {
          memo: fmtRuns(memoRuns),
          link: link.text[i],
          big: rev ? rev.out[i] : "",
          // اسم المتن الذي تبدأ مراجعته في هذا اليوم، في خانة الملاحظات
          note: rev ? rev.starts[i].map(noteName).filter(Boolean).join("، ") : "",
          // متون الحفظ في هذا اليوم (لعنوان الصفحة ورموز الاستماع)
          texts: [...new Set([partOf(g.s), partOf(g.e - 1)])],
          // قطع صفحات كل خانة: [{level, from, to}] (لملف اكسل بطريقة التسجيل اليومي)
          runs: { memo: memoRuns, link: link.runs[i], big: rev ? rev.runs[i] || [] : [] },
        };
      }),
    };
  }

  function stats(plan) {
    const pages = plan.groups.map((g) => g.pages);
    return {
      avg: pages.reduce((a, b) => a + b, 0) / pages.length,
      min: Math.min(...pages),
      max: Math.max(...pages),
      ratio: plan.N / plan.D,
    };
  }

  return { toAscii, toArabicDigits, parseRange, fmt, fmtSpan, fmtRuns, spanRuns, buildUnits, partition, makePlan, stats };
})();

if (typeof module !== "undefined") module.exports = PlanCore;

