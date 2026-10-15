
/* ===== تصدير الخطة ملف PDF =====
   ترسم كل ٢٢ يوماً في صفحة A4 بمقاسات قالب وورد كما يخرجه وورد نفسه (العنوان، صناديق الاستماع،
   سطر الطالب والمدة، الجدول، العلامة المائية، رقم الصفحة)، ثم تُجمع الصفحات في ملف PDF واحد:
   طبقة سوداء حادة (النصوص والخطوط والرموز) بدقة ٣٠٠ نقطة في البوصة، وتحتها طبقة الألوان
   (العلامة المائية وتظليل الرأس وظل الصناديق) صورةً خفيفة. */
const PdfBuilder = (() => {
  const PAGE_W = 595.28;
  const PAGE_H = 841.89;
  const INK_SCALE = 300 / 72; // طبقة الحبر: ٣٠٠ نقطة في البوصة
  const BG_SCALE = 1.5; // طبقة الألوان
  const JPEG_SCALE = 2.5; // لمتصفح لا يضغط البيانات: الصفحة كلها صورة واحدة
  const ROWS = 22;
  const FAMILY = '"Traditional Arabic", "KhutatNaskh", serif';
  const font = (size, bold) => `${bold ? "bold " : ""}${size.toFixed(2)}px ${FAMILY}`;

  // مقاسات القالب بالنقاط، كما قيست في ملف PDF أخرجه وورد من القالب نفسه
  const COL_L = 35.45;
  const COL_R = 581.18;
  const ANCHOR = 21.47; // أعلى فقرة العنوان
  const LINE = 1.775; // ارتفاع السطر بالنسبة إلى حجم الخط
  const BASE = 1.03; // موضع خط الأساس من أعلى السطر
  const BOX = { w: 79.7, h: 82.7, dy: -6.35, inset: 7.2 };
  const SLOT_X = { r1: 493.85, r2: 410.15, l1: 43.1, l2: 126.8 };
  const SLOTS = { 1: ["r1"], 2: ["r1", "l1"], 3: ["r1", "l2", "l1"], 4: ["r1", "r2", "l2", "l1"] };
  const SLOT_PT = 85.7; // ما يُترك للنص عن كل صندوق
  const PIC1 = { w: 52.8, h: 54.5, dy: 18.15 };
  const PICN = { w: 43.3, h: 44.7, dy: 28.5 };
  // حدود أعمدة الجدول من اليمين: اليوم، التاريخ، الحفظ، أتم، الربط، أتم، المراجعة، أتم، استماع، ملاحظات
  const X = [562.92, 513.74, 471.34, 400.44, 360.18, 287.04, 249.18, 180.64, 138.04, 109.74, 52.82];
  const VLINE = [1.44, 0.48, 0.48, 0.48, 0.96, 0.48, 0.96, 0.48, 0.48, 0.48, 1.44];
  const COL = { day: 0, date: 1, memo: 2, link: 4, big: 6, listen: 8, note: 9 };
  const HEAD1 = 29.0;
  const HEAD2 = 28.1;
  const ROW = 26.9; // ارتفاع صف اليوم كما في ملف وورد (ثابت)
  const THICK = 1.44;
  const THIN = 0.48;
  const GRAY = "#d9d9d9";
  const FOOT = { x: 300.4, base: 813.1 };
  const WM = { x: 99.8, y: 210.85, w: 416.8, h: 394.85 };

  /* ---------- الخطوط والصور ---------- */
  function bytesOf(b64) {
    const bin = atob(b64);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  let fontsReady = null;
  function loadFonts() {
    if (!fontsReady) {
      fontsReady = (async () => {
        const F = typeof KHUTAT_FONTS !== "undefined" ? KHUTAT_FONTS : null;
        if (F && typeof FontFace === "function" && document.fonts) {
          for (const [w, b64] of [["400", F.regular], ["700", F.bold]]) {
            if (!b64) continue;
            try {
              const face = new FontFace("KhutatNaskh", bytesOf(b64).buffer, { weight: w, style: "normal" });
              await face.load();
              document.fonts.add(face);
            } catch (e) {
              /* يبقى الخط الاحتياطي */
            }
          }
        }
        try {
          await Promise.all([document.fonts.load(font(18, false), "ابت"), document.fonts.load(font(18, true), "ابت")]);
        } catch (e) {
          /* لا بأس */
        }
      })();
    }
    return fontsReady;
  }
  const imageCache = new Map();
  function loadImage(b64, type) {
    const key = type + b64.length + b64.slice(0, 64) + b64.slice(-64);
    if (!imageCache.has(key)) {
      imageCache.set(
        key,
        new Promise((resolve) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => resolve(null);
          img.src = `data:${type};base64,${b64}`;
        })
      );
    }
    return imageCache.get(key);
  }

  // صورة الرمز لطبقة الحبر: الأسود معتم والأبيض شفاف
  const inkCache = new WeakMap();
  function inkImage(img) {
    if (!img) return null;
    if (!inkCache.has(img)) {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || img.width;
      c.height = img.naturalHeight || img.height;
      const g = c.getContext("2d");
      g.drawImage(img, 0, 0);
      const d = g.getImageData(0, 0, c.width, c.height);
      const a = d.data;
      for (let i = 0; i < a.length; i += 4) {
        const lum = (a[i] * 299 + a[i + 1] * 587 + a[i + 2] * 114) / 1000;
        a[i + 3] = Math.round(((255 - lum) * a[i + 3]) / 255);
        a[i] = a[i + 1] = a[i + 2] = 0;
      }
      g.putImageData(d, 0, 0);
      inkCache.set(img, c);
    }
    return inkCache.get(img);
  }

  /* ---------- النص ---------- */
  function measure(ctx, text, size, bold) {
    ctx.font = font(size, bold);
    return ctx.measureText(text).width;
  }
  // أكبر حجم (بربع نقطة) يبقى به النص في عرض معيّن
  function fit(ctx, text, width, max, min, bold) {
    const w = measure(ctx, text, max, bold);
    if (w <= width) return max;
    return Math.max(min, Math.floor(((max * width) / w) * 4) / 4);
  }
  // تقسيم النص على أسطر بعرض معيّن (بالكلمات، بترتيبها المنطقي)
  function wrap(ctx, text, width, size, bold) {
    ctx.font = font(size, bold);
    const words = String(text).split(" ").filter((w) => w !== "");
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? cur + " " + w : w;
      if (cur && ctx.measureText(next).width > width) {
        lines.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) lines.push(cur);
    return lines.length ? lines : [""];
  }
  function text(ctx, str, x, y, size, bold, align = "center", color = "#000") {
    ctx.font = font(size, bold);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = "alphabetic";
    ctx.fillText(str, x, y);
  }
  // سطر من أجزاء بخطوط مختلفة (كعنوان «مدّة المستوى:» بخط عريض وبعده التاريخ)، يُرسم من اليمين
  function segments(ctx, parts, cx, y, size) {
    const widths = parts.map((p) => measure(ctx, p.t, size, p.b));
    let x = cx + widths.reduce((a, b) => a + b, 0) / 2;
    parts.forEach((p, i) => {
      text(ctx, p.t, x, y, size, p.b, "right");
      x -= widths[i];
    });
  }

  /* ---------- رأس الصفحة ---------- */
  function drawBox(ctx, bg, x, y) {
    bg.save();
    bg.shadowColor = "rgba(0,0,0,0.42)";
    bg.shadowBlur = 3.2 * bg.__scale;
    bg.shadowOffsetX = 2.2 * bg.__scale;
    bg.shadowOffsetY = 2.2 * bg.__scale;
    bg.fillStyle = "#fff";
    bg.fillRect(x, y, BOX.w, BOX.h);
    bg.restore();
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(x, y, BOX.w, BOX.h);
  }
  async function drawHeader(ctx, bg, sheet, opts) {
    const qrs = (sheet.qrs || []).slice(0, 4);
    const k = qrs.length;
    const slots = SLOTS[k] || [];
    // صناديق الاستماع
    for (let i = 0; i < k; i++) {
      const x = SLOT_X[slots[i]];
      const top = ANCHOR + BOX.dy;
      drawBox(ctx, bg, x, top);
      const cx = x + BOX.w / 2;
      const inner = BOX.w - 2 * BOX.inset;
      const raw = await loadImage(qrs[i].b64, "image/png");
      const img = ctx.__ink ? inkImage(raw) : raw;
      if (k === 1) {
        const cap = "للاستماع للمتن:";
        text(ctx, cap, cx, top + 18.3, fit(ctx, cap, inner, 14, 9, true), true);
        if (img) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, cx - PIC1.w / 2, ANCHOR + PIC1.dy, PIC1.w, PIC1.h);
        }
      } else {
        const lines = ["للاستماع إلى", `${qrs[i].name}:`];
        const size = Math.min(...lines.map((l) => fit(ctx, l, inner, 9, 6.5, true)));
        text(ctx, lines[0], cx, top + 10.7, size, true);
        text(ctx, lines[1], cx, top + 10.7 + size * 1.533, size, true);
        if (img) {
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, cx - PICN.w / 2, ANCHOR + PICN.dy, PICN.w, PICN.h);
        }
      }
      ctx.imageSmoothingEnabled = true;
    }
    // منطقة النص: بين الصناديق، وفي رأس فيه رمز واحد ما لا يبلغ صندوقه
    const nR = slots.filter((s) => s[0] === "r").length;
    const nL = slots.length - nR;
    const gap = 5;
    let title;
    let line;
    if (k <= 1) {
      const right = k ? SLOT_X.r1 - gap : COL_R;
      title = { cx: 306, w: 2 * Math.min(right - 306, 306 - COL_L) };
      line = { cx: 291, w: 2 * Math.min(right - 291, 291 - COL_L) };
    } else {
      const l = COL_L + nL * SLOT_PT;
      const r = COL_R - nR * SLOT_PT;
      title = line = { cx: (l + r) / 2, w: r - l - 2 };
    }
    // العنوان: سطر واحد ما أمكن، وإلا سطران
    const tMax = k <= 1 ? 18 : 14;
    let tSize = fit(ctx, sheet.title, title.w, tMax, 6, true);
    let tLines = [sheet.title];
    if (tSize < (k <= 1 ? 13 : 12)) {
      tSize = Math.min(k <= 1 ? 16 : 14, fit(ctx, sheet.title, title.w * 1.85, tMax, 8, true));
      tLines = wrap(ctx, sheet.title, title.w, tSize, true);
      while (tLines.length > 2 && tSize > 7) tLines = wrap(ctx, sheet.title, title.w, (tSize -= 0.5), true);
    }
    let top = ANCHOR;
    for (const l of tLines) {
      text(ctx, l, title.cx, top + BASE * tSize, tSize, true);
      top += LINE * tSize;
    }
    // سطر الطالب والحلقة
    const dots = (n) => ".".repeat(n);
    const [d1, d2] = k <= 1 ? [31, 20] : k === 2 ? [22, 12] : [16, 10];
    const studentLine = `اسم الطالب: ${opts.student || dots(d1)}، الحلقة: ${opts.halaqa || dots(d2)}`;
    let sSize = fit(ctx, studentLine, line.w, 18, 6, true);
    let sLines = [studentLine];
    if (sSize < 11) {
      sSize = Math.min(12, fit(ctx, studentLine, line.w * 1.85, 18, 8, true));
      sLines = wrap(ctx, studentLine, line.w, sSize, true);
    }
    for (const l of sLines) {
      text(ctx, l, line.cx, top + BASE * sSize, sSize, true);
      top += LINE * sSize;
    }
    // سطر المدة: العنوان بخط عريض والتاريخان بخط عادي
    const label = "مدّة المستوى:";
    const value = opts.duration ? " " + opts.duration : "  /    /..١٤٤ ه -   /    /..١٤٤ ه.";
    const dW = measure(ctx, label, 18, true) + measure(ctx, value, 18, false);
    const dSize = dW <= line.w ? 18 : Math.max(7, Math.floor(((18 * line.w) / dW) * 4) / 4);
    segments(ctx, [{ t: label, b: true }, { t: value, b: false }], line.cx, top + BASE * dSize, dSize);
    top += LINE * dSize;
    return top;
  }

  /* ---------- الجدول ---------- */
  function hline(ctx, x1, x2, y, w) {
    ctx.fillStyle = "#000";
    ctx.fillRect(Math.min(x1, x2) - 0.72, y - w / 2, Math.abs(x2 - x1) + 1.44, w);
  }
  function vline(ctx, x, y1, y2, w) {
    ctx.fillStyle = "#000";
    ctx.fillRect(x - w / 2, y1, w, y2 - y1);
  }
  const colMid = (c) => (X[c] + X[c + 1]) / 2;
  const colW = (c) => X[c] - X[c + 1];
  function circle(ctx, cx, cy) {
    ctx.strokeStyle = "#000";
    ctx.beginPath();
    ctx.lineWidth = 0.85;
    ctx.arc(cx, cy, 5.3, 0, Math.PI * 2);
    ctx.stroke();
    // ظل الدائرة في رمز Wingdings
    ctx.beginPath();
    ctx.lineWidth = 1.7;
    ctx.arc(cx + 0.55, cy + 0.2, 5.55, -Math.PI * 0.42, Math.PI * 0.42);
    ctx.stroke();
  }
  function cellText(ctx, str, c, cy, max = 18) {
    if (!str) return;
    const size = fit(ctx, str, colW(c) * 0.92, max, 6, false);
    text(ctx, str, colMid(c), cy + 0.3 * size, size, false);
  }
  function noteText(ctx, str, cy) {
    if (!str) return;
    const width = colW(COL.note) * 0.9;
    for (let size = 12; size >= 6; size -= 0.5) {
      const lines = wrap(ctx, str, width, size, false);
      const lh = size * 1.15;
      const tooWide = lines.some((l) => measure(ctx, l, size, false) > width);
      if ((lines.length * lh <= ROW - 1.5 && !tooWide) || size <= 6) {
        let y = cy - ((lines.length - 1) * lh) / 2 + 0.3 * size;
        for (const l of lines) {
          text(ctx, l, colMid(COL.note), y, size, false);
          y += lh;
        }
        return;
      }
    }
  }
  function drawTable(ctx, bg, top, rows) {
    const yH = top + HEAD1 + HEAD2;
    const yEnd = yH + rows.length * ROW;
    // تظليل الرأس
    bg.fillStyle = GRAY;
    bg.fillRect(X[10], top, X[0] - X[10], HEAD1 + HEAD2);
    // نصوص الرأس
    text(ctx, "اليوم", (X[0] + X[2]) / 2, top + 20.1, 18, true);
    text(ctx, "التاريخ", (X[0] + X[2]) / 2, top + 47.7, 18, true);
    text(ctx, "المقادير", (X[2] + X[8]) / 2, top + 19.9, 18, true);
    const sub = [["الحفظ", 2], ["أتم؟", 3], ["الربط", 4], ["أتم؟", 5], ["م. الكبرى", 6], ["أتم؟", 7]];
    for (const [t, c] of sub) text(ctx, t, colMid(c), top + 48.0, Math.min(18, fit(ctx, t, colW(c) * 0.94, 18, 10, true)), true);
    text(ctx, "ملاحظات", colMid(COL.note), top + 33.9, fit(ctx, "ملاحظات", colW(COL.note) * 0.96, 18, 10, true), true);
    ctx.save();
    ctx.translate(colMid(COL.listen), top + (HEAD1 + HEAD2) / 2);
    ctx.rotate(-Math.PI / 2);
    text(ctx, "استماع", 0, 6, fit(ctx, "استماع", HEAD1 + HEAD2 - 6, 18, 10, true), true);
    ctx.restore();
    // الخطوط الأفقية
    hline(ctx, X[10], X[0], top, THICK);
    hline(ctx, X[8], X[2], top + HEAD1, THIN);
    hline(ctx, X[10], X[0], yH, THICK);
    for (let i = 1; i <= rows.length; i++) hline(ctx, X[10], X[0], yH + i * ROW, i % 2 === 0 || i === rows.length ? THICK : THIN);
    // الخطوط الرأسية: في الرأس الأعمدة المدموجة، وفي الصفوف كلها
    for (const c of [0, 2, 8, 9, 10]) vline(ctx, X[c], top, top + HEAD1, VLINE[c]);
    for (const c of [0, 2, 3, 4, 5, 6, 7, 8, 9, 10]) vline(ctx, X[c], top + HEAD1, yH, VLINE[c]);
    for (let c = 0; c <= 10; c++) vline(ctx, X[c], yH, yEnd, VLINE[c]);
    // الصفوف
    rows.forEach((r, i) => {
      const cy = yH + (i + 0.5) * ROW;
      cellText(ctx, r.day, COL.day, cy, 14);
      cellText(ctx, r.date || "/", COL.date, cy);
      cellText(ctx, r.memo, COL.memo, cy);
      cellText(ctx, r.link, COL.link, cy);
      cellText(ctx, r.big, COL.big, cy);
      circle(ctx, colMid(COL.listen), cy);
      noteText(ctx, r.note, cy);
    });
    return yEnd;
  }

  /* ---------- الصفحة ---------- */
  function prepare(canvas, scale, fill, ink = false) {
    const ctx = canvas.getContext("2d");
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (fill) {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    } else ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.__scale = scale;
    ctx.__ink = ink;
    try {
      ctx.direction = "rtl";
    } catch (e) {
      /* المتصفح يأخذ الاتجاه من اللوحة */
    }
    return ctx;
  }
  // ink: لوحة النصوص والخطوط (أسود)، وbg: لوحة الألوان؛ وقد تكونان لوحة واحدة
  async function drawPage(ink, bg, sheet, rows, opts, pageNo) {
    if (opts.watermarkB64) {
      const wm = await loadImage(opts.watermarkB64, "image/jpeg");
      if (wm) bg.drawImage(wm, WM.x, WM.y, WM.w, WM.h);
    }
    const top = await drawHeader(ink, bg, sheet, opts);
    drawTable(ink, bg, top, rows);
    text(ink, opts.digits ? opts.digits(pageNo) : String(pageNo), FOOT.x, FOOT.base, 18, false);
  }

  /* ---------- ملف PDF من طبقتي الصفحة ---------- */
  const enc = new TextEncoder();
  function utf16Hex(s) {
    let h = "FEFF";
    for (const ch of String(s)) {
      const cp = ch.codePointAt(0);
      if (cp > 0xffff) {
        const v = cp - 0x10000;
        h += (0xd800 + (v >> 10)).toString(16).padStart(4, "0") + (0xdc00 + (v & 0x3ff)).toString(16).padStart(4, "0");
      } else h += cp.toString(16).padStart(4, "0");
    }
    return `<${h.toUpperCase()}>`;
  }
  function makePdf(pages, info) {
    const chunks = [];
    const offsets = [];
    let pos = 0;
    const push = (x) => {
      const b = typeof x === "string" ? enc.encode(x) : x;
      chunks.push(b);
      pos += b.length;
    };
    const obj = (n, body) => {
      offsets[n] = pos;
      push(`${n} 0 obj\n`);
      for (const part of body) push(part);
      push("\nendobj\n");
    };
    push("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
    const n = pages.length;
    const pageIds = [];
    let k = 4;
    for (const p of pages) {
      pageIds.push(k);
      k += p.ink ? 4 : 3;
    }
    obj(1, ["<< /Type /Catalog /Pages 2 0 R >>"]);
    obj(2, [`<< /Type /Pages /Kids [${pageIds.map((id) => id + " 0 R").join(" ")}] /Count ${n} >>`]);
    obj(3, [`<< /Title ${utf16Hex(info.title || "")} /Producer ${utf16Hex(info.producer || "")} /Creator ${utf16Hex(info.producer || "")} >>`]);
    // لكل صفحة: الصفحة، ومحتواها، ثم صورها (طبقة الألوان JPEG، وطبقة الحبر قناعاً أحادي اللون)
    let next = 4;
    const ids = pages.map((p) => {
      const r = { page: next, content: next + 1, bg: next + 2, ink: p.ink ? next + 3 : 0 };
      next += p.ink ? 4 : 3;
      return r;
    });
    pages.forEach((p, i) => {
      const r = ids[i];
      const full = `${PAGE_W} 0 0 ${PAGE_H} 0 0 cm`;
      const content = `q ${full} /Bg Do Q` + (p.ink ? `\nq 0 g ${full} /Ink Do Q` : "");
      const xo = `/Bg ${r.bg} 0 R` + (p.ink ? ` /Ink ${r.ink} 0 R` : "");
      obj(r.page, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Resources << /XObject << ${xo} >> /ProcSet [/PDF /ImageB /ImageC] >> /Contents ${r.content} 0 R >>`]);
      obj(r.content, [`<< /Length ${content.length} >>\nstream\n${content}\nendstream`]);
      obj(r.bg, [
        `<< /Type /XObject /Subtype /Image /Width ${p.bg.w} /Height ${p.bg.h} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.bg.bytes.length} >>\nstream\n`,
        p.bg.bytes,
        "\nendstream",
      ]);
      if (p.ink) {
        obj(r.ink, [
          `<< /Type /XObject /Subtype /Image /Width ${p.ink.w} /Height ${p.ink.h} /ImageMask true /BitsPerComponent 1 /Filter /FlateDecode /Length ${p.ink.bytes.length} >>\nstream\n`,
          p.ink.bytes,
          "\nendstream",
        ]);
      }
    });
    const size = next;
    const xref = pos;
    let table = `xref\n0 ${size}\n0000000000 65535 f \n`;
    for (let i = 1; i < size; i++) table += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
    push(table);
    push(`trailer\n<< /Size ${size} /Root 1 0 R /Info 3 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    return new Blob(chunks, { type: "application/pdf" });
  }
  function canvasJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      if (canvas.toBlob) {
        canvas.toBlob(
          async (b) => (b ? resolve(new Uint8Array(await b.arrayBuffer())) : reject(new Error("تعذّر رسم الصفحة"))),
          "image/jpeg",
          quality
        );
      } else {
        const url = canvas.toDataURL("image/jpeg", quality);
        resolve(bytesOf(url.slice(url.indexOf(",") + 1)));
      }
    });
  }

  // طبقة الحبر: كل بكسل معتم (أكثر من النصف) نقطة سوداء، في قناع أحادي اللون مضغوط
  async function inkMask(canvas) {
    const w = canvas.width;
    const h = canvas.height;
    const data = canvas.getContext("2d").getImageData(0, 0, w, h).data;
    const rowBytes = (w + 7) >> 3;
    const out = new Uint8Array(rowBytes * h).fill(255);
    for (let y = 0; y < h; y++) {
      let i = y * w * 4 + 3;
      const row = y * rowBytes;
      for (let x = 0; x < w; x++, i += 4) {
        if (data[i] >= 128) out[row + (x >> 3)] &= ~(0x80 >> (x & 7));
      }
    }
    const stream = new Blob([out]).stream().pipeThrough(new CompressionStream("deflate"));
    return { bytes: new Uint8Array(await new Response(stream).arrayBuffer()), w, h };
  }
  function makeCanvas(scale) {
    const c = document.createElement("canvas");
    c.width = Math.round(PAGE_W * scale);
    c.height = Math.round(PAGE_H * scale);
    c.setAttribute("dir", "rtl");
    c.style.cssText = "position:fixed;left:-99999px;top:0;width:10px;height:10px;direction:rtl";
    document.body.appendChild(c);
    return c;
  }

  /* opts: { rows:[{memo,link,big,note,day,date}] (نصوص العرض), sheets:[{title, qrs:[{b64,name}]}],
             student?, halaqa?, duration?, watermarkB64?, digits?(n), title?, producer? } → Blob */
  async function build(opts) {
    await loadFonts();
    const layered = typeof CompressionStream === "function" && !opts.flat;
    const canvases = layered ? [makeCanvas(INK_SCALE), makeCanvas(BG_SCALE)] : [makeCanvas(JPEG_SCALE)];
    try {
      const pages = [];
      const total = Math.ceil(opts.rows.length / ROWS);
      for (let s = 0; s < total; s++) {
        const sheet = (opts.sheets && opts.sheets[s]) || { title: opts.title || "", qrs: [] };
        const rows = opts.rows.slice(s * ROWS, (s + 1) * ROWS);
        if (layered) {
          const ink = prepare(canvases[0], INK_SCALE, false, true);
          const bg = prepare(canvases[1], BG_SCALE, true);
          await drawPage(ink, bg, sheet, rows, opts, s + 1);
          const mask = await inkMask(canvases[0]);
          pages.push({ ink: mask, bg: { bytes: await canvasJpeg(canvases[1], 0.85), w: canvases[1].width, h: canvases[1].height } });
        } else {
          const ctx = prepare(canvases[0], JPEG_SCALE, true);
          await drawPage(ctx, ctx, sheet, rows, opts, s + 1);
          pages.push({ bg: { bytes: await canvasJpeg(canvases[0], 0.88), w: canvases[0].width, h: canvases[0].height } });
        }
        if (opts.onProgress) opts.onProgress(s + 1, total);
      }
      return makePdf(pages, { title: opts.title || "", producer: opts.producer || "" });
    } finally {
      canvases.forEach((c) => c.remove());
    }
  }

  return { build, ROWS_PER_PAGE: ROWS };
})();

