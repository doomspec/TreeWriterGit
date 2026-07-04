import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const required = [
  "favicon-32.png",
  "favicon-16.png",
  "favicon.ico",
  "apple-touch-icon.png",
];

for (const name of required) {
  const filePath = path.join(root, "public", name);
  if (!fs.existsSync(filePath)) {
    console.error(`Missing favicon asset: public/${name}`);
    process.exit(1);
  }
}
