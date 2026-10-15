
/* ===== كتابة ملف اكسل وقراءته (ورقة واحدة) بالاعتماد على JSZip ===== */
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

  /* rows: مصفوفة صفوف من نصوص وأرقام؛ bold: أرقام الصفوف (من الصفر) ذات الخط العريض */
  async function write(rows, { sheetName = "الخطة", widths = [], bold = [] } = {}) {
    const boldSet = new Set(bold);
    const cols = widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("");
    const data = rows
      .map((row, r) => {
        const cells = row
          .map((v, c) => {
            if (v === null || v === undefined || v === "") return "";
            const ref = colName(c) + (r + 1);
            const s = boldSet.has(r) ? ' s="1"' : "";
            if (typeof v === "number") return `<c r="${ref}"${s}><v>${v}</v></c>`;
            return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${esc(v)}</t></is></c>`;
          })
          .join("");
        return `<row r="${r + 1}">${cells}</row>`;
      })
      .join("");
    const zip = new JSZip();
    zip.file(
      "[Content_Types].xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`
    );
    zip.file(
      "_rels/.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`
    );
    zip.file(
      "xl/workbook.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheets><sheet name="${esc(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`
    );
    zip.file(
      "xl/_rels/workbook.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`
    );
    zip.file(
      "xl/styles.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${NS_MAIN}"><fonts count="2"><font><sz val="14"/><name val="Traditional Arabic"/></font><font><b/><sz val="14"/><name val="Traditional Arabic"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyAlignment="1"><alignment horizontal="center" vertical="center"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`
    );
    zip.file(
      "xl/worksheets/sheet1.xml",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="${NS_MAIN}" xmlns:r="${NS_REL}"><sheetViews><sheetView rightToLeft="1" workbookViewId="0"/></sheetViews>${cols ? `<cols>${cols}</cols>` : ""}<sheetData>${data}</sheetData></worksheet>`
    );
    return zip.generateAsync({ type: "blob", compression: "DEFLATE", mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  }

  const byLocal = (root, name) => Array.from(root.getElementsByTagNameNS("*", name));
  const textOf = (node) => byLocal(node, "t").map((t) => t.textContent).join("");

  /* أول ورقة في الملف ← مصفوفة صفوف من النصوص */
  async function read(buffer) {
    const zip = await JSZip.loadAsync(buffer);
    const parse = async (path) => {
      const f = zip.file(path);
      return f ? new DOMParser().parseFromString(await f.async("string"), "application/xml") : null;
    };
    const wb = await parse("xl/workbook.xml");
    if (!wb) throw new Error("الملف ليس ملف اكسل بصيغة xlsx");
    const sheet = byLocal(wb, "sheet")[0];
    const rid = sheet && (sheet.getAttributeNS(NS_REL, "id") || sheet.getAttribute("r:id"));
    const rels = await parse("xl/_rels/workbook.xml.rels");
    let target = "worksheets/sheet1.xml";
    if (rels && rid) {
      const rel = byLocal(rels, "Relationship").find((r) => r.getAttribute("Id") === rid);
      if (rel) target = rel.getAttribute("Target");
    }
    const sheetPath = target.startsWith("/") ? target.slice(1) : "xl/" + target.replace(/^\.\//, "");
    const ws = await parse(sheetPath);
    if (!ws) throw new Error("لم أجد ورقة في الملف");
    const ssDoc = await parse("xl/sharedStrings.xml");
    const shared = ssDoc ? byLocal(ssDoc, "si").map(textOf) : [];
    const rows = [];
    for (const row of byLocal(ws, "row")) {
      const r = (parseInt(row.getAttribute("r"), 10) || rows.length + 1) - 1;
      const out = (rows[r] = rows[r] || []);
      byLocal(row, "c").forEach((c, i) => {
        const ref = c.getAttribute("r");
        const col = ref ? colIndex(ref) : i;
        const type = c.getAttribute("t");
        const v = byLocal(c, "v")[0];
        let val = "";
        if (type === "s") val = shared[parseInt(v && v.textContent, 10)] || "";
        else if (type === "inlineStr") val = textOf(c);
        else if (v) val = v.textContent;
        out[col] = String(val).trim();
      });
    }
    return Array.from(rows, (r) => Array.from(r || [], (v) => v || ""));
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

  return { write, read, readCsv };
})();

