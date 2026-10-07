"""
Build the shared UAT tracker page from docs/UAT_PRODUCTION.md.

    python3 scripts/uat-evidence/tracker.py docs/UAT_PRODUCTION.md <out.html>

Every table row whose first cell is a step ID (OFF-12, SITE-3 …) becomes a trackable step; the logins, data map
and rhythm tables are kept as reference. Results (Pass / Fail / Blocked + note) are stored in the artifact's
shared `db` (collection `results`, one document per project and step) so every tester sees them live.
"""
import html
import json
import re
import sys

PROJECTS = [
    ("SPDC-ARVIND-01", "Arvind dormitory"),
    ("SPDC-ARVIND-NTX", "Arvind NTX"),
    ("SPDC-VOLTAMP-01", "Voltamp onboarding"),
]


def inline(md: str) -> str:
    t = html.escape(md)
    t = re.sub(r"`([^`]+)`", r"<code>\1</code>", t)
    t = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", t)
    t = re.sub(r"(?<!\*)\*([^*]+)\*(?!\*)", r"<em>\1</em>", t)
    return t


def cells(line: str):
    return [c.strip() for c in line.strip().strip("|").split("|")]


def main():
    src, out = sys.argv[1], sys.argv[2]
    lines = open(src, encoding="utf-8").read().split("\n")
    sections, steps, reference = [], [], []
    title, sub, header, ref_rows = "", "", None, None
    for raw in lines + ["## end"]:
        line = raw.rstrip()
        if line.startswith("## "):
            if ref_rows:
                reference.append({"title": title, "header": ref_header, "rows": ref_rows})
            ref_rows, header = None, None
            title = re.sub(r"^##\s+", "", line)
            title = re.sub(r"^\d+\.\s*", "", title).replace("`", "")
            sub = ""
            continue
        m = re.match(r"^\*\*(.+)\*\*$", line.strip())
        if m:
            sub = m.group(1)
            continue
        if not line.startswith("|"):
            header = None
            continue
        row = cells(line)
        if all(re.fullmatch(r"-+", c) for c in row):
            continue
        if header is None:
            header = [c.lower() for c in row]
            ref_header = row
            continue
        if re.fullmatch(r"[A-Z]{2,4}-\d+", row[0]):
            rec = {"id": row[0], "section": title, "group": sub}
            for h, v in zip(header, row):
                if h.startswith("cad"):
                    rec["cadence"] = v
                elif h == "login":
                    rec["login"] = v
                elif h in ("step", "check"):
                    rec["step"] = inline(v)
                elif "expected" in h or h == "✅":
                    rec["expected"] = inline(v)
            steps.append(rec)
            if title not in sections:
                sections.append(title)
        else:
            ref_rows = ref_rows or []
            ref_rows.append([inline(c) for c in row])
    reference = [r for r in reference if r["title"] and not r["title"].startswith("end")]

    data = json.dumps({"steps": steps, "sections": sections, "projects": PROJECTS, "reference": reference}, ensure_ascii=False)
    page = TEMPLATE.replace("__DATA__", data.replace("</", "<\\/"))
    open(out, "w", encoding="utf-8").write(page)
    print(f"{out} · {len(steps)} steps in {len(sections)} sections · {len(reference)} reference tables")


