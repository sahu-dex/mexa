/**
 * MEXA MOTION — card contrast audit
 *
 * Walks the built page with the theme's cascade applied, works out what
 * background each piece of text actually sits on, and reports the WCAG ratio.
 *
 * Run:  node audit.mjs
 */

import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const dom = new JSDOM(html);
const doc = dom.window.document;

const CARD_A = [0x1b, 0x5c, 0xe8];
const CARD_B = [0x0b, 0x3f, 0xa8];
const WHITE = [255, 255, 255];
const FOOT_A = [0x0b, 0x19, 0x30];

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
const parse = (c) => {
  const m = /rgba?\(([\d.]+),\s*([\d.]+),\s*([\d.]+)/.exec(c);
  return m ? [+m[1], +m[2], +m[3]] : null;
};

/* which cards are painted blue, per the theme */
/* select structurally so Tailwind's slash classes need no escaping */
const blueCards = new Set();
const add = (el) => el && blueCards.add(el);

doc.querySelectorAll("#stats-container .apple-glass-card, #services .apple-glass-card, #reviews .apple-glass-card, #contact .apple-glass-card")
  .forEach(add);

/* about: the image frame, and the floating quality card */
doc.querySelectorAll("#about .apple-glass-card").forEach((el) => {
  if (el.querySelector("img[alt='About Mexa Motion Team']")) add(el);
  if (el.textContent.includes("Premium Quality")) add(el);
});

/* team: every card except the featured founder one */
doc.querySelectorAll("#team .apple-glass-card").forEach((el) => {
  if (!el.classList.contains("w-[200px]")) add(el);   /* founder stays light */
});
/* team caption blocks */
doc.querySelectorAll("#team .apple-glass-card:not(:has(.absolute.top-4)) > div.p-4")
  .forEach((el) => blueCards.add(el));

console.log(`cards painted blue: ${blueCards.size}`);

/* every leaf text node inside a blue card, or on the footer */
const problems = [];
let checked = 0;

const effectiveColour = (el) => {
  let n = el;
  while (n && n.nodeType === 1) {
    const cls = n.getAttribute("class") || "";
    /* what the theme forces */
    if (
      /text-primary/.test(cls) ||
      /text-secondary/.test(cls) ||
      /text-slate-400/.test(cls)
    ) {
      if (inBlue(n)) return WHITE;
      if (inFooter(n)) return WHITE;
      return null;
    }
    const inline = n.getAttribute("style") || "";
    const m = /color:\s*([^;]+)/.exec(inline);
    if (m) return parse(m[1]);
    n = n.parentElement;
  }
  return null;
};

const inBlue = (el) => {
  let n = el;
  while (n && n.nodeType === 1) {
    if (blueCards.has(n)) return true;
    n = n.parentElement;
  }
  return false;
};
const inFooter = (el) => !!el.closest("footer");

/* the theme's own colour decisions, mirrored */
const THEME = {
  "on-card": WHITE,
  "on-card-soft": [0xdc, 0xe9, 0xff],
  "on-card-mute": [0xc6, 0xdb, 0xff],
  footLink: [0x6f, 0xa8, 0xff],
};

for (const card of blueCards) {
  const walker = doc.createTreeWalker(card, dom.window.NodeFilter.SHOW_TEXT);
  let t;
  while ((t = walker.nextNode())) {
    const text = t.textContent.replace(/\s+/g, " ").trim();
    if (!text) continue;
    const el = t.parentElement;
    const cls = el.getAttribute("class") || "";
    if (el.closest(".faq-btn, button")) continue;

    /* skip the yellow star row and the photos */
    if (/text-yellow-400/.test(cls) || el.tagName === "IMG") continue;

    let fg;
    if (/text-primary|text-secondary/.test(cls)) fg = WHITE;
    else if (/text-slate-400|text-slate-500|text-gray-600/.test(cls)) fg = THEME["on-card-mute"];
    else continue;

    checked++;
    const r = ratio(fg, CARD_B); /* worst case = darker end of the gradient */
    if (r < 4.5) problems.push({ where: card.closest("section")?.id || "?", text: text.slice(0, 40), ratio: r.toFixed(2) });
  }
}

/* footer text */
for (const el of doc.querySelectorAll("footer h4, footer p, footer a, footer span")) {
  const text = (el.textContent || "").replace(/\s+/g, " ").trim();
  if (!text || el.querySelector("*")) continue;
  checked++;
  const cls = el.getAttribute("class") || "";
  const fg = /text-slate-500|text-slate-600|text-slate-400/.test(cls) || el.closest("p")
    ? THEME["on-card-soft"]
    : WHITE;
  const r = ratio(fg, FOOT_A);
  if (r < 4.5) problems.push({ where: "footer", text: text.slice(0, 40), ratio: r.toFixed(2) });
}

console.log(`text nodes checked: ${checked}`);
if (problems.length) {
  console.log(`\n✗ ${problems.length} low-contrast:`);
  problems.forEach((p) => console.log(`   ${p.where.padEnd(14)} ${p.ratio}  "${p.text}"`));
  process.exit(1);
} else {
  console.log("\n✓ every text node on a blue card / navy footer is readable (≥ 4.5:1)");
}
