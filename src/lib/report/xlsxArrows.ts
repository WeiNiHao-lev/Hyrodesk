import JSZip from "jszip";

/**
 * Injects DrawingML arrow connectors into a finished workbook.
 *
 * ExcelJS can write cells, borders and images but not native shapes, so the
 * arrows that make a water balance diagram readable have to be added by editing
 * the package afterwards. The structure below is the same one Excel itself
 * produces: a twoCellAnchor per shape, holding a straight connector with an
 * arrow head, anchored to cell coordinates so the arrows move with the columns.
 */

export interface ArrowSpec {
  /** Zero-based anchor cells. */
  fromCol: number;
  fromRow: number;
  toCol: number;
  toRow: number;
  /** Offsets within the cell, in EMU (914400 per inch). */
  fromColOff?: number;
  fromRowOff?: number;
  toColOff?: number;
  toRowOff?: number;
  /** Line colour, hex without '#'. */
  color?: string;
  /** Line weight in EMU; 12700 is 1 pt. */
  widthEmu?: number;
  /** Dashed for recycle streams. */
  dashed?: boolean;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function connector(a: ArrowSpec, id: number): string {
  const color = a.color ?? "1A3A5C";
  const w = a.widthEmu ?? 12700;
  const dash = a.dashed ? '<a:prstDash val="dash"/>' : '<a:prstDash val="solid"/>';
  // Negative extents are expressed by flipping the shape rather than by sign.
  const flipH = a.toCol < a.fromCol ? ' flipH="1"' : "";
  const flipV = a.toRow < a.fromRow ? ' flipV="1"' : "";
  const c1 = Math.min(a.fromCol, a.toCol);
  const c2 = Math.max(a.fromCol, a.toCol);
  const r1 = Math.min(a.fromRow, a.toRow);
  const r2 = Math.max(a.fromRow, a.toRow);
  const o1c = a.fromColOff ?? 0;
  const o1r = a.fromRowOff ?? 0;
  const o2c = a.toColOff ?? 0;
  const o2r = a.toRowOff ?? 0;
  return `<xdr:twoCellAnchor>
<xdr:from><xdr:col>${c1}</xdr:col><xdr:colOff>${o1c}</xdr:colOff><xdr:row>${r1}</xdr:row><xdr:rowOff>${o1r}</xdr:rowOff></xdr:from>
<xdr:to><xdr:col>${c2}</xdr:col><xdr:colOff>${o2c}</xdr:colOff><xdr:row>${r2}</xdr:row><xdr:rowOff>${o2r}</xdr:rowOff></xdr:to>
<xdr:cxnSp macro="">
<xdr:nvCxnSpPr><xdr:cNvPr id="${id}" name="${esc(`Arrow ${id}`)}"/><xdr:cNvCxnSpPr/></xdr:nvCxnSpPr>
<xdr:spPr><a:xfrm${flipH}${flipV}><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></a:xfrm><a:prstGeom prst="straightConnector1"><a:avLst/></a:prstGeom><a:ln w="${w}"><a:solidFill><a:srgbClr val="${color}"/></a:solidFill>${dash}<a:tailEnd type="triangle" w="med" len="med"/></a:ln></xdr:spPr>
<xdr:style><a:lnRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:lnRef><a:fillRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:fillRef><a:effectRef idx="0"><a:scrgbClr r="0" g="0" b="0"/></a:effectRef><a:fontRef idx="minor"><a:schemeClr val="tx1"/></a:fontRef></xdr:style>
</xdr:cxnSp>
<xdr:clientData/>
</xdr:twoCellAnchor>`;
}

/**
 * Elements that follow <drawing> in the CT_Worksheet sequence. The new
 * <drawing> has to be placed before the first of these that is present.
 */
const AFTER_DRAWING = [
  "legacyDrawing", "legacyDrawingHF", "drawingHF", "picture",
  "oleObjects", "controls", "webPublishItems", "tableParts", "extLst",
];

/**
 * Character offset at which <drawing> must be inserted, or -1 if it belongs at
 * the end. Only direct children of <worksheet> are considered: extLst in
 * particular also occurs nested inside other elements, where it means nothing
 * for this decision.
 */
function insertionPoint(sheet: string): number {
  let depth = 0;
  const re = /<(\/?)([A-Za-z][A-Za-z0-9]*)((?:"[^"]*"|[^>"])*?)(\/?)>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(sheet)) !== null) {
    const [, close, name, , selfClose] = m;
    if (name === "worksheet") {
      depth += close ? -1 : 1;
      continue;
    }
    if (depth === 1 && !close && AFTER_DRAWING.includes(name)) return m.index;
    if (close) depth -= 1;
    else if (!selfClose) depth += 1;
  }
  return -1;
}

