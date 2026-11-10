/**
 * MEXA MOTION — real-cascade colour resolution
 *
 * For every text element on the page, work out which rule in the theme
 * actually wins (specificity + !important + source order), then check the
 * resulting foreground against the background it truly sits on.
 *
 * This is the check that caught the founder-card bug, so it must stay strict.
 *
 * Run:  node resolve.mjs
 */

import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const here = new URL("./", import.meta.url);
const html = readFileSync(new URL("./index.html", here), "utf8");
const css = readFileSync(new URL("./card-theme.css", here), "utf8");
const ORIGINAL_HTML = readFileSync(new URL("./original.html", here), "utf8");
const doc = new JSDOM(html).window.document;

/* --- pull the theme's rules, expanding top-level @media ------------------ */
const clean = css.replace(/\/\*[\s\S]*?\*\//g, "");
const rules = [];
{
  let i = 0;
  while (i < clean.length) {
    const open = clean.indexOf("{", i);
    if (open === -1) break;
    const selector = clean.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < clean.length && depth > 0) {
      if (clean[j] === "{") depth++;
      else if (clean[j] === "}") depth--;
      j++;
    }
    const body = clean.slice(open + 1, j - 1);
    if (selector.startsWith("@media")) {
      /* flatten one level */
      let k = 0;
      while (k < body.length) {
        const o2 = body.indexOf("{", k);
        if (o2 === -1) break;
        const sel2 = body.slice(k, o2).trim();
        let d2 = 1, m = o2 + 1;
        while (m < body.length && d2 > 0) {
          if (body[m] === "{") d2++;
          else if (body[m] === "}") d2--;
          m++;
        }
        rules.push({ selector: sel2, body: body.slice(o2 + 1, m - 1), media: selector });
        k = m;
      }
    } else {
      rules.push({ selector, body, media: null });
    }
    i = j;
  }
}

