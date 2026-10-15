
/* ===== كتابة ملف اكسل وقراءته بالاعتماد على JSZip =====
   الكتابة: أوراق متعددة، لكل خلية نمطها (خط ولون وتعبئة وحدود ومحاذاة)، وصيغ بقيمها المحسوبة، ودمج الخلايا.
   القراءة: كل الأوراق بأسمائها، أو أولها. */
const XlsxLite = (() => {
  const NS_MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
  const NS_REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
  const colName = (i) => {
    let s = "";
    for (i++; i > 0; i = Math.floor((i - 1) / 26)) s = String.fromCharCode(65 + ((i - 1) % 26)) + s;
    return s;
  };
  const colIndex = (ref) => {
    const letters = ref.replace(/[^A-Z]/gi, "").toUpperCase();
    let n = 0;
    for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64);
    return n - 1;
  };
  const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

  /* الأنماط: { اسم: { font, size, bold, color, fill, border, h, v, wrap } }؛ الألوان «RRGGBB»، والحدود خط رفيع بلون من الجهات الأربع.
     النمطان base وbold للجدول البسيط (Traditional Arabic 14 في وسط الخانة). */
  const BASE_STYLES = {
    base: { font: "Traditional Arabic", size: 14, h: "center", v: "center" },
    bold: { font: "Traditional Arabic", size: 14, bold: true, h: "center", v: "center" },
  };
  function styleTables(styles) {
    const fonts = [];
    const fills = ['<fill><patternFill patternType="none"/></fill>', '<fill><patternFill patternType="gray125"/></fill>'];
    const borders = ["<border><left/><right/><top/><bottom/><diagonal/></border>"];
    const xfs = [];
    const index = {};
    const intern = (list, xml) => {
      let i = list.indexOf(xml);
      if (i < 0) i = list.push(xml) - 1;
      return i;
    };
    const all = Object.assign({}, BASE_STYLES, styles);
    // النمط الأول هو الأصل لكل خلية بلا نمط
    for (const name of ["base"].concat(Object.keys(all).filter((k) => k !== "base"))) {
      const st = all[name];
      const font =
        "<font>" + (st.bold ? "<b/>" : "") + `<sz val="${st.size || 11}"/>` + (st.color ? `<color rgb="FF${st.color}"/>` : "") + `<name val="${esc(st.font || "Arial")}"/></font>`;
      const fontId = intern(fonts, font);
      const fillId = st.fill ? intern(fills, `<fill><patternFill patternType="solid"><fgColor rgb="FF${st.fill}"/><bgColor rgb="FF${st.fill}"/></patternFill></fill>`) : 0;
      const side = (k) => `<${k} style="thin"><color rgb="FF${st.border}"/></${k}>`;
      const borderId = st.border ? intern(borders, `<border>${side("left")}${side("right")}${side("top")}${side("bottom")}<diagonal/></border>`) : 0;
      const align = "<alignment" + (st.h ? ` horizontal="${st.h}"` : "") + ` vertical="${st.v || "center"}"` + (st.wrap ? ' wrapText="1"' : "") + "/>";
      index[name] = xfs.length;
      xfs.push(`<xf numFmtId="0" fontId="${fontId}" fillId="${fillId}" borderId="${borderId}" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">${align}</xf>`);
    }
    const xml =
      `${XML_HEAD}<styleSheet xmlns="${NS_MAIN}"><fonts count="${fonts.length}">${fonts.join("")}</fonts><fills count="${fills.length}">${fills.join("")}</fills>` +
      `<borders count="${borders.length}">${borders.join("")}</borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
      `<cellXfs count="${xfs.length}">${xfs.join("")}</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
    return { xml, index };
  }

  function cellXml(ref, cell, sIndex) {
    const o = cell !== null && typeof cell === "object" ? cell : { v: cell };
    const s = o.s != null && sIndex[o.s] != null ? ` s="${sIndex[o.s]}"` : "";
    const v = o.v;
    if (o.f) {
      const f = `<f>${esc(o.f)}</f>`;
      if (typeof v === "number") return `<c r="${ref}"${s}>${f}<v>${v}</v></c>`;
      return `<c r="${ref}"${s} t="str">${f}<v>${esc(v == null ? "" : v)}</v></c>`;
    }
    if (v === null || v === undefined || v === "") return s ? `<c r="${ref}"${s}/>` : "";
    if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
    return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
  }

  function sheetXml(sh, sIndex) {
    const cols = (sh.widths || []).map((w, i) => (w ? `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>` : "")).join("");
    const heights = sh.heights || {};
    const data = (sh.rows || [])
      .map((row, r) => {
        const cells = (row || []).map((cell, c) => cellXml(colName(c) + (r + 1), cell, sIndex)).join("");
        const ht = heights[r] ? ` ht="${heights[r]}" customHeight="1"` : "";
        return cells || ht ? `<row r="${r + 1}"${ht}>${cells}</row>` : "";
      })
      .join("");
    const merges = (sh.merges || []).length ? `<mergeCells count="${sh.merges.length}">${sh.merges.map((m) => `<mergeCell ref="${m}"/>`).join("")}</mergeCells>` : "";
    const view = `<sheetViews><sheetView${sh.rtl === false ? "" : ' rightToLeft="1"'}${sh.selected ? ' tabSelected="1"' : ""} workbookViewId="0"/></sheetViews>`;
    return `${XML_HEAD}<worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}">${view}<sheetFormatPr defaultRowHeight="15"/>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${data}</sheetData>${merges}</worksheet>`;
  }

  /* sheets: [{ name, rows, widths, heights: {رقم الصف من الصفر: الارتفاع}, merges: ["A1:C1"], rtl }]
     الخلية: نص أو رقم أو { v, f, s }: f صيغة بلا «=»، وv قيمتها المحسوبة، وs اسم نمطها */
  async function writeBook(sheets, { styles = {} } = {}) {
    const { xml: stylesXml, index } = styleTables(styles);
    const zip = new JSZip();
    const overrides = sheets
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("");
    zip.file(
      "[Content_Types].xml",
      `${XML_HEAD}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${overrides}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    );
    zip.file(
      "_rels/.rels",
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    );
    const sheetList = sheets.map((sh, i) => `<sheet name="${esc(sh.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("");
    // fullCalcOnLoad: يعيد اكسل حساب الصيغ عند فتح الملف
    zip.file(
      "xl/workbook.xml",
      `${XML_HEAD}<workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheetList}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`
    );
    const rels = sheets
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("");
    zip.file(
      "xl/_rels/workbook.xml.rels",
      `${XML_HEAD}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    );
    zip.file("xl/styles.xml", stylesXml);
    sheets.forEach((sh, i) => zip.file(`xl/worksheets/sheet${i + 1}.xml`, sheetXml(Object.assign({ selected: i === 0 }, sh), index)));
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  /* الجدول البسيط في ورقة واحدة: rows مصفوفة صفوف من نصوص وأرقام؛ bold: أرقام الصفوف (من الصفر) ذات الخط العريض */
  function simpleSheet(rows, { sheetName = "الخطة", widths = [], bold = [] } = {}) {
    const boldSet = new Set(bold);
    return {
      name: sheetName,
      widths,
      rows: rows.map((row, r) => (row || []).map((v) => (v === null || v === undefined || v === "" ? null : { v, s: boldSet.has(r) ? "bold" : "base" }))),
    };
  }
  function write(rows, opts = {}) {
    return writeBook([simpleSheet(rows, opts)]);
  }

  const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS("*", name));
  const textOf = (node) => byLocal(node, "t").map((t) => t.textContent).join("");

  /* كل أوراق الملف بترتيبها ← [{ name, rows }]، والصفوف مصفوفات نصوص */
  async function readAll(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const parse = async (path) => {
      const f = zip.file(path);
      return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null;
    };
    const wb = await parse("xl/workbook.xml");
    if (!wb) throw new Error("الملف ليس ملف اكسل بصيغة xlsx");
    const rels = await parse("xl/_rels/workbook.xml.rels");
    const ssDoc = await parse("xl/sharedStrings.xml");
    const shared = ssDoc ? byLocal(ssDoc, "si").map(textOf) : [];
    const out = [];
    const sheets = byLocal(wb, "sheet");
    for (let k = 0; k < sheets.length; k++) {
      const sheet = sheets[k];
      const rid = sheet.getAttributeNS(NS_REL, "id") || sheet.getAttribute("r:id");
      let target = `worksheets/sheet${k + 1}.xml`;
      if (rels && rid) {
        const rel = byLocal(rels, "Relationship").find((r) => r.getAttribute("Id") === rid);
        if (rel) target = rel.getAttribute("Target");
      }
      const sheetPath = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
      const ws = await parse(sheetPath);
      if (!ws) continue;
      const rows = [];
      for (const row of byLocal(ws, "row")) {
        const r = (parseInt(row.getAttribute("r"), 10) || rows.length + 1) - 1;
        const cur = (rows[r] = rows[r] || []);
        byLocal(row, "c").forEach((c, i) => {
          const ref = c.getAttribute("r");
          const col = ref ? colIndex(ref) : i;
          const type = c.getAttribute("t");
          const v = byLocal(c, "v")[0];
          let val = "";
          if (type === "s") val = shared[parseInt(v && v.textContent, 10)] || "";
          else if (type === "inlineStr") val = textOf(c);
          else if (v) val = v.textContent;
          cur[col] = String(val).trim();
        });
      }
      out.push({ name: sheet.getAttribute("name") || "", rows: Array.from(rows, (r) => Array.from(r || [], (v) => v || "")) });
    }
    if (!out.length) throw new Error("لم أجد ورقة في الملف");
    return out;
  }
  /* أول ورقة في الملف ← مصفوفة صفوف من النصوص */
  async function read(buffer) {
    return (await readAll(buffer))[0].rows;
  }

  /* ملف CSV بسيط ← مصفوفة صفوف */
  function readCsv(text) {
    const rows = [];
    let row = [];
    let cur = "";
    let q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) {
        if (ch === '"' && text[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') q = false;
        else cur += ch;
      } else if (ch === '"') q = true;
      else if (ch === "," || ch === ";" || ch === "\t") {
        row.push(cur.trim());
        cur = "";
      } else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        row.push(cur.trim());
        rows.push(row);
        row = [];
        cur = "";
      } else cur += ch;
    }
    if (cur || row.length) {
      row.push(cur.trim());
      rows.push(row);
    }
    return rows;
  }

  return { write, writeBook, simpleSheet, read, readAll, readCsv, colName };
})();
