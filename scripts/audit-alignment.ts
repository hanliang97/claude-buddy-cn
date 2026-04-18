// Audit all species × all frames in buddy-status.sh for center alignment.
// For each frame, compute row widths and content centers. Warn if spread > 0.5.

import { readFileSync } from "fs";

const src = readFileSync(import.meta.dir + "/../statusline/buddy-status.sh", "utf8");

// Extract each species case block: from `  SPECIES)` to `  esac ;;`
const speciesBlocks = [
  "duck", "goose", "blob", "cat", "dragon", "octopus", "owl", "penguin",
  "turtle", "snail", "ghost", "axolotl", "capybara", "cactus", "robot",
  "rabbit", "mushroom", "chonk",
];

function cjkWidth(s: string): number {
  let w = 0;
  for (const ch of s) {
    const o = ch.codePointAt(0)!;
    if (o >= 0x1f000) w += 2;
    else if (o >= 0x2600 && o <= 0x27bf) w += 2;
    else {
      // East Asian Width W/F = 2, else 1 (matches bash disp_width)
      // Simplified: CJK block roughly 0x3000+
      if (o >= 0x3000 && o <= 0x9fff) w += 2;
      else w += 1;
    }
  }
  return w;
}

function parseLine(line: string): { lead: number; content: string; total: number } {
  const m = line.match(/^(\s*)(.*)$/)!;
  const lead = m[1].length;
  const content = m[2];
  return { lead, content, total: lead + cjkWidth(content) };
}

function auditFrame(species: string, frameIdx: number, lines: Record<string, string>) {
  // Substitute ${E} with a 1-col eye
  const subst = (s: string) => s.replace(/\$\{E\}/g, "°");
  const rows = [lines.L1, lines.L2, lines.L3, lines.L4].map(subst);
  const parsed = rows.map((r) => {
    const p = parseLine(r);
    return { lead: p.lead, contentW: cjkWidth(p.content) };
  });
  const centers = parsed.map((p) => p.lead + p.contentW / 2);
  const spread = Math.max(...centers) - Math.min(...centers);
  const mark = spread <= 0.5 ? "✓" : "✗";
  if (spread > 0.5) {
    console.log(`${mark} ${species} frame${frameIdx}  spread=${spread.toFixed(1)}`);
    parsed.forEach((p, i) => {
      console.log(`    L${i + 1}: lead=${p.lead} w=${p.contentW} c=${(p.lead + p.contentW / 2).toFixed(1)}  "${rows[i]}"`);
    });
  }
  return spread <= 0.5;
}

let okCount = 0;
let badCount = 0;

for (const species of speciesBlocks) {
  // Find the case block for this species
  const re = new RegExp(`  ${species}\\)\\n(?:.|\\n)*?    esac ;;`, "m");
  const m = src.match(re);
  if (!m) { console.log(`? no block found for ${species}`); continue; }
  const block = m[0];
  // Parse each frame: `      0) L1="..."; L2="..."; L3="..."; L4="..." ;;`
  for (let f = 0; f < 3; f++) {
    const fre = new RegExp(`^\\s*${f}\\)\\s*(.+?)\\s*;;$`, "m");
    const fm = block.match(fre);
    if (!fm) { console.log(`? no frame ${f} for ${species}`); continue; }
    const body = fm[1];
    // Extract L1/L2/L3/L4 via bash quote parsing
    const lines: Record<string, string> = {};
    const lre = /L(\d)="((?:[^"\\]|\\.)*)"/g;
    let lm;
    while ((lm = lre.exec(body)) !== null) {
      // Interpret bash escapes: \\ → \, \` → `, \" → "
      lines[`L${lm[1]}`] = lm[2].replace(/\\\\/g, "\\").replace(/\\`/g, "`").replace(/\\"/g, '"');
    }
    if (auditFrame(species, f, lines)) okCount++;
    else badCount++;
  }
}

console.log(`\n${okCount}/${okCount + badCount} frames OK`);
if (badCount === 0) console.log("✅ all species × frames center-aligned within 0.5 col");