TEMPLATE = r"""<title>Sharnam UAT Tracker</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: test log — project switch + score strip on top; sections of steps with Pass / Fail / Blocked controls. */
:root {
  --paper: #f6f5f1; --card: #ffffff; --ink: #1d2327; --muted: #5b6770; --line: #dcdfd9; --soft: #eef3f2;
  --teal: #0b6a78; --orange: #e4632a; --ok: #2f7d4f; --okbg: #e3f1e8; --bad: #b3261e; --badbg: #fbe6e4; --warn: #9a6100; --warnbg: #fbf0d9;
  --display: "Syne", "Segoe UI", sans-serif; --body: "Instrument Sans", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #121719; --card: #1a2124; --ink: #e8ecea; --muted: #9aa7ad; --line: #2c3539; --soft: #1f292c;
  --teal: #4fb3c2; --orange: #f08a57; --ok: #7fcf9c; --okbg: #1d3427; --bad: #f2948c; --badbg: #3a1f1d; --warn: #e8b85c; --warnbg: #3a2e14; color-scheme: dark; } }
:root[data-theme="dark"] {
  --paper: #121719; --card: #1a2124; --ink: #e8ecea; --muted: #9aa7ad; --line: #2c3539; --soft: #1f292c;
  --teal: #4fb3c2; --orange: #f08a57; --ok: #7fcf9c; --okbg: #1d3427; --bad: #f2948c; --badbg: #3a1f1d; --warn: #e8b85c; --warnbg: #3a2e14; color-scheme: dark; }
body { background: var(--paper); color: var(--ink); font: 15px/1.55 var(--body); }
.wrap { max-width: 1180px; margin: 0 auto; padding-inline: 18px; padding-block: 24px 64px; }
header.top { display: flex; flex-wrap: wrap; gap: 16px; align-items: end; justify-content: space-between; border-bottom: 3px solid var(--teal); padding-bottom: 14px; }
.eyebrow { font: 500 12px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--orange); }
h1 { font: 700 clamp(26px, 4vw, 36px)/1.1 var(--display); margin: 4px 0 6px; text-wrap: balance; }
.top p { margin: 0; color: var(--muted); max-width: 64ch; }
.mode { font: 500 12px var(--mono); color: var(--muted); }
.mode.live { color: var(--ok); } .mode.local { color: var(--warn); }
.bar { display: flex; flex-wrap: wrap; gap: 8px; margin: 16px 0 10px; }
.bar button, .chips button { font: 600 13px var(--body); border: 1px solid var(--line); background: var(--card); color: var(--ink); padding: 7px 12px; border-radius: 6px; cursor: pointer; }
.bar button[aria-pressed="true"] { background: var(--teal); border-color: var(--teal); color: var(--card); }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 14px; }
.chips button { font-size: 12px; padding: 5px 10px; border-radius: 99px; }
.chips button[aria-pressed="true"] { border-color: var(--orange); color: var(--orange); }
button:focus-visible, input:focus-visible { outline: 2px solid var(--orange); outline-offset: 2px; }
.score { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; margin-bottom: 18px; }
.score div { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 10px 12px; }
.score b { display: block; font: 700 24px var(--display); font-variant-numeric: tabular-nums; }
.score span { font: 500 11px var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
.score .p b { color: var(--ok); } .score .f b { color: var(--bad); } .score .k b { color: var(--warn); }
.meter { height: 8px; border-radius: 99px; background: var(--soft); overflow: hidden; display: flex; margin: -8px 0 18px; }
.meter i { display: block; height: 100%; }
section.sec { margin-bottom: 28px; }
.sec h2 { font: 700 20px var(--display); margin: 0 0 8px; display: flex; gap: 10px; align-items: baseline; flex-wrap: wrap; text-wrap: balance; }
.sec h2 small { font: 500 12px var(--mono); color: var(--muted); }
.grp { font: 600 12px var(--mono); text-transform: uppercase; letter-spacing: .06em; color: var(--teal); margin: 14px 0 6px; }
.step { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; gap: 6px 14px; background: var(--card); border: 1px solid var(--line); border-left: 4px solid var(--line); border-radius: 8px; padding: 10px 12px; margin-bottom: 6px; }
.step.pass { border-left-color: var(--ok); } .step.fail { border-left-color: var(--bad); } .step.blocked { border-left-color: var(--warn); }
.sid { font: 600 13px var(--mono); color: var(--teal); }
.sid small { display: block; font: 500 11px var(--mono); color: var(--muted); }
.txt { min-width: 0; }
.txt .what { overflow-wrap: anywhere; }
.txt .exp { color: var(--muted); font-size: 14px; margin-top: 2px; overflow-wrap: anywhere; }
.txt .exp::before { content: "Expected · "; font: 600 11px var(--mono); text-transform: uppercase; letter-spacing: .05em; color: var(--teal); }
.acts { display: flex; gap: 4px; align-items: start; }
.acts button { font: 600 12px var(--mono); border: 1px solid var(--line); background: var(--card); color: var(--muted); padding: 5px 9px; border-radius: 5px; cursor: pointer; }
.acts button[data-s="pass"][aria-pressed="true"] { background: var(--okbg); color: var(--ok); border-color: var(--ok); }
.acts button[data-s="fail"][aria-pressed="true"] { background: var(--badbg); color: var(--bad); border-color: var(--bad); }
.acts button[data-s="blocked"][aria-pressed="true"] { background: var(--warnbg); color: var(--warn); border-color: var(--warn); }
.note { grid-column: 2 / 4; display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.note input { flex: 1 1 260px; min-width: 0; font: 14px var(--body); color: var(--ink); background: var(--paper); border: 1px solid var(--line); border-radius: 5px; padding: 5px 8px; }
.who { font: 12px var(--mono); color: var(--muted); }
code { font: 12.5px var(--mono); background: var(--soft); padding: 1px 4px; border-radius: 3px; overflow-wrap: anywhere; }
.ref { overflow-x: auto; background: var(--card); border: 1px solid var(--line); border-radius: 8px; margin-bottom: 18px; }
.ref table { border-collapse: collapse; width: 100%; font-size: 14px; }
.ref th, .ref td { text-align: left; vertical-align: top; padding: 8px 10px; border-bottom: 1px solid var(--line); }
.ref th { font: 600 12px var(--mono); text-transform: uppercase; letter-spacing: .04em; color: var(--teal); background: var(--soft); }
.ref h3 { font: 700 17px var(--display); margin: 0; padding: 12px 12px 4px; }
@media (max-width: 640px) {
  .step { grid-template-columns: 1fr; }
  .note { grid-column: 1; }
  .acts { flex-wrap: wrap; }
}
@media (prefers-reduced-motion: no-preference) { .step { transition: border-color .15s; } }
</style>
<div class="wrap">
  <header class="top">
    <div>
      <div class="eyebrow">Sharnam PMC portal · production UAT</div>
      <h1>UAT tracker — every user, every module</h1>
      <p>Pick the project, work through your login's steps on portal.spdc.in, and mark each one. Attach the screenshot named by the step ID in your evidence folder.</p>
    </div>
    <div class="mode" id="mode">Loading shared results…</div>
  </header>
  <div class="bar" id="projects" role="group" aria-label="Project"></div>
  <div class="chips" id="filters" role="group" aria-label="Section"></div>
  <div class="score" id="score"></div>
  <div class="meter" id="meter" aria-hidden="true"></div>
  <main id="list"></main>
  <section id="refs" aria-label="Reference"></section>
</div>
<script>
const DATA = __DATA__;
const state = { project: DATA.projects[0][0], filter: "all", results: {}, db: null, user: null, me: null, readOnly: false };
const key = (p, s) => `${p}__${s}`;
const $ = (id) => document.getElementById(id);

function local() { try { return JSON.parse(localStorage.getItem("uat-results") || "{}"); } catch { return {}; } }
function saveLocal() { try { localStorage.setItem("uat-results", JSON.stringify(state.results)); } catch {} }

function renderBars() {
  const pj = $("projects"); pj.replaceChildren();
  for (const [code, name] of DATA.projects) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = `${code} · ${name}`; b.setAttribute("aria-pressed", String(state.project === code));
    b.onclick = () => { state.project = code; render(); };
    pj.append(b);
  }
  const fl = $("filters"); fl.replaceChildren();
  for (const s of ["all", ...DATA.sections]) {
    const b = document.createElement("button");
    b.type = "button"; b.textContent = s === "all" ? "All sections" : s.split(/ [(—]/)[0];
    b.setAttribute("aria-pressed", String(state.filter === s));
    b.onclick = () => { state.filter = s; render(); };
    fl.append(b);
  }
}

function renderScore() {
  const steps = DATA.steps;
  const c = { pass: 0, fail: 0, blocked: 0 };
  for (const s of steps) { const r = state.results[key(state.project, s.id)]; if (r && c[r.status] != null) c[r.status]++; }
  const open = steps.length - c.pass - c.fail - c.blocked;
  const sc = $("score"); sc.replaceChildren();
  for (const [cls, n, label] of [["", steps.length, "steps"], ["p", c.pass, "passed"], ["f", c.fail, "failed"], ["k", c.blocked, "blocked"], ["", open, "not run"]]) {
    const d = document.createElement("div"); if (cls) d.className = cls;
    const b = document.createElement("b"); b.textContent = n; const sp = document.createElement("span"); sp.textContent = label;
    d.append(b, sp); sc.append(d);
  }
  const m = $("meter"); m.replaceChildren();
  for (const [n, color] of [[c.pass, "var(--ok)"], [c.fail, "var(--bad)"], [c.blocked, "var(--warn)"]]) {
    const i = document.createElement("i"); i.style.width = `${(100 * n) / steps.length}%`; i.style.background = color; m.append(i);
  }
}

async function write(stepId, patch) {
  const k = key(state.project, stepId);
  const prev = state.results[k] || {};
  const next = { project: state.project, step: stepId, status: prev.status || "", note: prev.note || "", ...patch, at: new Date().toISOString(), by: state.me || null };
  state.results[k] = next;
  render();
  if (!state.db) { saveLocal(); return; }
  try { await state.db.collection("results").doc(k).set(next); }
  catch (e) {
    if (e && e.code === "invalid_argument") { state.readOnly = true; $("mode").textContent = "View only — your sharing level cannot record results"; }
    else $("mode").textContent = "Could not save — check your connection and mark the step again";
    render();
  }
}

let renderGen = 0;
let renderQueued = false;
/** Renders run after the current event (a blur-triggered save must not rebuild the list mid-event). */
function render() {
  if (renderQueued) return;
  renderQueued = true;
  setTimeout(() => { renderQueued = false; paint(); }, 0);
}
async function paint() {
  const gen = ++renderGen;
  renderBars(); renderScore();
  const ids = [...new Set(Object.values(state.results).map((r) => r.by).filter(Boolean))];
  const people = state.user && ids.length ? await state.user.profiles(ids) : {};
  if (gen !== renderGen) return; // a newer render is painting
  // Keep a note being typed (live updates from other testers re-render the list).
  const active = document.activeElement && document.activeElement.id?.startsWith("note-") ? document.activeElement : null;
  const keep = active ? { id: active.id, value: active.value, start: active.selectionStart, end: active.selectionEnd } : null;
  const list = $("list"); list.replaceChildren();
  for (const sec of DATA.sections) {
    if (state.filter !== "all" && state.filter !== sec) continue;
    const steps = DATA.steps.filter((s) => s.section === sec);
    const done = steps.filter((s) => state.results[key(state.project, s.id)]?.status).length;
    const el = document.createElement("section"); el.className = "sec";
    const h = document.createElement("h2"); h.textContent = sec;
    const sm = document.createElement("small"); sm.textContent = `${done}/${steps.length} marked`; h.append(sm); el.append(h);
    let group = null;
    for (const s of steps) {
      if (s.group && s.group !== group) { group = s.group; const g = document.createElement("div"); g.className = "grp"; g.textContent = group; el.append(g); }
      const r = state.results[key(state.project, s.id)] || {};
      const row = document.createElement("article"); row.className = `step ${r.status || ""}`;
      const sid = document.createElement("div"); sid.className = "sid"; sid.textContent = s.id;
      const meta = [s.cadence, s.login].filter(Boolean).join(" · ");
      if (meta) { const sm2 = document.createElement("small"); sm2.textContent = meta; sid.append(sm2); }
      const txt = document.createElement("div"); txt.className = "txt";
      const what = document.createElement("div"); what.className = "what"; what.innerHTML = s.step || "";
      const exp = document.createElement("div"); exp.className = "exp"; exp.innerHTML = s.expected || "";
      txt.append(what, exp);
      const acts = document.createElement("div"); acts.className = "acts";
      for (const [st, label] of [["pass", "Pass"], ["fail", "Fail"], ["blocked", "Blocked"]]) {
        const b = document.createElement("button"); b.type = "button"; b.dataset.s = st; b.textContent = label;
        b.setAttribute("aria-pressed", String(r.status === st)); b.disabled = state.readOnly;
        b.onclick = () => write(s.id, { status: r.status === st ? "" : st });
        acts.append(b);
      }
      const note = document.createElement("div"); note.className = "note";
      const inp = document.createElement("input"); inp.id = `note-${s.id}`; inp.placeholder = "Note — what you saw, screenshot name, failure detail";
      inp.value = r.note || ""; inp.disabled = state.readOnly;
      inp.onchange = () => { if (inp.value !== (r.note || "")) write(s.id, { note: inp.value }); };
      const who = document.createElement("span"); who.className = "who";
      if (r.at && (r.status || r.note)) {
        const name = r.by ? people[r.by]?.name || "Someone" : "This browser";
        who.textContent = `${name} · ${new Date(r.at).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}`;
      }
      note.append(inp, who);
      row.append(sid, txt, acts, note);
      el.append(row);
    }
    list.append(el);
  }
  if (keep) {
    const el2 = document.getElementById(keep.id);
    if (el2) { el2.value = keep.value; el2.focus(); try { el2.setSelectionRange(keep.start, keep.end); } catch {} }
  }
}

function renderRefs() {
  const box = $("refs");
  for (const t of DATA.reference) {
    const wrap = document.createElement("div"); wrap.className = "ref";
    const h = document.createElement("h3"); h.textContent = t.title; wrap.append(h);
    const table = document.createElement("table");
    const thead = document.createElement("tr");
    for (const c of t.header) { const th = document.createElement("th"); th.textContent = c.replace(/\*\*/g, ""); thead.append(th); }
    table.append(thead);
    for (const r of t.rows) { const tr = document.createElement("tr"); for (const c of r) { const td = document.createElement("td"); td.innerHTML = c; tr.append(td); } table.append(tr); }
    wrap.append(table); box.append(wrap);
  }
}

state.results = local();
renderRefs();
render();

(async () => {
  const [db, user] = await Promise.all([window.claude?.use?.("db") ?? null, window.claude?.use?.("user") ?? null]);
  state.user = user;
  if (!db) { $("mode").textContent = "Results saved in this browser only"; $("mode").className = "mode local"; return; }
  state.db = db;
  state.me = user ? await user.id() : null;
  const canWrite = user ? await user.can("data.write") : null;
  if (canWrite === false) state.readOnly = true;
  $("mode").textContent = state.readOnly ? "View only — results are shared" : "Shared results · live for every tester";
  $("mode").className = "mode live";
  db.collection("results").onSnapshot((snap) => {
    const next = {};
    for (const d of snap.docs) { const v = d.data(); if (v) next[d.id] = v; }
    state.results = next;
    render();
  }, () => { $("mode").textContent = "Live updates stopped — reload the page"; $("mode").className = "mode local"; });
})();
</script>
"""

if __name__ == "__main__":
    main()
