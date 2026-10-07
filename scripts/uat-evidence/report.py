"""
Build a single self-contained UAT evidence page from an evidence run.

    python3 scripts/uat-evidence/report.py <evidence-dir> <out.html> [project-code]

Reads <evidence-dir>/results.json (written by run.mjs) and the screenshots beside it; screenshots are embedded
as compressed JPEG so the page can be shared on its own.
"""
import base64
import html
import io
import json
import sys
from datetime import date
from pathlib import Path

from PIL import Image

SECTIONS = [
    ("A", "Project setup", "Office creates the project, assigns team, contractor and client; site staff check in."),
    ("B", "Cost — SPDC budget workbook", "Every budget-sheet tab loaded; sections, MB and BBS rows entered; branded downloads; saved to SharePoint."),
    ("C", "Finance — PO → RA bill → COP", "Contractor raises the bill, PMC checks and certifies, the COP fills itself; PDFs and trackers to SharePoint."),
    ("D", "Quality — QAP, cubes, NCR / CAR", "Site raises, contractor answers from the action desk, only PMC closes."),
    ("E", "Safety — daily log and notices", "Safety NCR issued to the contractor, answered, closed by PMC; week pack published."),
    ("F", "Progress — DPR daily, WPR weekly", "DPR with S-curve, Planned vs Actual, registers, S-curve baseline, weekly pack."),
    ("G", "Logins and dashboards", "What each login sees: site, contractor, client, and the office dashboards."),
]
CADENCE = {"A3": "Daily", "A3b": "Daily", "B4": "Daily", "B5": "Daily", "D2": "Daily", "D3": "Daily", "E1": "Daily", "F1": "Daily",
           "B6": "Weekly", "C7": "Weekly", "D1": "Weekly", "D8": "Weekly", "E6": "Weekly", "F2": "Weekly", "F5": "Weekly"}
LOGIN = {
    "operations@spdc.in": "Office",
    "hitesh.rajput@spdc.in": "Site",
    "planning.estimation@spdc.in": "Planning",
    "site@bhavanainfra.demo": "Contractor",
    "projects@arvind.demo": "Client",
}


def shot(path: Path) -> str:
    im = Image.open(path).convert("RGB")
    if im.width > 1280:
        im = im.resize((1280, round(im.height * 1280 / im.width)))
    if im.height > 2400:
        im = im.crop((0, 0, im.width, 2400))
    buf = io.BytesIO()
    im.save(buf, "JPEG", quality=68, optimize=True)
    return "data:image/jpeg;base64," + base64.b64encode(buf.getvalue()).decode()


