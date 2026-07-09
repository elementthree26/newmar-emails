# Newmar Email Performance Dashboard

A static, dependency-free dashboard over the Newmar HubSpot email relaunch data:
individual email performance across the OLD → NEW time periods, and performance
rolled up by workflow.

## Running it

No build step, no server-side code. Just serve the folder statically:

```bash
python3 -m http.server 8000
# then open http://localhost:8000/
```

(Opening `index.html` directly via `file://` also works — data is embedded as a
plain `<script>` file, not fetched.)

## What's in it

- **Overview** — program-level KPI tiles, open rate / click rate / CTR trend
  across the 3 periods, total send volume, and a short list of the storylines
  already established in the source analysis (mix shift, niche workflow
  improvement, the SQL volume drop).
- **Emails** — every individual email (254 distinct names, 393 rows across
  periods), searchable and filterable by workflow, sortable by sent volume /
  open rate / click rate / CTR. Click a row to expand a per-period trend chart
  and full metric breakdown for that email.
- **Workflows** — open rate by workflow (May vs June), send-volume mix by
  workflow, the HubSpot enrollment snapshot, and an expandable card per
  workflow with its trigger logic, lifecycle filter, and notes.

## Project layout

```
index.html            page shell, tabs, markup
assets/styles.css      design tokens (light/dark) + layout
assets/charts.js       small dependency-free SVG chart helpers (line, grouped bar, stacked bar, sparkline)
assets/app.js          data wrangling + rendering + interactions
assets/data.js         generated data payload (see below) — do not hand-edit
data/newmar_email_ecosystem.db   source SQLite database
scripts/export_data.py           regenerates assets/data.js from the .db
```

## Refreshing the data

When `data/newmar_email_ecosystem.db` is updated with a new export:

```bash
python3 scripts/export_data.py
```

This regenerates `assets/data.js`; reload the page to see the new numbers.
