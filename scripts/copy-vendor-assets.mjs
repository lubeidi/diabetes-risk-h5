import fs from "node:fs";
import path from "node:path";

// Keep identical behavior to chatbot_h5: ensure /public/vendor exists for long-cache static assets.
const cwd = process.cwd();
const outDir = path.join(cwd, "public", "vendor");

fs.mkdirSync(outDir, { recursive: true });
// This project does not currently bundle extra vendor assets.
// The folder is kept to align nginx caching rules and future additions.
fs.writeFileSync(path.join(outDir, ".keep"), "ok\n", "utf8");