def main():
    folder, out = Path(sys.argv[1]), Path(sys.argv[2])
    code = sys.argv[3] if len(sys.argv) > 3 else "SPDC-UAT"
    rows = json.loads((folder / "results.json").read_text())
    passed = sum(1 for r in rows if r["ok"])
    e = html.escape

    nav, body = [], []
    for key, title, blurb in SECTIONS:
        items = [r for r in rows if r["id"].startswith(key)]
        if not items:
            continue
        ok = sum(1 for r in items if r["ok"])
        nav.append(f'<a href="#s{key}"><span class="k">{key}</span>{e(title)}<span class="c {"ok" if ok == len(items) else "bad"}">{ok}/{len(items)}</span></a>')
        cards = []
        for r in items:
            img = folder / r["file"]
            pic = f'<img loading="lazy" src="{shot(img)}" alt="Screenshot {e(r["id"])} — {e(r["title"])}">' if img.exists() else ""
            cad = CADENCE.get(r["id"], "Project")
            cards.append(
                f'<article class="ev"><header><span class="id">{e(r["id"])}</span><h3>{e(r["title"])}</h3>'
                f'<span class="pill {"ok" if r["ok"] else "bad"}">{"Pass" if r["ok"] else "Fail"}</span></header>'
                f'<p class="meta"><span>{e(LOGIN.get(r["login"], r["login"]))} login</span><span>{cad}</span><span class="mono">{e(r["file"])}</span></p>'
                + (f'<p class="note">{e(r["note"])}</p>' if r.get("note") else "")
                + f'<details><summary>Screenshot</summary>{pic}</details></article>'
            )
        body.append(f'<section id="s{key}"><h2><span class="k">{key}</span>{e(title)}</h2><p class="lede">{e(blurb)}</p>{"".join(cards)}</section>')

    page = f"""<title>{e(code)} UAT Evidence</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=Instrument+Sans:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: register-style evidence log — section index on the left, evidence cards in ID order on the right. */
:root {{
  --paper: #f6f5f1; --card: #ffffff; --ink: #1d2327; --muted: #5b6770; --line: #dcdfd9;
  --teal: #0b6a78; --orange: #e4632a; --ok: #2f7d4f; --okbg: #e3f1e8; --bad: #b3261e; --badbg: #fbe6e4;
  --display: "Syne", "Segoe UI", sans-serif; --body: "Instrument Sans", "Segoe UI", system-ui, sans-serif; --mono: "IBM Plex Mono", ui-monospace, monospace;
}}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) {{
  --paper: #121719; --card: #1a2124; --ink: #e8ecea; --muted: #9aa7ad; --line: #2c3539;
  --teal: #4fb3c2; --orange: #f08a57; --ok: #7fcf9c; --okbg: #1d3427; --bad: #f2948c; --badbg: #3a1f1d; color-scheme: dark; }} }}
:root[data-theme="dark"] {{
  --paper: #121719; --card: #1a2124; --ink: #e8ecea; --muted: #9aa7ad; --line: #2c3539;
  --teal: #4fb3c2; --orange: #f08a57; --ok: #7fcf9c; --okbg: #1d3427; --bad: #f2948c; --badbg: #3a1f1d; color-scheme: dark; }}
body {{ background: var(--paper); color: var(--ink); font: 15px/1.55 var(--body); }}
.wrap {{ max-width: 1180px; margin: 0 auto; padding-inline: 20px; padding-block: 28px 64px; }}
.top {{ display: flex; flex-wrap: wrap; align-items: end; justify-content: space-between; gap: 16px; border-bottom: 3px solid var(--teal); padding-bottom: 16px; }}
.top h1 {{ font: 700 clamp(26px, 4vw, 38px)/1.1 var(--display); margin: 4px 0 6px; text-wrap: balance; }}
.eyebrow {{ font: 500 12px var(--mono); letter-spacing: .08em; text-transform: uppercase; color: var(--orange); }}
.top p {{ margin: 0; color: var(--muted); max-width: 62ch; }}
.score {{ font: 700 44px/1 var(--display); color: var(--teal); font-variant-numeric: tabular-nums; }}
.score small {{ display: block; font: 500 12px var(--mono); color: var(--muted); letter-spacing: .06em; text-transform: uppercase; margin-top: 4px; }}
.grid {{ display: grid; grid-template-columns: 250px minmax(0, 1fr); gap: 28px; margin-top: 24px; }}
nav {{ position: sticky; top: calc(env(safe-area-inset-top, 0px) + 12px); align-self: start; display: grid; gap: 4px; }}
nav a {{ display: grid; grid-template-columns: 22px 1fr auto; gap: 8px; align-items: center; padding: 8px 10px; border-radius: 6px; color: var(--ink); text-decoration: none; font-size: 14px; }}
nav a:hover, nav a:focus-visible {{ background: var(--card); outline: 1px solid var(--line); }}
.k {{ font: 600 13px var(--mono); color: var(--teal); }}
.c {{ font: 500 12px var(--mono); font-variant-numeric: tabular-nums; }}
.c.ok {{ color: var(--ok); }} .c.bad {{ color: var(--bad); }}
section {{ margin-bottom: 36px; min-width: 0; }}
section h2 {{ font: 700 22px var(--display); margin: 0 0 4px; display: flex; gap: 10px; align-items: baseline; text-wrap: balance; }}
.lede {{ color: var(--muted); margin: 0 0 14px; max-width: 70ch; }}
.ev {{ background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px 16px; margin-bottom: 10px; min-width: 0; }}
.ev header {{ display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }}
.ev h3 {{ margin: 0; font-size: 16px; font-weight: 600; flex: 1 1 240px; }}
.id {{ font: 600 13px var(--mono); color: var(--card); background: var(--teal); padding: 2px 8px; border-radius: 4px; }}
.pill {{ font: 600 12px var(--mono); padding: 3px 10px; border-radius: 99px; letter-spacing: .04em; text-transform: uppercase; }}
.pill.ok {{ background: var(--okbg); color: var(--ok); }} .pill.bad {{ background: var(--badbg); color: var(--bad); }}
.meta {{ display: flex; flex-wrap: wrap; gap: 6px 16px; margin: 8px 0 0; font-size: 13px; color: var(--muted); }}
.mono {{ font-family: var(--mono); font-size: 12px; overflow-wrap: anywhere; }}
.note {{ margin: 8px 0 0; font: 13px/1.5 var(--mono); color: var(--ink); overflow-wrap: anywhere; border-left: 3px solid var(--orange); padding-left: 10px; }}
details {{ margin-top: 10px; }}
summary {{ cursor: pointer; font-weight: 600; color: var(--teal); font-size: 13px; }}
summary:focus-visible {{ outline: 2px solid var(--orange); outline-offset: 2px; }}
details img {{ display: block; margin-top: 10px; border: 1px solid var(--line); border-radius: 6px; max-width: 100%; height: auto; }}
@media (max-width: 760px) {{ .grid {{ grid-template-columns: 1fr; }} nav {{ position: static; }} }}
</style>
<div class="wrap">
  <div class="top">
    <div>
      <div class="eyebrow">Sharnam PMC portal · new-project UAT · {date.today().strftime('%d %b %Y')}</div>
      <h1>{e(code)} — evidence log</h1>
      <p>One screenshot per evidence ID from docs/UAT_EVIDENCE_PLAN.md, run on a project created from nothing with the office, site, contractor and client logins. Open any card for its screenshot.</p>
    </div>
    <div class="score">{passed}/{len(rows)}<small>steps passed</small></div>
  </div>
  <div class="grid"><nav aria-label="Sections">{"".join(nav)}</nav><main>{"".join(body)}</main></div>
</div>"""
    out.write_text(page)
    print(f"{out} · {len(page) // 1024} KB · {passed}/{len(rows)}")


if __name__ == "__main__":
    main()
