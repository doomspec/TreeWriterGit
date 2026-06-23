import { composeSectionView } from "../view/backend/dist/compose.js";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeFile } from "node:fs/promises";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const modelRoot = path.join(repoRoot, "model");

const result = await composeSectionView(modelRoot, "papers/vibecount");
await writeFile(path.join(repoRoot, "composed_draft_test.md"), result.draftMarkdown, "utf8");
console.log("Composed successfully!");
