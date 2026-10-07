/**
 * UAT evidence runner helpers — login by API, drive the portal in Chromium, one screenshot per evidence ID.
 * Env: UAT_BASE (default http://localhost:4555), UAT_OUT (screenshot folder), UAT_PASSWORD (default Demo@1234).
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let playwright;
try {
  playwright = require("playwright");
} catch {
  playwright = require(path.join(process.env.PW_ROOT || "", "index.js"));
}

export const BASE = process.env.UAT_BASE || "http://localhost:4555";
export const OUT = process.env.UAT_OUT || path.resolve("docs/uat-evidence");
const PASSWORD = process.env.UAT_PASSWORD || "Demo@1234";
fs.mkdirSync(OUT, { recursive: true });

export const results = [];
const tokens = new Map();

export async function login(email) {
  if (tokens.has(email)) return tokens.get(email);
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!body.token) throw new Error(`login ${email}: ${JSON.stringify(body).slice(0, 200)}`);
  tokens.set(email, body.token);
  return body.token;
}

/** JSON / multipart API call as a login. Returns { status, body }. */
export async function call(email, method, url, payload, { form } = {}) {
  const token = await login(email);
  const headers = { authorization: `Bearer ${token}` };
  let body;
  if (form) body = form;
  else if (payload !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(payload);
  }
  const res = await fetch(`${BASE}${url}`, { method, headers, body });
  const text = await res.text();
  let parsed = text;
  try {
    parsed = JSON.parse(text);
  } catch {
    /* binary / html */
  }
  return { status: res.status, body: parsed, bytes: text.length, type: res.headers.get("content-type") || "" };
}

let browser;
const pages = new Map();
/** A logged-in page per user (session token injected, as the portal stores it). */
export async function pageFor(email) {
  if (pages.has(email)) return pages.get(email);
  browser ||= await playwright.chromium.launch();
  const token = await login(email);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await ctx.addInitScript((t) => sessionStorage.setItem("sharnam_token", t), token);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`  [pageerror ${email}] ${e.message}`));
  pages.set(email, page);
  return page;
}

export async function open(page, url) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(600);
}

/** Screenshot (full page or a locator) and record the evidence row. */
export async function evidence(id, title, login, page, { ok = true, note = "", target, full = false } = {}) {
  const file = `${id}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48)}.png`;
  try {
    if (target) await target.screenshot({ path: path.join(OUT, file) });
    else await page.screenshot({ path: path.join(OUT, file), fullPage: full });
  } catch (e) {
    await page.screenshot({ path: path.join(OUT, file) }).catch(() => {});
    note = `${note} (screenshot fallback: ${e.message.split("\n")[0]})`.trim();
  }
  results.push({ id, title, login, ok, note, file });
  console.log(`${ok ? "PASS" : "FAIL"} ${id} ${title}${note ? ` — ${note}` : ""}`);
}

/** Run a step; a thrown error is recorded as FAIL with a screenshot of where it stopped. */
export async function step(id, title, login, fn) {
  const page = await pageFor(login);
  try {
    await fn(page);
  } catch (e) {
    await evidence(id, title, login, page, { ok: false, note: e.message.split("\n")[0].slice(0, 300) });
  }
}

export async function finish() {
  fs.writeFileSync(path.join(OUT, "results.json"), JSON.stringify(results, null, 2));
  await browser?.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length} / ${results.length} passed`);
  return failed.length;
}
