// Prints ui/better-zoom.js as code that can be pasted into `tower-bench eval`, for trying an edit in a running game
// without restarting it. Static imports become dynamic ones so the file can run inside an async function.
//
//   node devtools/inject.mjs ui/better-zoom.js > /tmp/payload.js
//   node ../../tools/tower-bench/tower-bench.mjs eval "$(cat /tmp/payload.js)"
//
// Load it once per UI load: a second paste wraps the camera functions a second time.
import { readFileSync } from "node:fs";

const source = readFileSync(process.argv[2], "utf8")
  .replace(/^import (\w+) from '([^']+)';$/gm, "const $1 = (await import('$2')).default;")
  .replace(/^import \{ ([^}]+) \} from '([^']+)';$/gm, "const { $1 } = await import('$2');");

process.stdout.write(`(async () => {\n${source}\nreturn "loaded";\n})()`);
