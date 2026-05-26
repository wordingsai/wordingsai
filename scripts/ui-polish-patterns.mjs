// Bulk find/replace for the dashboard polish patterns.
// Applies to a list of files. Idempotent: safe to re-run.
//
// Usage: node scripts/ui-polish-patterns.mjs <file1> [file2] ...

import fs from "node:fs";

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("Usage: node scripts/ui-polish-patterns.mjs <file>");
  process.exit(1);
}

// Order matters: longer/more-specific patterns FIRST so they don't get masked
// by shorter ones.
const REPLACEMENTS = [
  // --- Headings: text-3xl/4xl/5xl font-black tracking-tighter uppercase ---
  // The shouty hero pattern.
  [
    /text-3xl\s+lg:text-5xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl lg:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-3xl\s+md:text-5xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl md:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-3xl\s+md:text-4xl\s+lg:text-5xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl md:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-4xl\s+lg:text-5xl\s+font-black\s+tracking-tighter\s+uppercase/g,
    "text-2xl lg:text-3xl font-semibold tracking-tight",
  ],
  [
    /text-2xl\s+lg:text-3xl\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-xl lg:text-2xl font-semibold tracking-tight",
  ],
  [
    /text-2xl\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-xl font-semibold tracking-tight",
  ],
  [
    /text-2xl\s+font-black\s+tracking-tight\s+uppercase/g,
    "text-lg font-semibold tracking-tight",
  ],
  [
    /text-xl\s+font-black\s+uppercase\s+tracking-tight/g,
    "text-base font-semibold tracking-tight",
  ],

  // --- Micro labels: text-[8/9/10/11px] font-black uppercase tracking-widest ---
  // Kept uppercase but lighter weight + slightly larger.
  [
    /text-\[8px\]\s+font-black\s+text-on-surface-variant\s+uppercase\s+tracking-widest/g,
    "text-[10px] font-medium text-on-surface-variant uppercase tracking-wider",
  ],
  [
    /text-\[8px\]\s+font-black\s+uppercase\s+tracking-widest/g,
    "text-[10px] font-medium uppercase tracking-wider",
  ],
  [
    /text-\[9px\]\s+font-black\s+text-on-surface-variant\s+uppercase\s+tracking-widest/g,
    "text-[10px] font-medium text-on-surface-variant uppercase tracking-wider",
  ],
  [
    /text-\[9px\]\s+font-black\s+uppercase\s+tracking-widest/g,
    "text-[10px] font-medium uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+text-on-surface-variant\s+uppercase\s+tracking-widest/g,
    "text-xs font-medium text-on-surface-variant uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+text-on-surface\s+uppercase\s+tracking-widest/g,
    "text-xs font-medium text-on-surface uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+text-on-surface\s+uppercase\s+tracking-\[0\.2em\]/g,
    "text-xs font-medium text-on-surface uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+text-on-surface-variant\s+uppercase\s+tracking-\[0\.2em\]/g,
    "text-xs font-medium text-on-surface-variant uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+uppercase\s+tracking-widest/g,
    "text-xs font-medium uppercase tracking-wider",
  ],
  [
    /text-\[10px\]\s+font-black\s+uppercase\s+tracking-tighter/g,
    "text-[10px] font-medium uppercase tracking-wider",
  ],
  [
    /text-\[11px\]\s+font-black\s+uppercase\s+tracking-widest/g,
    "text-xs font-medium uppercase tracking-wider",
  ],
  [
    /font-black\s+tracking-widest\s+text-\[10px\]\s+uppercase/g,
    "text-xs font-medium uppercase tracking-wider",
  ],
  [
    /font-black\s+uppercase\s+tracking-widest\s+text-\[10px\]/g,
    "text-xs font-medium uppercase tracking-wider",
  ],
  [
    /font-black\s+text-\[10px\]\s+uppercase\s+tracking-widest/g,
    "text-xs font-medium uppercase tracking-wider",
  ],
  [
    /font-black\s+text-\[10px\]\s+uppercase/g,
    "text-xs font-medium uppercase",
  ],

  // --- Body content: font-black <size> uppercase tracking-tight ---
  // Body row items shouldn't shout.
  [
    /font-black\s+text-xl\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-sm font-medium text-on-surface",
  ],
  [
    /font-black\s+text-lg\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-sm font-medium text-on-surface",
  ],
  [
    /text-lg\s+text-on-surface\s+uppercase\s+tracking-tight/g,
    "text-sm text-on-surface",
  ],

  // --- Oversized custom buttons that ignore shadcn sizing ---
  [
    /px-12\s+py-8\s+rounded-2xl\s+shadow-xl\s+shadow-primary\/20/g,
    "px-5 py-2 rounded-md",
  ],
  [
    /px-8\s+py-7\s+rounded-2xl\s+shadow-xl\s+shadow-primary\/20/g,
    "rounded-md",
  ],
  [
    /h-16\s+px-10\s+rounded-2xl\s+font-black\s+uppercase\s+tracking-widest\s+text-xs\s+shadow-2xl/g,
    "rounded-md",
  ],
  [
    /h-14\s+px-10\s+rounded-2xl\s+font-black\s+uppercase\s+tracking-widest\s+text-xs/g,
    "rounded-md",
  ],
  [
    /h-12\s+lg:h-14\s+px-6\s+rounded-2xl\s+font-black\s+uppercase\s+tracking-widest\s+text-\[11px\]/g,
    "rounded-md",
  ],
  // Generic "font-black px-X py-Y rounded-2xl" -> default
  [
    /font-black\s+px-8\s+py-7\s+rounded-2xl/g,
    "rounded-md",
  ],

  // --- Oversized form fields ---
  [
    /h-14\s+bg-background\s+border-outline-variant\s+rounded-2xl\s+font-bold/g,
    "bg-background",
  ],
  [
    /h-14\s+w-14\s+rounded-2xl\s+border-outline-variant\s+p-0/g,
    "border-outline-variant",
  ],

  // --- Oversized cards / oversized radius ---
  [/rounded-\[3rem\]/g, "rounded-xl"],
  [/rounded-\[2\.5rem\]/g, "rounded-xl"],
  [/rounded-\[2rem\]/g, "rounded-lg"],

  // --- "hover:scale-[1.02]" is fine but combined with shadow looks bouncy ---
  [/hover:scale-\[1\.02\]/g, ""],

  // --- "shadow-2xl shadow-primary/30" / "shadow-2xl" -> shadow-lg (more subtle) ---
  [/shadow-2xl\s+shadow-primary\/30/g, "shadow-lg shadow-primary/20"],
  [/shadow-2xl\s+shadow-destructive\/20/g, "shadow-md"],

  // --- Excessive font-black on action text (kept on small labels via earlier rules) ---
  // After all the specific replacements above, this catches leftover "font-black" in classNames
  // that didn't match the broader patterns. Be conservative — only tighten where text-sm/base.
  [
    /\bfont-black\s+text-sm\b/g,
    "font-semibold text-sm",
  ],
  [
    /\btext-sm\s+font-black\b/g,
    "text-sm font-semibold",
  ],
  [
    /\bfont-black\s+text-base\b/g,
    "font-semibold text-base",
  ],
];

let totalFiles = 0;
let totalChanges = 0;
for (const file of args) {
  const before = fs.readFileSync(file, "utf8");
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
