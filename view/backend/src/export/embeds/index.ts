export type { ExportEmbedResult } from "./shared.js";
export {
  buildTableMarkdownExport,
  captionMarkdownToPlain,
  figureLabel,
  tableLabel,
} from "./shared.js";

export {
  buildEquationLatexExportAsync,
  buildFigureExportPreamble,
  buildFigureLatexExport,
  expandManuscriptEmbedsForExport,
} from "./latex.js";

export {
  DOCX_ASSET_URL_PREFIX,
  expandManuscriptEmbedsForDocx,
  replaceFigureRefsForDocx,
} from "./docx.js";