/**
 * Adds arrows to one worksheet of an existing xlsx buffer.
 *
 * @param buf     the workbook as written by ExcelJS
 * @param sheetName the worksheet to draw on
 * @param arrows  the connectors to add
 */
export async function injectArrows(
  buf: ArrayBuffer, sheetName: string, arrows: ArrowSpec[],
): Promise<ArrayBuffer> {
  if (arrows.length === 0) return buf;
  const zip = await JSZip.loadAsync(buf);

  // Locate the target sheet's part name via the workbook relationships.
  const wbXml = await zip.file("xl/workbook.xml")!.async("string");
  const relsXml = await zip.file("xl/_rels/workbook.xml.rels")!.async("string");
  const sheetMatch = [...wbXml.matchAll(/<sheet[^>]*name="([^"]+)"[^>]*r:id="(rId\d+)"[^>]*\/>/g)]
    .find((m) => m[1] === sheetName.replace(/&/g, "&amp;"));
  if (!sheetMatch) return buf;
  const rid = sheetMatch[2];
  const relMatch = new RegExp(`Id="${rid}"[^>]*Target="([^"]+)"`).exec(relsXml);
  if (!relMatch) return buf;
  const sheetPath = `xl/${relMatch[1].replace(/^\/?xl\//, "")}`;
  const sheetFile = zip.file(sheetPath);
  if (!sheetFile) return buf;

  // Pick a free drawing index.
  let n = 1;
  while (zip.file(`xl/drawings/drawing${n}.xml`)) n++;
  const drawingPath = `xl/drawings/drawing${n}.xml`;

  const body = arrows.map((a, i) => connector(a, 1000 + i)).join("\n");
  zip.file(drawingPath,
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n` +
    `<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" ` +
    `xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">\n${body}\n</xdr:wsDr>`);

  // Relationship from the sheet to the drawing.
  const sheetRelsPath = sheetPath.replace(/xl\/(.*)\/([^/]+)$/, "xl/$1/_rels/$2.rels");
  let sheetRels = zip.file(sheetRelsPath)
    ? await zip.file(sheetRelsPath)!.async("string")
    : `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  const usedIds = [...sheetRels.matchAll(/Id="rId(\d+)"/g)].map((m) => Number(m[1]));
  const newId = `rId${(usedIds.length ? Math.max(...usedIds) : 0) + 1}`;
  sheetRels = sheetRels.replace(
    "</Relationships>",
    `<Relationship Id="${newId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing${n}.xml"/></Relationships>`,
  );
  zip.file(sheetRelsPath, sheetRels);

  // Reference the drawing from the sheet. CT_Worksheet is an ordered sequence,
  // so the element cannot simply be appended: ExcelJS already writes
  // legacyDrawing (the VML behind cell notes), and that element follows drawing
  // in the schema. Putting drawing last makes Excel offer to repair the file.
  let sheet = await sheetFile.async("string");
  if (!/<drawing r:id=/.test(sheet)) {
    const tag = `<drawing r:id="${newId}"/>`;
    const at = insertionPoint(sheet);
    sheet = at >= 0
      ? sheet.slice(0, at) + tag + sheet.slice(at)
      : sheet.replace("</worksheet>", `${tag}</worksheet>`);
    zip.file(sheetPath, sheet);
  }

  // Content-type override for the drawing part.
  let ct = await zip.file("[Content_Types].xml")!.async("string");
  if (!ct.includes(`/xl/drawings/drawing${n}.xml`)) {
    ct = ct.replace(
      "</Types>",
      `<Override PartName="/xl/drawings/drawing${n}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/></Types>`,
    );
    zip.file("[Content_Types].xml", ct);
  }

  return zip.generateAsync({ type: "arraybuffer", compression: "DEFLATE" });
}
