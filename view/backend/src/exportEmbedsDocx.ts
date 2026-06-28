/** Backward-compatible facade — import from `./exportEmbedsDocx.js` unchanged. */
export {
  DOCX_ASSET_URL_PREFIX,
  expandManuscriptEmbedsForDocx,
  replaceFigureRefsForDocx,
  type ExportEmbedResult,
} from "./export/embeds/docx.js";

export { buildTableMarkdownExport, figureLabel } from "./export/embeds/shared.js";
