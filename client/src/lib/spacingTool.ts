import type { ToolModule } from '@/types/workshop';

// Imported from the provided Spacing_tool.js with TypeScript types
function isLikelyHtml(code: string, filename?: string): boolean {
  if (filename && /\.x?html?$/i.test(filename)) return true;
  const sample = (code || "").slice(0, 2000).toLowerCase();
  const tagCount = (sample.match(/<\w[\w-]*[^>]*>/g) || []).length;
  return /<!doctype\s+html/.test(sample) || /<html\b/.test(sample) || tagCount >= 10;
}

const VOID_HTML: Record<string, number> = {
  area:1, base:1, br:1, col:1, embed:1, hr:1, img:1, input:1, link:1, meta:1, param:1, source:1, track:1, wbr:1
};

interface ParserState {
  inStr: string | null;
  inBlock: boolean;
}

function stripStringsAndLineComments(line: string, state: ParserState): string {
  let out = "";
  let i = 0;
  let inStr = state.inStr;
  let inBlock = state.inBlock;

  while (i < line.length) {
    const ch = line[i];
    const next = line[i + 1];

    if (inBlock) {
      if (ch === "*" && next === "/") { inBlock = false; i += 2; continue; }
      i++; continue;
    }
    if (inStr) {
      if (ch === "\\" && i + 1 < line.length) { i += 2; continue; }
      if (ch === inStr) inStr = null;
      i++; continue;
    }
    if (ch === "/" && next === "*") { inBlock = true; i += 2; continue; }
    if (ch === "/" && next === "/" && !(out.endsWith("http:") || out.endsWith("https:"))) break;
    if (ch === "'" || ch === '"' || ch === "`") { inStr = ch; i++; continue; }

    out += ch; i++;
  }
  state.inStr = inStr; state.inBlock = inBlock;
  return out;
}

function normalizeIndent(code: string, ctx?: { filename?: string }) {
  const two = "  ";
  const lines = (code || "").split(/\r?\n/);
  const looksHtml = isLikelyHtml(code, ctx && ctx.filename);

  let indentLevel = 0;
  let prevBlank = false;
  const stats = { tabsReplaced: 0, trailingSpacesTrimmed: 0, blankLinesRemoved: 0, indentChanges: 0 };
  const state: ParserState = { inStr: null, inBlock: false };
  const out: string[] = [];

  for (let idx = 0; idx < lines.length; idx++) {
    let line = lines[idx];

    // tabs -> 2 spaces
    const tabMatches = line.match(/\t/g);
    if (tabMatches) stats.tabsReplaced += tabMatches.length;
    line = line.replace(/\t/g, two);

    // trim trailing spaces
    const trimmedRight = line.replace(/\s+$/,"");
    const trailing = line.length - trimmedRight.length;
    if (trailing > 0) stats.trailingSpacesTrimmed += trailing;
    line = trimmedRight;

    const originalLeadingLen = ((line.match(/^\s*/) || [""])[0]).length;
    const body = line.trim();

    // collapse multiple blank lines
    if (body === "") {
      if (prevBlank) { stats.blankLinesRemoved++; continue; }
      prevBlank = true;
    } else {
      prevBlank = false;
    }

    // dedent-before rules
    let dedentBefore = false;
    if (looksHtml) {
      if (/^<\/[a-zA-Z0-9-:]+\b/.test(body)) dedentBefore = true;
    } else {
      if (/^(}|\]|\))/.test(body)) dedentBefore = true;
    }
    if (dedentBefore) indentLevel = Math.max(0, indentLevel - 1);

    // apply indentation
    const intended = body === "" ? "" : two.repeat(indentLevel);
    const newLine = body === "" ? "" : intended + body;
    if (body !== "" && intended.length !== originalLeadingLen) stats.indentChanges++;
    out.push(newLine);

    // post-line indent delta
    if (looksHtml) {
      const lc = body.toLowerCase();
      if (lc && !/^<!/.test(lc) && !/^<!--/.test(lc)) {
        const openMatch = lc.match(/^<([a-z0-9-:]+)\b[^>]*>/);
        const isSelfClose = /\/>$/.test(lc);
        if (openMatch && !isSelfClose) {
          const tag = openMatch[1];
          if (!VOID_HTML[tag] && !lc.startsWith("</")) indentLevel++;
        }
      }
    } else {
      const scan = stripStringsAndLineComments(line, state);
      const opens = (scan.match(/[{\[\(]/g) || []).length;
      const closes = (scan.match(/[}\]\)]/g) || []).length;
      const net = opens - closes;
      if (net > 0) indentLevel += net;
    }
  }

  return { code: out.join("\n"), stats };
}

async function run(code: string, ctx?: any) {
  if (typeof code !== "string") {
    return {
      code: "",
      summary: "Input was not a string.",
      stats: { tabsReplaced: 0, trailingSpacesTrimmed: 0, blankLinesRemoved: 0, indentChanges: 0 },
      warnings: ["space-formatter: input code must be a string."]
    };
  }
  const normalized = code.replace(/\r\n/g, "\n");
  const { code: formatted, stats } = normalizeIndent(normalized, ctx || {});

  const parts = [];
  if (stats.tabsReplaced) parts.push(`${stats.tabsReplaced} tab${stats.tabsReplaced>1?"s":""} → spaces`);
  if (stats.trailingSpacesTrimmed) parts.push(`trimmed ${stats.trailingSpacesTrimmed} trailing space${stats.trailingSpacesTrimmed>1?"s":""}`);
  if (stats.blankLinesRemoved) parts.push(`removed ${stats.blankLinesRemoved} extra blank line${stats.blankLinesRemoved>1?"s":""}`);
  if (stats.indentChanges) parts.push(`adjusted indentation on ${stats.indentChanges} line${stats.indentChanges>1?"s":""}`);

  return {
    code: formatted,
    summary: parts.length ? parts.join(", ") : "No spacing or indentation changes were necessary.",
    stats,
    warnings: []
  };
}

export const spacingTool: ToolModule = {
  name: "space-formatter",
  version: "1.0.5",
  description: "Trims trailing spaces, tabs→2 spaces, collapses blank lines, and normalizes indentation (2 spaces).",
  run: run
};
