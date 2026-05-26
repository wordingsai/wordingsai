// Broader polish pass 3 — catches the remaining "font-black + text-3xl/4xl/5xl"
// combinations the per-pattern script missed.
//
// Strategy: convert font-black -> font-semibold inside the protected app
// (and other in-app surfaces), and shrink remaining solo text-5xl / text-6xl
// headers. Marketing home (home/hero, dashboard-section preview, legal pages)
// is left alone since those are intentionally bigger.
//
// Usage: node scripts/ui-polish-pass3.mjs <file1> [file2] ...

import fs from "node:fs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/ui-polish-pass3.mjs <file>");
  process.exit(1);
}

const REPLACEMENTS = [
  // --- Shrink remaining oversized headers ---
  // Solo text-5xl with uppercase tracking-tighter (hero variants no script caught)
  [
    /text-5xl\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-2xl font-semibold tracking-tight",
  ],
  [
    /text-5xl\s+font-black\s+leading-\[1\.1\]\s+tracking-tight/g,
    "text-3xl lg:text-4xl font-semibold leading-tight tracking-tight",
  ],
  [
    /text-4xl\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-xl font-semibold tracking-tight",
  ],
  [
    /text-4xl\s+font-black\s+tracking-tighter/g,
    "text-2xl font-semibold tracking-tight",
  ],
  [
    /text-4xl\s+font-black\s+tracking-\[0\.2em\]/g,
    "text-xl font-semibold tracking-wide",
  ],
  [
    /text-3xl\s+lg:text-4xl\s+font-black\s+uppercase\s+tracking-tight/g,
    "text-xl lg:text-2xl font-semibold tracking-tight",
  ],
  [
    /text-3xl\s+md:text-4xl\s+lg:text-6xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl lg:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-4xl\s+md:text-5xl\s+lg:text-6xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl lg:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-3xl\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-xl font-semibold tracking-tight",
  ],
  [
    /text-3xl\s+font-black\s+uppercase\s+text-on-surface\s+tracking-tighter/g,
    "text-xl font-semibold text-on-surface tracking-tight",
  ],
  [
    /text-3xl\s+font-black\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-lg font-semibold text-on-surface",
  ],
  [
    /text-2xl\s+md:text-3xl\s+font-black\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-lg md:text-xl font-semibold text-on-surface",
  ],
  // Numbers / stats — text-4xl/5xl font-black text-COLOR -> text-3xl semibold
  [
    /text-5xl\s+font-black\s+tracking-tighter/g,
    "text-3xl font-semibold tracking-tight",
  ],
  [
    /text-4xl\s+font-black\s+text-on-surface\s+tracking-tighter/g,
    "text-3xl font-semibold text-on-surface tracking-tight",
  ],
  [
    /text-4xl\s+font-black\s+text-([a-z-]+-\d{3})\s+tracking-tighter/g,
    "text-3xl font-semibold text-$1 tracking-tight",
  ],
  [
    /text-3xl\s+font-black\s+text-(slate-\d{3}|on-surface|primary)\s+([a-z-]+)/g,
    "text-2xl font-semibold text-$1 $2",
  ],
  [
    /text-3xl\s+font-black\s+text-(slate-\d{3})/g,
    "text-2xl font-semibold text-$1",
  ],
  // Onboarding "text-4xl font-black tracking-tight" (no uppercase)
  [
    /text-4xl\s+font-black\s+tracking-tight\b/g,
    "text-2xl font-semibold tracking-tight",
  ],
  // upgrade page "text-5xl font-black uppercase tracking-tighter mt-6 mb-4"
  [
    /text-5xl\s+font-black\s+uppercase\s+tracking-tighter\s+mt-6\s+mb-4/g,
    "text-2xl font-semibold tracking-tight mt-4 mb-3",
  ],
  // "text-4xl font-black mb-X"
  [
    /text-4xl\s+font-black\s+mb-(\d+)/g,
    "text-2xl font-semibold mb-$1",
  ],
  // Generic safe sweep: leftover "text-2xl font-black uppercase"
  [
    /text-2xl\s+font-black\s+uppercase\s+tracking-tight/g,
    "text-lg font-semibold tracking-tight",
  ],
  [
    /text-2xl\s+font-black\b/g,
    "text-lg font-semibold",
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
