---
name: update-email-performance-data
description: Import a new period's email-performance CSV into the Newmar dashboard — updates the SQLite DB, regenerates the dashboard data/HTML, republishes the shared Artifact link, and pushes to GitHub. Use when the user (or a teammate) attaches a new HubSpot email export CSV and asks to add it to the dashboard, refresh the numbers, or update the artifact.
---

# Update email performance data

This repo (`newmar-emails`) contains a static dashboard over `data/newmar_email_ecosystem.db`.
This skill takes a **newly-attached CSV** for one reporting period and pushes it through the
whole pipeline so the GitHub repo, the standalone HTML file, and the published Artifact link
all reflect it — without anyone having to touch the JS/data plumbing by hand.

**Scope reminder:** this pipeline is for the automated per-workflow emails only (the 12 HubSpot
workflows already tracked — Leads-Exploring, MQL, SQL, Brochure Downloads, Resorts Guide, Factory
Tour, etc.). Newsletters, one-off broadcasts, surveys, and dealer-meeting comms are explicitly
**excluded** from this dashboard's scope (see `program_level_metrics` footnotes on past slides) —
if the attached CSV includes those, strip them out before importing, or ask the user to confirm
they want them in scope (they'd need a different table/view, not this one).

## When to run this

Trigger on things like: "here's this month's email export, add it to the dashboard", "update the
artifact with this CSV", "refresh the numbers for July". You need two things before starting:

1. **The CSV file** (attached to the conversation, or a path the user gives you).
2. **The period label** for this data, in the same style as existing periods — e.g.
   `"NEW (Jul 1-28)"`. If the user didn't say it explicitly, ask, or infer it from the CSV's
   filename/date range and confirm with the user before running the import.

## Steps

Run these from the repo root.

### 1. Preview with `--dry-run` first

```bash
python3 scripts/import_email_csv.py <csv_path> --period-label "<period label>" --dry-run
```

Read the output carefully:
- **Matched columns** — confirm it found `email_name` and `sent` at minimum; if a column it
  should have found didn't map, either the CSV's headers are unusual (open a copy and check) or
  `HEADER_SYNONYMS` in `scripts/import_email_csv.py` needs a new synonym added for this export
  format — add it there rather than special-casing the CSV.
- **Unclassified emails** — any email name not already in `email_workflow_classification` gets
  flagged. A handful of genuinely new emails (a new drip step, a new model year) is normal — a
  long list usually means the email-name column matched the wrong CSV column, or workflow names
  changed upstream. Sanity-check the list with the user if it's more than a few names before
  proceeding; unclassified emails still get sent-count credit in program-level totals, but won't
  show a real workflow in the Workflows tab until fixed.

### 2. Run the import for real

```bash
python3 scripts/import_email_csv.py <csv_path> --period-label "<period label>"
```

This upserts the email-level rows into `email_performance_by_period`, then recomputes
`workflow_performance_by_period` and `program_level_metrics` for that period from the email-level
data (deleting and re-inserting rather than appending, so re-running the same import is safe).

If any emails came back "Unclassified" and you know their real workflow, fix it now with a direct
UPDATE before moving on — otherwise fix it in a follow-up pass:

```bash
python3 -c "
import sqlite3
con = sqlite3.connect('data/newmar_email_ecosystem.db')
con.execute(\"UPDATE email_workflow_classification SET workflow_name=? WHERE email_name=?\", ('<correct workflow>', '<email name>'))
con.execute(\"UPDATE email_performance_by_period SET workflow_name=? WHERE email_name=?\", ('<correct workflow>', '<email name>'))
con.commit()
"
```
Re-run step 2 afterward so the rollups reflect the fix.

### 3. Regenerate the dashboard data and HTML

```bash
python3 scripts/export_data.py
python3 scripts/build_artifact_html.py
```

The first writes `assets/data.js` from the DB (including a freshly chronologically-sorted
`period_order` — no manual list to update). The second rebuilds:
- `dist/newmar-email-dashboard.html` — full standalone page (for sending directly)
- `dist/newmar-email-dashboard-artifact.html` — content-only version for the Artifact tool

### 4. Smoke-check it actually renders

Serve the repo locally and load it in a headless browser before publishing anything — this has
caught real bugs before (axis overflow, dark-mode scoping, stale hardcoded period labels).

```bash
python3 -m http.server 8000 &
```
Then use Playwright (Chromium is pre-installed at `/opt/pw-browsers/chromium`, module at
`/opt/node22/lib/node_modules`) to load `http://localhost:8000/index.html`, click through the
Overview / Emails / Workflows tabs, and check the browser console for errors. Kill the server
when done. If anything looks broken, fix it before publishing — don't ship a stale or broken
Artifact.

### 5. Republish the Artifact

The dashboard is published at a **fixed URL** — always republish to the same one so the link
stays live for anyone who already has it bookmarked:

```
https://claude.ai/code/artifact/391d3fc9-d279-47eb-812e-b33cd2c77c81
```

Call the Artifact tool with:
- `file_path`: `dist/newmar-email-dashboard-artifact.html`
- `url`: the URL above (**required** — without it you mint a brand-new artifact instead of
  updating this one, even from a different conversation/session)
- `favicon`: `📧` (keep it stable across updates)
- `description`: one line noting what changed (e.g. "Now includes NEW (Jul 1-28)")

If this skill is being run from a session that never published this artifact before (e.g. a
teammate's fresh conversation), passing `url` is what makes it update in place instead of
creating a duplicate link — don't skip it.

### 6. Commit and push

```bash
git add data/newmar_email_ecosystem.db assets/data.js dist/ scripts/
git commit -m "Import <period label> email performance data"
git push
```

Push to whatever branch is currently checked out — check `git branch --show-current` first if
unsure. Don't force-push.

### 7. Report back

Tell the user (in your own words, not a template): which period got added, the headline numbers
(total sends, open rate, and how they moved vs. the prior period), any workflows still showing
"Unclassified" that need a follow-up fix, and the artifact URL. Offer to send the standalone
`dist/newmar-email-dashboard.html` file directly too (via SendUserFile) in case they want an
offline copy for someone who doesn't have the artifact link.

## What this pipeline does NOT update

Be upfront about this rather than letting it surprise someone later:

- **`june_2026_report_kpis`** — a one-off snapshot of the June 2026 PDF report (site traffic,
  HVTs, leads/MQLs/SQLs, Aimbase delivery). A plain email CSV can't supply these. The Overview
  KPI tiles (open rate / click rate / CTR / total sends) are computed directly from
  `program_level_metrics` instead, specifically so they DO stay current — but anything sourced
  from that report table (like the Aimbase SQL-delivery insight bullet) will stay pinned to June
  until someone imports a newer report's KPIs the same way.
- **Workflow metadata** (`workflows`, `suppression_lists`, trigger logic, notes) — this is
  structural HubSpot config, not performance data. Only touch it if a workflow's actual setup
  changed.
- **`workflow_enrollment_snapshot`** — a manual point-in-time HubSpot UI screenshot, not derived
  from the CSV.

## Files this skill touches

| File | What it is |
|---|---|
| `scripts/import_email_csv.py` | CSV → DB importer + rollup recompute (the core of this skill) |
| `scripts/export_data.py` | DB → `assets/data.js` |
| `scripts/build_artifact_html.py` | `index.html` + `assets/*` → `dist/*.html` |
| `scripts/_period_utils.py` | Shared chronological period-ordering helper |
| `data/newmar_email_ecosystem.db` | Source of truth |
| `assets/data.js`, `dist/*.html` | Generated — never hand-edit, always regenerate |
