
/* ===== تصدير الخطة إلى ملف وورد على القالب =====
   يفتح قالب المستخدم، وينسخ كتلة الصفحة الأولى (العنوان، اسم الطالب، المدة، الجدول)
   لكل ٢٢ يوماً، ويملأ الخانات بخط Traditional Arabic، ويضع رمز الاستماع الخاص بالمتن. */
const DocxBuilder = (() => {
  const W = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
  const WP = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing";
  const W14 = "http://schemas.microsoft.com/office/word/2010/wordml";
  const WP14 = "http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing";
  const VML = "urn:schemas-microsoft-com:vml";
  const OFFICE = "urn:schemas-microsoft-com:office:office";
  const MC = "http://schemas.openxmlformats.org/markup-compatibility/2006";
  const XML_NS = "http://www.w3.org/XML/1998/namespace";
  const R_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const A_NS = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const PIC_NS = "http://schemas.openxmlformats.org/drawingml/2006/picture";
  const ROWS_PER_SHEET = 22;
  const HEADER_ROWS = 2;
  const COL = { day: 0, date: 1, memo: 2, link: 4, big: 6, note: 9 };

  const kids = (el) => Array.from(el.childNodes).filter((n) => n.nodeType === 1);
  const isW = (el, name) => el.namespaceURI === W && el.localName === name;
  const textRuns = (p) => kids(p).filter((n) => isW(n, "r") && kids(n).some((c) => isW(c, "t")));
  const runText = (r) => kids(r).find((c) => isW(c, "t"));

  /* ---------- مقاسات الخط: كل الخطة في صفحة واحدة ----------
     عرض الحروف بخط Traditional Arabic (بوحدة em) كما قيس في ملفات PDF التي صدّرها وورد من خططك،
     فيُختار لكل خانة وسطر أكبر خط يبقى به النص في سطر واحد، ولا يطول الصف فتزيد الصفحة. */
  const EM = { " ": 0.244, ".": 0.278, "/": 0.278, ":": 0.278, "،": 0.278, "؛": 0.278, "-": 0.462, "+": 0.462, "–": 0.5, "ه": 0.476, "(": 0.333, ")": 0.333, "؟": 0.314 };
  function emWidth(text, bold) {
    let w = 0;
    for (const ch of String(text)) {
      if (/[0-9\u0660-\u0669]/.test(ch)) w += bold ? 0.519 : 0.462;
      else if (ch in EM) w += EM[ch];
      else if (/[\u0610-\u061a\u064b-\u065f\u0670\u06d6-\u06ed\u200b-\u200f\u061c]/.test(ch)) continue;
      else if (/[\u0600-\u06ff]/.test(ch)) w += 0.34;
      else w += 0.55;
    }
    return w;
  }
  // عرض الخانات بالنقاط (من أعمدة القالب)، ونسبة ما يُشغل منها
  const CELL_PT = { day: 49.2, date: 42.35, memo: 70.9, link: 73.25, big: 68.5, note: 56.9 };
  const CELL_FILL = 0.95;
  const fitHalfPts = (em, widthPt, max, min) => (em ? Math.max(min, Math.min(max, Math.floor((2 * widthPt) / em))) : max);
  // ارتفاع صفوف الأيام ثابت كما في القالب (نحو ٠٫٩٥ سم)، فلا يطول صف بطول ما فيه؛
  // فصفحة القالب لا يبقى فيها بعد ٢٢ صفاً إلا القليل قبل رقم الصفحة في التذييل
  const ROW_TWIPS = 538;
  const ARROW_PT = 10; // سهم Wingdings بحجم ١١

  function el(doc, name, attrs) {
    const e = doc.createElementNS(W, "w:" + name);
    if (attrs) for (const [k, v] of Object.entries(attrs)) e.setAttributeNS(W, "w:" + k, v);
    return e;
  }

  function setText(t, text) {
    t.textContent = text;
    t.setAttributeNS(XML_NS, "xml:space", "preserve");
  }

  function makeRun(doc, text, size) {
    const r = el(doc, "r");
    const rPr = el(doc, "rPr");
    rPr.appendChild(el(doc, "rFonts", { ascii: "Traditional Arabic", hAnsi: "Traditional Arabic", cs: "Traditional Arabic", hint: "cs" }));
    rPr.appendChild(el(doc, "sz", { val: String(size) }));
    rPr.appendChild(el(doc, "szCs", { val: String(size) }));
    rPr.appendChild(el(doc, "rtl"));
    r.appendChild(rPr);
    const t = el(doc, "t");
    setText(t, text);
    r.appendChild(t);
    return r;
  }

  function makeArrowRun(doc) {
    const r = el(doc, "r");
    const rPr = el(doc, "rPr");
    rPr.appendChild(el(doc, "rFonts", { ascii: "Traditional Arabic", hAnsi: "Traditional Arabic", cs: "Traditional Arabic", hint: "cs" }));
    rPr.appendChild(el(doc, "sz", { val: "22" }));
    rPr.appendChild(el(doc, "szCs", { val: "22" }));
    r.appendChild(rPr);
    r.appendChild(el(doc, "sym", { font: "Wingdings", char: "F0DB" }));
    return r;
  }
  function setCellText(doc, tc, text, col, max = 36) {
    const p = kids(tc).find((n) => isW(n, "p"));
    if (!p) return;
    for (const n of kids(p)) if (!isW(n, "pPr")) p.removeChild(n);
    if (!text) return;
    const width = CELL_PT[col] * CELL_FILL;
    if (text.includes("←")) {
      const [a, b] = text.split("←");
      const size = fitHalfPts(emWidth(a) + emWidth(b), width - ARROW_PT, 28, 16);
      p.appendChild(makeRun(doc, a, size));
      p.appendChild(makeArrowRun(doc));
      p.appendChild(makeRun(doc, b, size));
      return;
    }
    // أسماء الأيام عربية: هامش أوسع لتقدير عرض الحروف
    const em = emWidth(text) * (/[\u0621-\u064a]/.test(text) ? 1.08 : 1);
    p.appendChild(makeRun(doc, text, fitHalfPts(em, width, max, 16)));
  }

  // الملاحظات: خانة ضيقة (نحو ٢ سم)، فيصغر الخط مع طول الاسم حتى تسع أسطرُه ارتفاع الصف،
  // وتثبت المسافة بين الأسطر، ويُصغَّر رمز الفقرة معه.
  const noteLine = (size) => Math.round(size * 11.5);
  function noteLines(text, size) {
    const max = CELL_PT.note * 0.9;
    const sp = (emWidth(" ") * size) / 2;
    let lines = 1;
    let x = 0;
    for (const word of String(text).split(/\s+/).filter(Boolean)) {
      const w = (emWidth(word) * 1.08 * size) / 2;
      if (w > max) return Infinity; // كلمة لا تسعها الخانة
      if (x && x + sp + w > max) {
        lines++;
        x = w;
      } else x += (x ? sp : 0) + w;
    }
    return lines;
  }
  function noteSize(text) {
    for (let size = 24; size > 14; size -= 2) {
      if (noteLines(text, size) * noteLine(size) <= ROW_TWIPS - 20) return size;
    }
    return 14;
  }
  function setNoteText(doc, tc, text) {
    const p = kids(tc).find((n) => isW(n, "p"));
    if (!p || !text) return;
    const size = noteSize(text);
    for (const n of kids(p)) if (!isW(n, "pPr")) p.removeChild(n);
    let pPr = kids(p).find((n) => isW(n, "pPr"));
    if (!pPr) {
      pPr = el(doc, "pPr");
      p.insertBefore(pPr, p.firstChild);
    }
    for (const c of kids(pPr)) if (isW(c, "spacing")) pPr.removeChild(c);
    const after = kids(pPr).find((c) => isW(c, "ind") || isW(c, "jc") || isW(c, "rPr")) || null;
    pPr.insertBefore(el(doc, "spacing", { before: "0", after: "0", line: String(noteLine(size)), lineRule: "exact" }), after);
    const markPr = kids(pPr).find((c) => isW(c, "rPr"));
    if (markPr) for (const c of kids(markPr)) if (isW(c, "sz") || isW(c, "szCs")) c.setAttributeNS(W, "w:val", String(size));
    p.appendChild(makeRun(doc, text, size));
  }

  function setFontSize(run, size) {
    const rPr = kids(run).find((c) => isW(c, "rPr"));
    if (rPr) for (const c of kids(rPr)) if (isW(c, "sz") || isW(c, "szCs")) c.setAttributeNS(W, "w:val", String(size));
  }

  function setTitle(p, title) {
    const runs = textRuns(p);
    if (!runs.length) throw new Error("لم أجد عنوان الصفحة في القالب");
    setText(runText(runs[0]), title);
    runs.slice(1).forEach((r) => p.removeChild(r));
  }

  function removeQr(p) {
    for (const r of kids(p)) {
      if (!isW(r, "r")) continue;
      const hasDrawing = kids(r).some((c) => isW(c, "drawing") || (c.namespaceURI === MC && c.localName === "AlternateContent"));
      if (hasDrawing) p.removeChild(r);
    }
  }

  // مواضع صناديق الاستماع (EMU) من القالب: الصندوق ثم صورة الرمز فوقه
  const BOX = { x: 5821680, w: 1012190 };
  const PIC = { x: 5988685, y: 230505, w: 670560, h: 692727 };
  const COL_W = 6931025;
  const GAP = 50800;
  const L1 = COL_W - BOX.x - BOX.w;
  const SLOT_X = { r1: BOX.x, r2: BOX.x - BOX.w - GAP, l1: L1, l2: L1 + BOX.w + GAP };
  const SLOTS = { 1: ["r1"], 2: ["r1", "l1"], 3: ["r1", "l2", "l1"], 4: ["r1", "r2", "l2", "l1"] };
  const MULTI_PIC = 0.82; // صورة أصغر قليلاً تحت عنوان من سطرين
  const MULTI_PIC_Y = 362000;
  const CAPTION_SIZE = 18;

  const descendants = (node, ns, name) => Array.from(node.getElementsByTagNameNS(ns, name));
  function setPosOffset(anchor, axis, value) {
    const pos = descendants(anchor, WP, axis === "h" ? "positionH" : "positionV")[0];
    const off = pos && descendants(pos, WP, "posOffset")[0];
    if (off) off.textContent = String(Math.round(value));
  }
  // عنوان الصندوق في سطرين كالخطط الجاهزة: «للاستماع إلى» ثم اسم المتن
  function setCaption(boxRun, lines, size) {
    for (const tx of descendants(boxRun, W, "txbxContent")) {
      const p = descendants(tx, W, "p")[0];
      if (!p) continue;
      const runs = textRuns(p);
      if (!runs.length) continue;
      setText(runText(runs[0]), lines[0]);
      runs.slice(1).forEach((r) => p.removeChild(r));
      let prev = runs[0];
      for (const line of lines.slice(1)) {
        const r = runs[0].cloneNode(true);
        const t = runText(r);
        r.insertBefore(r.ownerDocument.createElementNS(W, "w:br"), t);
        setText(t, line);
        p.insertBefore(r, prev.nextSibling);
        prev = r;
      }
      if (size) {
        for (const c of descendants(p, W, "sz").concat(descendants(p, W, "szCs"))) c.setAttributeNS(W, "w:val", String(size));
      }
      // تباعد مفرد بين سطري العنوان كي لا يبلغ الثاني صورة الرمز
      const pPr = kids(p).find((n) => isW(n, "pPr"));
      if (pPr) {
        for (const c of kids(pPr)) if (isW(c, "spacing")) pPr.removeChild(c);
        const at = kids(pPr).find((c) => !isW(c, "pStyle") && !isW(c, "keepNext") && !isW(c, "keepLines") && !isW(c, "pageBreakBefore") && !isW(c, "framePr") && !isW(c, "widowControl") && !isW(c, "numPr") && !isW(c, "suppressLineNumbers") && !isW(c, "pBdr") && !isW(c, "shd") && !isW(c, "tabs") && !isW(c, "suppressAutoHyphens") && !isW(c, "kinsoku") && !isW(c, "wordWrap") && !isW(c, "overflowPunct") && !isW(c, "topLinePunct") && !isW(c, "autoSpaceDE") && !isW(c, "autoSpaceDN") && !isW(c, "bidi") && !isW(c, "adjustRightInd") && !isW(c, "snapToGrid")) || null;
        pPr.insertBefore(el(p.ownerDocument, "spacing", { after: "0", line: "240", lineRule: "auto" }), at);
      }
    }
  }
  function placeBox(boxRun, x) {
    const choice = descendants(boxRun, WP, "anchor")[0];
    if (choice) setPosOffset(choice, "h", x);
    // نسخة VML البديلة للبرامج القديمة
    for (const shape of descendants(boxRun, VML, "shape")) {
      const st = shape.getAttribute("style") || "";
      shape.setAttribute("style", st.replace(/margin-left:[-\d.]+pt/, `margin-left:${(x / 12700).toFixed(1)}pt`));
    }
  }
  function placePicture(picRun, x, y, scale, relId) {
    const anchor = descendants(picRun, WP, "anchor")[0];
    if (!anchor) return;
    const w = Math.round(PIC.w * scale);
    const h = Math.round(PIC.h * scale);
    setPosOffset(anchor, "h", x + (BOX.w - w) / 2);
    setPosOffset(anchor, "v", y);
    for (const ext of descendants(anchor, WP, "extent").concat(descendants(anchor, A_NS, "ext").filter((e) => e.hasAttribute("cx")))) {
      ext.setAttribute("cx", String(w));
      ext.setAttribute("cy", String(h));
    }
    for (const blip of descendants(anchor, A_NS, "blip")) blip.setAttributeNS(R_NS, "r:embed", relId);
  }
  // يضع رموز الاستماع لمتون الصفحة، ويُبعد العنوان والسطرين عن الصناديق
  function setQrs(doc, block, qrs, relOf) {
    const p = block[0];
    const runs = kids(p).filter((r) => isW(r, "r"));
    const picRun = runs.find((r) => kids(r).some((c) => isW(c, "drawing")));
    const boxRun = runs.find((r) => kids(r).some((c) => c.namespaceURI === MC && c.localName === "AlternateContent"));
    const k = Math.min(qrs.length, 4);
    if (!k || !picRun || !boxRun) {
      removeQr(p);
      return;
    }
    if (k === 1) {
      placePicture(picRun, BOX.x, PIC.y, 1, relOf(qrs[0].b64));
      return;
    }
    const slots = SLOTS[k];
    for (let i = k - 1; i >= 0; i--) {
      const pr = i === 0 ? picRun : picRun.cloneNode(true);
      const br = i === 0 ? boxRun : boxRun.cloneNode(true);
      const x = SLOT_X[slots[i]];
      placeBox(br, x);
      setCaption(br, ["للاستماع إلى", `${qrs[i].name}:`], CAPTION_SIZE);
      placePicture(pr, x, MULTI_PIC_Y, MULTI_PIC, relOf(qrs[i].b64));
      if (i > 0) {
        p.insertBefore(br, boxRun.nextSibling);
        p.insertBefore(pr, boxRun.nextSibling);
      }
    }
    // رأس أضيق كما في الخطط الجاهزة: نقاط أقصر في سطر الطالب (ويصغر الخط في fitHeader)
    const sRuns = textRuns(block[1]);
    const dots = (r, n) => {
      const t = r && runText(r);
      if (t && /^\s*\.+\s*$/.test(t.textContent)) setText(t, (t.textContent.startsWith(" ") ? " " : "") + ".".repeat(n));
    };
    dots(sRuns[1], k >= 3 ? 16 : 22);
    dots(sRuns[sRuns.length - 1], k >= 3 ? 10 : 12);
    // هامش يمين ويسار للعنوان والسطرين بقدر الصناديق في كل جهة
    // (في الفقرة العربية: left = جهة البداية اليمنى، right = اليسرى)
    const per = Math.round((BOX.w + GAP) / 635) + 40;
    const nR = slots.filter((x) => x[0] === "r").length;
    const nL = slots.length - nR;
    for (const para of block.slice(0, 3)) {
      let pPr = kids(para).find((n) => isW(n, "pPr"));
      if (!pPr) {
        pPr = el(doc, "pPr");
        para.insertBefore(pPr, para.firstChild);
      }
      for (const c of kids(pPr)) if (isW(c, "ind")) pPr.removeChild(c);
      const after = kids(pPr).find((c) => ["contextualSpacing", "mirrorIndents", "suppressOverlap", "jc", "textDirection", "textAlignment", "textboxTightWrap", "outlineLvl", "divId", "cnfStyle", "rPr", "sectPr", "pPrChange"].some((n) => isW(c, n))) || null;
      pPr.insertBefore(el(doc, "ind", { left: String(nR * per), right: String(nL * per) }), after);
    }
  }

  // العنوان وسطر الطالب وسطر المدة: كل منها في سطر واحد لا يبلغ صناديق الاستماع
  // (العنوان في رأس فيه أكثر من رمز يجوز أن يكون في سطرين، كما في الخطط الجاهزة)
  const TEXT_PT = (11906 - 282 - 709) / 20;
  const BOX_PT = Math.round((BOX.w + GAP) / 635 + 40) / 20;
  function runBold(r) {
    const rPr = kids(r).find((c) => isW(c, "rPr"));
    return !!rPr && kids(rPr).some((c) => isW(c, "b"));
  }
  function runSize(r) {
    const rPr = kids(r).find((c) => isW(c, "rPr"));
    const sz = rPr && kids(rPr).find((c) => isW(c, "sz"));
    return sz ? parseInt(sz.getAttributeNS(W, "val") || sz.getAttribute("w:val"), 10) || 36 : 36;
  }
  function paraEm(p) {
    return textRuns(p).reduce((a, r) => a + emWidth(runText(r).textContent, runBold(r)), 0);
  }
  function setParaSize(p, size) {
    for (const r of textRuns(p)) setFontSize(r, size);
    const pPr = kids(p).find((n) => isW(n, "pPr"));
    const mark = pPr && kids(pPr).find((c) => isW(c, "rPr"));
    if (mark) for (const c of kids(mark)) if (isW(c, "sz") || isW(c, "szCs")) c.setAttributeNS(W, "w:val", String(size));
  }
  function fitHeader(block, k) {
    // عرض المتاح: مع رمز واحد ما لا يبلغ صندوقه (كعرض سطر الطالب في القالب)، ومع أكثر ما بين الصناديق
    const lineW = k <= 1 ? 385 : (TEXT_PT - k * BOX_PT) * 0.95;
    const titleW = k <= 1 ? 352 : lineW;
    const [title, student, duration] = block;
    const tEm = paraEm(title);
    const tMax = k <= 1 ? 36 : 28;
    let size = fitHalfPts(tEm, titleW, tMax, 10);
    if (size < (k <= 1 ? 26 : 24)) size = fitHalfPts(tEm, titleW * 2 * 0.88, k <= 1 ? 32 : 28, 18); // سطران
    setParaSize(title, size);
    // سطر الطالب والمدة: سطر واحد، فإن صغر خطه كثيراً (اسم طويل بين الصناديق) فسطران
    for (const p of [student, duration]) {
      const max = Math.max(...textRuns(p).map(runSize));
      const em = paraEm(p);
      let s = fitHalfPts(em, lineW, max, 10);
      if (s < 22) s = fitHalfPts(em, lineW * 2 * 0.88, Math.min(max, 24), 16);
      setParaSize(p, s);
    }
  }

  // «اسم الطالب: ....، الحلقة: ....» ← اسم الطالب واسم الحلقة
  function setHalaqa(p, name) {
    const runs = textRuns(p);
    if (name && runs.length) setText(runText(runs[runs.length - 1]), name);
  }
  function setStudent(p, name) {
    const runs = textRuns(p);
    if (name && runs.length > 1) setText(runText(runs[1]), " " + name);
  }

  // «مدّة المستوى: / /..144 ه - / /..144 ه.» ← التاريخان
  function setDuration(p, text) {
    const runs = textRuns(p);
    if (runs.length < 2) return;
    const value = runs[runs.length - 1];
    setText(runText(value), " " + text);
    runs.slice(1, -1).forEach((r) => p.removeChild(r));
  }

  function fixRowHeight(doc, tr) {
    let trPr = kids(tr).find((n) => isW(n, "trPr"));
    if (!trPr) {
      trPr = el(doc, "trPr");
      tr.insertBefore(trPr, tr.firstChild);
    }
    let h = kids(trPr).find((n) => isW(n, "trHeight"));
    if (!h) {
      h = el(doc, "trHeight");
      const jc = kids(trPr).find((n) => isW(n, "jc")) || null;
      trPr.insertBefore(h, jc);
    }
    h.setAttributeNS(W, "w:val", String(ROW_TWIPS));
    h.setAttributeNS(W, "w:hRule", "exact");
  }

  function fillTable(doc, tbl, rows) {
    const data = kids(tbl).filter((n) => isW(n, "tr")).slice(HEADER_ROWS);
    if (rows.length > data.length) throw new Error("صفوف الجدول في القالب أقل من المطلوب");
    // صف واحد: نستعمل صفاً أوسط من القالب ليحمل الحد السفلي العريض
    if (rows.length === 1 && data.length > 1) tbl.removeChild(data.shift());
    for (let i = rows.length; i < data.length; i++) tbl.removeChild(data[i]);
    rows.forEach((row, i) => {
      fixRowHeight(doc, data[i]);
      const tcs = kids(data[i]).filter((n) => isW(n, "tc"));
      setCellText(doc, tcs[COL.memo], row.memo, "memo");
      setCellText(doc, tcs[COL.link], row.link, "link");
      setCellText(doc, tcs[COL.big], row.big, "big");
      if (row.day) setCellText(doc, tcs[COL.day], row.day, "day", 28);
      if (row.date) setCellText(doc, tcs[COL.date], row.date, "date");
      if (row.note) setNoteText(doc, tcs[COL.note], row.note);
    });
  }

  // فقرة الختام الفارغة: تُصغَّر كي لا تدفع صفحة فارغة بعد جدول ممتلئ
  function shrinkTrailing(doc, p) {
    let pPr = kids(p).find((n) => isW(n, "pPr"));
    if (!pPr) {
      pPr = el(doc, "pPr");
      p.insertBefore(pPr, p.firstChild);
    }
    for (const c of kids(pPr)) if (isW(c, "spacing")) pPr.removeChild(c);
    pPr.insertBefore(el(doc, "spacing", { before: "0", after: "0", line: "20", lineRule: "exact" }), pPr.firstChild);
    let rPr = kids(pPr).find((n) => isW(n, "rPr"));
    if (!rPr) {
      rPr = el(doc, "rPr");
      pPr.appendChild(rPr);
    }
    for (const c of kids(rPr)) if (isW(c, "sz") || isW(c, "szCs")) rPr.removeChild(c);
    const rtl = kids(rPr).find((c) => isW(c, "rtl")) || null;
    rPr.insertBefore(el(doc, "sz", { val: "2" }), rtl);
    rPr.insertBefore(el(doc, "szCs", { val: "2" }), rtl);
  }

  // معرّفات فريدة للأشكال المنسوخة، وحذف ما يتكرر بالنسخ
  function fixIds(doc) {
    let id = 1;
    for (const d of Array.from(doc.getElementsByTagNameNS(WP, "docPr"))) {
      d.setAttribute("id", String(id));
      const holder = d.parentNode;
      for (const c of holder ? Array.from(holder.getElementsByTagNameNS(PIC_NS, "cNvPr")) : []) c.setAttribute("id", String(id));
      id++;
    }
    for (const tag of ["bookmarkStart", "bookmarkEnd"]) {
      for (const b of Array.from(doc.getElementsByTagNameNS(W, tag))) b.parentNode.removeChild(b);
    }
    for (const p of Array.from(doc.getElementsByTagNameNS(W, "p"))) {
      p.removeAttributeNS(W14, "paraId");
      p.removeAttributeNS(W14, "textId");
    }
    for (const a of Array.from(doc.getElementsByTagNameNS(WP, "anchor"))) {
      a.removeAttributeNS(WP14, "anchorId");
      a.removeAttributeNS(WP14, "editId");
    }
    let s = 1025;
    for (const v of Array.from(doc.getElementsByTagNameNS(VML, "shape"))) {
      v.removeAttributeNS(W14, "anchorId");
      const n = "_x0000_s" + s++;
      v.setAttribute("id", n);
      if (v.hasAttributeNS(OFFICE, "spid")) v.setAttributeNS(OFFICE, "o:spid", n);
    }
  }

  /* opts: { templateB64, rows:[{memo,link,big,note?,day?,date?}], sheets?:[{title, qrs:[{b64,name}]}] (أو title وqrPngB64 لكل الصفحات),
             halaqa?, student?, duration? } → Blob */
  async function build(opts) {
    const zip = await JSZip.loadAsync(opts.templateB64, { base64: true });
    const xml = await zip.file("word/document.xml").async("string");
    const doc = new DOMParser().parseFromString(xml, "application/xml");
    if (doc.getElementsByTagName("parsererror").length) throw new Error("تعذّرت قراءة القالب");
    const body = doc.getElementsByTagNameNS(W, "body")[0];
    const children = kids(body);
    const sectPr = children[children.length - 1];
    const trailing = children[children.length - 2];
    const proto = children.slice(0, 4);
    const shapeOk =
      isW(sectPr, "sectPr") && isW(trailing, "p") && isW(proto[0], "p") && isW(proto[1], "p") && isW(proto[2], "p") && isW(proto[3], "tbl");
    if (!shapeOk) throw new Error("بنية القالب غير متوقعة");

    for (const n of children) if (n !== sectPr) body.removeChild(n);
    // صور الرموز: لكل صورة مختلفة علاقة وملف
    const images = new Map();
    const relOf = (b64) => {
      if (!images.has(b64)) images.set(b64, "rIdQr" + (images.size + 1));
      return images.get(b64);
    };
    const sheetOf = (s) =>
      (opts.sheets && opts.sheets[s]) || { title: opts.title, qrs: opts.qrPngB64 ? [{ b64: opts.qrPngB64, name: "" }] : [] };
    for (let s = 0; s * ROWS_PER_SHEET < opts.rows.length; s++) {
      const block = proto.map((n) => n.cloneNode(true));
      const sheet = sheetOf(s);
      setTitle(block[0], sheet.title);
      setHalaqa(block[1], opts.halaqa);
      setStudent(block[1], opts.student);
      setQrs(doc, block, sheet.qrs, relOf);
      if (opts.duration) setDuration(block[2], opts.duration);
      fitHeader(block, Math.min((sheet.qrs || []).length, 4));
      fillTable(doc, block[3], opts.rows.slice(s * ROWS_PER_SHEET, (s + 1) * ROWS_PER_SHEET));
      if (s > 0) {
        // كل ٢٢ يوماً في صفحة جديدة
        const pPr = kids(block[0]).find((n) => isW(n, "pPr"));
        if (pPr) pPr.insertBefore(el(doc, "pageBreakBefore"), pPr.firstChild);
      }
      for (const n of block) body.insertBefore(n, sectPr);
    }
    shrinkTrailing(doc, trailing);
    body.insertBefore(trailing, sectPr);
    fixIds(doc);

    let out = new XMLSerializer().serializeToString(doc);
    if (!out.startsWith("<?xml")) out = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' + out;
    zip.file("word/document.xml", out);

    // صورة الرمز في القالب لم تعد مستعملة؛ تحل محلها صور رموز المتون
    const relsPath = "word/_rels/document.xml.rels";
    let rels = await zip.file(relsPath).async("string");
    rels = rels.replace(/<Relationship [^>]*Target="media\/image1\.jpg"[^>]*\/>/, "");
    zip.remove("word/media/image1.jpg");
    let n = 0;
    const add = [];
    for (const [b64, rid] of images) {
      n++;
      zip.file(`word/media/qr${n}.png`, b64, { base64: true });
      add.push(`<Relationship Id="${rid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/qr${n}.png"/>`);
    }
    zip.file(relsPath, rels.replace("</Relationships>", add.join("") + "</Relationships>"));
    if (images.size) {
      const ctPath = "[Content_Types].xml";
      let ct = await zip.file(ctPath).async("string");
      if (!/Extension="png"/i.test(ct)) ct = ct.replace("<Default ", '<Default Extension="png" ContentType="image/png"/><Default ');
      zip.file(ctPath, ct);
    }

    return zip.generateAsync({
      type: "blob",
      compression: "DEFLATE",
      mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
  }

  return { build, ROWS_PER_SHEET, emWidth, fitHalfPts, CELL_PT, noteSize, noteLines };
})();

