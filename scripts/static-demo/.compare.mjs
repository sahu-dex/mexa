/**
 * UI fidelity check: compare the DOM produced by the original page pipeline
 * (pre-render pass) with the shipped static page DOM.
 */
import { JSDOM, VirtualConsole } from "jsdom";
import { readFileSync, writeFileSync } from "node:fs";
import { renderPage, ROUTES } from "/home/user/mexa/scripts/static-demo/blade.mjs";
import { transformScripts } from "/home/user/mexa/scripts/static-demo/scripts.mjs";

const ROOT = "/home/user/mexa";
const siteData = JSON.parse(readFileSync(`${ROOT}/static-site/data/site-data.json`, "utf8"));
const PAGE_FILES = { home: "index.html", work: "work.html", service: "service.html", team: "team.html", reviews: "review.html", booking: "book.html" };

const snapshot = {
  "/api/public/content": { ...siteData.content, purchase: siteData.purchase },
  "/api/public/services": { services: siteData.services },
  "/api/public/packages": { packages: siteData.packages },
  "/api/public/team": siteData.team,
  "/api/public/work": siteData.work,
  "/api/public/reviews": siteData.reviews,
  "/api/public/contact": siteData.contact,
  "/api/public/videos": { videos: siteData.videos },
};

function tokens(phase) {
  return {
    assetVersion: "1",
    publicVideosJson: JSON.stringify(siteData.videos),
    serviceIntro: siteData.content.services_intro,
    routes: ROUTES,
    bootstrapHtml: phase === "prerender"
      ? `<script id="demo-bridge">\nwindow.__MM_SNAPSHOT__ = ${JSON.stringify(snapshot)};\nwindow.__MM_DEMO_DATA__ = ${JSON.stringify(siteData)};\n</script>`
      : '<script id="demo-bridge"></script>',
  };
}

function inert(window) {
  const mem = () => { const d = new Map(); return { getItem:k=>d.has(String(k))?d.get(String(k)):null, setItem:(k,v)=>d.set(String(k),String(v)), removeItem:k=>d.delete(String(k)), clear:()=>d.clear(), key:i=>Array.from(d.keys())[Number(i)]??null, get length(){return d.size;} }; };
  Object.defineProperty(window, "localStorage", { configurable: true, value: mem() });
  Object.defineProperty(window, "sessionStorage", { configurable: true, value: mem() });
  window.fetch = () => Promise.reject(new TypeError("offline"));
  window.matchMedia = window.matchMedia || ((q) => ({ matches:false, media:q, addListener(){}, removeListener(){}, addEventListener(){}, removeEventListener(){}, dispatchEvent(){return false;} }));
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  window.requestAnimationFrame = (cb) => setTimeout(() => cb(0), 0);
  window.cancelAnimationFrame = (id) => clearTimeout(id);
}

function summarize(document) {
  const rows = [];
  document.querySelectorAll("body *").forEach((el) => {
    if (["SCRIPT", "STYLE", "LINK", "META", "TEMPLATE", "NOSCRIPT"].includes(el.tagName)) return;
    const cls = Array.from(el.classList).sort().join(".");
    const text = el.children.length === 0 ? el.textContent.replace(/\s+/g, " ").trim().slice(0, 60) : "";
    rows.push(`${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""}${cls ? "." + cls : ""}${text ? " :: " + text : ""}`);
  });
  return rows;
}

const page = process.argv[2];
const file = PAGE_FILES[page];
const liveHtml = renderPage({ root: ROOT, page, tokens: tokens("prerender"), phase: "prerender" });
const liveDom = new JSDOM(transformScripts(liveHtml, page, "prerender"), { url: "https://demo.local/index.html", runScripts: "dangerously", pretendToBeVisual: true, beforeParse: inert });
const staticHtml = readFileSync(`${ROOT}/static-site/${file}`, "utf8");
const staticDom = new JSDOM(staticHtml, { url: "https://demo.local/index.html", runScripts: "outside-only", pretendToBeVisual: true, beforeParse: inert });

setTimeout(() => {
  const a = summarize(liveDom.window.document);
  const b = summarize(staticDom.window.document);
  const setA = new Map(); a.forEach((r) => setA.set(r, (setA.get(r) || 0) + 1));
  const setB = new Map(); b.forEach((r) => setB.set(r, (setB.get(r) || 0) + 1));
  const onlyLive = [], onlyStatic = [];
  for (const [k, v] of setA) if ((setB.get(k) || 0) !== v) onlyLive.push(`${k}  (${v} live vs ${setB.get(k) || 0} static)`);
  for (const [k, v] of setB) if ((setA.get(k) || 0) !== v) onlyStatic.push(`${k}  (${setA.get(k) || 0} live vs ${v} static)`);
  console.log(`\n### ${page} · elements live=${a.length} static=${b.length}`);
  if (onlyLive.length) { console.log(" -- only/different in LIVE:"); onlyLive.slice(0, 25).forEach((x) => console.log("   " + x.slice(0, 160))); }
  if (onlyStatic.length) { console.log(" -- only/different in STATIC:"); onlyStatic.slice(0, 25).forEach((x) => console.log("   " + x.slice(0, 160))); }
  const errors = [];
  console.log(` body text live=${liveDom.window.document.body.textContent.replace(/\s+/g," ").length} static=${staticDom.window.document.body.textContent.replace(/\s+/g," ").length}`);
  writeFileSync(`/tmp/work/dom-live-${page}.txt`, a.join("\n"));
  writeFileSync(`/tmp/work/dom-static-${page}.txt`, b.join("\n"));
  process.exit(0);
}, 900);
