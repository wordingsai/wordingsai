// Pass 4 — strip lingering uppercase from card/section titles in the app surfaces.
// The earlier passes converted font-black -> font-semibold but kept uppercase,
// which still reads as shouty. This pass removes uppercase on titles and
// cleans up a few stragglers.
//
// Usage: node scripts/ui-polish-pass4.mjs <file1> [file2] ...

import fs from "node:fs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/ui-polish-pass4.mjs <file>");
  process.exit(1);
}

const REPLACEMENTS = [
  // text-lg font-semibold uppercase (with various trailing class lists)
  // Keep text-lg + font-semibold + tracking-tight; drop uppercase.
  [
    /text-lg\s+font-semibold\s+uppercase\s+text-on-surface\s+tracking-tight/g,
    "text-base font-semibold text-on-surface tracking-tight",
  ],
  [
    /text-xl\s+sm:text-lg\s+font-semibold\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-base font-semibold text-on-surface tracking-tight",
  ],
  [
    /text-lg\s+font-semibold\s+uppercase\s+text-on-surface/g,
    "text-base font-semibold text-on-surface",
  ],
  [
    /text-lg\s+font-semibold\s+text-on-surface\s+mb-(\d+)\s+uppercase\s+tracking-tight/g,
    "text-base font-semibold text-on-surface mb-$1",
  ],
  [
    /text-lg\s+font-semibold\s+mb-(\d+)\s+uppercase\s+tracking-tight/g,
    "text-base font-semibold mb-$1",
  ],
  [
    /text-lg\s+font-black\s+uppercase\s+tracking-tight\s+text-primary/g,
    "text-base font-semibold text-primary",
  ],
  [
    /text-lg\s+font-black\s+uppercase\s+tracking-tight/g,
    "text-base font-semibold",
  ],
  // Generic catch-all for any remaining "text-lg ... font-semibold ... uppercase ..."
  // (ordered combinations) - only the safest variant
  [
    /text-lg\s+font-semibold\s+uppercase\b/g,
    "text-base font-semibold",
  ],
  // text-base font-semibold uppercase (smaller titles - become text-sm font-semibold)
  [
    /text-base\s+font-semibold\s+uppercase\s+tracking-tight/g,
    "text-sm font-semibold tracking-tight",
  ],
  // Sweep: any remaining "font-black" in protected app -> font-semibold
  // (we already kept marketing home off-limits in pass 3 by listing files explicitly)
  [
    /\bfont-black\b/g,
    "font-semibold",
  ],
];

let totalFiles = 0;
let totalChanges = 0;
for (const file of args) {
  let before;
  try {
    before = fs.readFileSync(file, "utf8");
  } catch (e) {
    console.error(`[${file}] skipped: ${e.code}`);
    continue;
  }
  let after = before;
  let fileChanges = 0;
  for (const [pat, repl] of REPLACEMENTS) {
    const matches = after.match(pat);
    if (matches) {
      fileChanges += matches.length;
      after = after.replace(pat, repl);
    }
  }
  if (after !== before) {
    fs.writeFileSync(file, after);
    console.log(`[${file}] ${fileChanges} replacements`);
    totalChanges += fileChanges;
    totalFiles += 1;
  } else {
    console.log(`[${file}] no changes`);
  }
}
console.log(`\nDone. ${totalChanges} replacements across ${totalFiles} files.`);