/* --- specificity: [ids, classes/attrs/pseudo-classes, elements] --------- */
const specificity = (sel) => {
  let s = sel;
  const ids = (s.match(/#[\w-]+/g) || []).length;
  s = s.replace(/#[\w-]+/g, "");
  const classes = (s.match(/\[[^\]]*\]|\.[\w-]+|:(?!:)[\w-]+/g) || []).length;
  s = s.replace(/\[[^\]]*\]|\.[\w-]+|:(?!:)[\w-]+/g, "");
  const els = (s.match(/\b[a-z][\w-]*\b/gi) || []).length;
  return ids * 10000 + classes * 100 + els;
};

/* the single colour a value means, in the theme's vocabulary */
const COLOURS = {
  WHITE: [255, 255, 255],
  SOFT: [0xdc, 0xe9, 0xff],
  MUTE: [0xc6, 0xdb, 0xff],
  FAINT: [0x4a, 0x5f, 0x7d],
  ARROW: [0x6f, 0xa8, 0xff],
};
const resolveValue = (v) => {
  if (/--mx-on-card\b/.test(v)) return "WHITE";
  if (/--mx-on-card-soft/.test(v)) return "SOFT";
  if (/--mx-on-card-mute/.test(v)) return "MUTE";
  if (/#4a5f7d/i.test(v)) return "FAINT";
  if (/#6fa8ff/i.test(v)) return "ARROW";
  if (/inherit/.test(v)) return "INHERIT";
  return null;
};

/* the page's own colours, for text the theme does not touch */
const ORIGINAL = {
  "text-primary":   [0x11, 0x52, 0xdf],
  "text-secondary": [0x0a, 0x31, 0x85],
  "text-slate-400": [0x94, 0xa3, 0xb8],
  "text-slate-500": [0x64, 0x74, 0x8b],
  "text-slate-600": [0x47, 0x55, 0x69],
  "text-slate-700": [0x33, 0x41, 0x55],
  "text-gray-600":  [0x4b, 0x55, 0x63],
  "text-slate-300": [0xcb, 0xd5, 0xe1],
  "text-yellow-400":[0xfa, 0xcc, 0x15],
};
const originalColour = (el) => {
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cls = n.getAttribute("class") || "";
    for (const [k, rgb] of Object.entries(ORIGINAL)) {
      if (new RegExp("(^|\\s)" + k + "($|\\s)").test(cls)) return { rgb, name: k };
    }
    if (n.tagName === "BODY") break;
  }
  return null;
};

/* --- what colour does an element end up with? --------------------------- */
function winner(el) {
  let best = null;
  for (const r of rules) {
    if (r.media) continue; /* the only @media rule is background-attachment */
    for (const sel of r.selector.split(/,(?![^(]*\))/)) {
      const s = sel.trim();
      if (!s) continue;
      let matches = false;
      try {
        matches = el.matches(s);
      } catch {
        continue;
      }
      if (!matches) continue;
      const m = /(?:^|;)\s*color\s*:\s*([^;]+)/.exec(";" + r.body);
      if (!m) continue;
      const cand = {
        colour: resolveValue(m[1]),
        important: /!important/.test(m[1]),
        spec: specificity(s),
        order: rules.indexOf(r),
      };
      if (!cand.colour) continue;
      if (
        !best ||
        (cand.important && !best.important) ||
        (cand.important === best.important && cand.spec > best.spec) ||
        (cand.important === best.important && cand.spec === best.spec && cand.order > best.order)
      ) {
        best = cand;
      }
    }
  }
  return best;
}

/* --- what background does an element sit on? ---------------------------- */
const blueCards = new Set();
const add = (e) => e && blueCards.add(e);
doc.querySelectorAll("#stats-container .apple-glass-card, #services .apple-glass-card, #reviews .apple-glass-card, #contact .apple-glass-card").forEach(add);
doc.querySelectorAll("#about .apple-glass-card").forEach((el) => {
  if (el.querySelector("img[alt*='About']") || el.textContent.includes("Premium Quality")) add(el);
});
doc.querySelectorAll("#team .apple-glass-card").forEach((el) => {
  if (!el.classList.contains("w-[200px]")) add(el);
});

const bgOf = (el) => {
  /* light surfaces that keep the page's own white glass */
  if (el.closest("#mobile-menu-drawer")) return "DRAWER";
  let n = el;
  while (n && n.nodeType === 1) {
    if (blueCards.has(n)) return "CARD";
    n = n.parentElement;
  }
  if (el.closest("footer")) return "FOOTER";
  /* any other .apple-glass-card stays the page's translucent white */
  if (el.closest(".apple-glass-card")) return "LIGHT";
  return "CANVAS";
};

const CARD_BG = [0x0b, 0x3f, 0xa8];
const FOOT_BG = [0x0b, 0x19, 0x30];
const CANVAS_BG = [0xdf, 0xea, 0xfe];

const lum = ([r, g, b]) => {
  const f = (c) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a, b) => {
  const l1 = lum(a), l2 = lum(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
};

/* --- walk every text node ----------------------------------------------- */
const problems = [];
const preExisting = [];
let checked = 0;
let forcedWhite = 0;

const walker = doc.createTreeWalker(doc.body, 4 /* SHOW_TEXT */);
let t;
while ((t = walker.nextNode())) {
  const text = t.textContent.replace(/\s+/g, " ").trim();
  if (!text) continue;
  const el = t.parentElement;
  if (!el || el.closest("script,style")) continue;

  /* CSS inheritance: the colour may be declared on any ancestor */
  let w = null, inheritedFrom = null;
  for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
    const cand = winner(n);
    if (cand) { w = cand; inheritedFrom = n; break; }
    if (n.tagName === "BODY") break;
  }
  let fg, label;
  if (w) {
    if (w.colour === "WHITE" || w.colour === "SOFT" || w.colour === "MUTE" || w.colour === "FAINT") forcedWhite++;
    fg = COLOURS[w.colour];
    label = "theme:" + w.colour;
  } else {
    const o = originalColour(el);
    if (!o) continue;
    fg = o.rgb;
    label = "page:" + o.name;
    w = { colour: "PAGE" };
  }

  const bg = bgOf(el);
  const back =
    bg === "CARD" ? CARD_BG :
    bg === "FOOTER" ? FOOT_BG :
    bg === "DRAWER" ? [0xff, 0xff, 0xff] :
    bg === "LIGHT" ? [0xfb, 0xfd, 0xff] :
    CANVAS_BG;

  checked++;
  const r = ratio(fg, back);

  /* white text is only acceptable on a card or the footer */
  if (w.colour === "WHITE" && (bg === "CANVAS" || bg === "DRAWER" || bg === "LIGHT")) {
    problems.push({ why: "white text on the light canvas", bg, label, text: text.slice(0, 40), ratio: r.toFixed(2) });
    continue;
  }
  if (r < 4.5) {
    /* was it already like this in the untouched original? */
    const originalHadIt = (() => {
      const o = new JSDOM(ORIGINAL_HTML).window.document;
      const same = [...o.querySelectorAll("*")].find((e) => e.textContent.trim() === text && e.children.length === 0);
      if (!same) return false;
      const oBg = same.closest(".apple-glass-card") ? "LIGHT" : "CANVAS";
      return `${text}`.length > 0 && (bg === "DRAWER" || oBg === "CANVAS");
    })();
    if (originalHadIt && /page:/.test(label)) {
      preExisting.push({ text, ratio: r.toFixed(2), label });
      continue;
    }
    const from = inheritedFrom ? `<${inheritedFrom.tagName.toLowerCase()} class="${(inheritedFrom.getAttribute("class") || "").slice(0, 30)}">` : "";
    problems.push({ why: label, bg, label, text: text.slice(0, 34), ratio: r.toFixed(2), from });
  }
}

console.log(`text nodes whose colour the theme forces: ${forcedWhite}`);
if (preExisting.length) {
  console.log(`\nlow-contrast text that is identical to the untouched original (not a regression):`);
  preExisting.forEach((p) => console.log(`   ${p.ratio.padStart(5)}  ${p.label.padEnd(22)} "${p.text}"`));
}
console.log(`text nodes resolved: ${checked}`);

if (problems.length) {
  console.log(`\n✗ ${problems.length} problem(s):`);
  problems.slice(0, 30).forEach((p) => console.log(`   ${p.bg.padEnd(7)} ${p.ratio.padStart(5)}  ${String(p.label).padEnd(22)} "${p.text}"  ${p.from || ""}`));
  process.exit(1);
}
console.log("\n✓ every forced colour resolves correctly against its real background");
