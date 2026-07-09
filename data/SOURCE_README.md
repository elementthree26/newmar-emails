# Newmar Email Ecosystem Database

SQLite file: `newmar_email_ecosystem.db`

Captures everything gathered from the HubSpot workflow screenshots + the June 2026 performance report + the 3 email export CSVs. Point Claude (in a new chat, or Claude Code) at this file to pick the analysis back up without re-explaining the ecosystem.

## Tables

- **workflows** — all 12 workflows (Leads-Exploring, MQL, SQL, Customer Engagement, Find-a-Dealer, BAC Finished, Inventory Reserve/Quote, Resorts Guide, Factory Tour, Trade-In Guide, Brochure Downloads). Trigger logic, lifecycle filters, re-enroll settings, first email sent, and free-text notes on quirks (e.g. BAC "Didn't Finish" has no matching emails; brochure workflows share one final email across all models).
- **suppression_lists** — P1–P8 + Customer Lifecycle Stage, decoded.
- **workflow_suppression_map** — which workflows unenroll on which suppression lists.
- **email_workflow_classification** — all 254 distinct email names from the HubSpot exports, each mapped to a workflow (or "Old System (pre-relaunch)" for legacy emails).
- **email_performance_by_period** — the full per-email breakdown (this is the same data as the xlsx workbook): sent, est. bounced/delivered, opened, open rate, clicked, click rate (clicks/delivered), CTR (clicks/opens), bounce rate — for every email name, across all 3 periods: OLD (Apr 11–May 7), NEW (May 8–Jun 3), NEW (Jun 4–30). 393 rows (not every email ran in every period).
- **workflow_performance_by_period** — sent/opened/open rate rolled up by *workflow* (not individual email), May 8–Jun 3 vs Jun 4–30 only (OLD period not broken out by workflow since the new workflows didn't exist yet).
- **program_level_metrics** — aggregate open rate / click rate / CTR / total sends for OLD, NEW-May, NEW-June periods.
- **aimbase_leads_delivered_to_dealers** — June 2026 lead delivery by lifecycle stage (from report p.41).
- **workflow_enrollment_snapshot** — point-in-time HubSpot enrollment counts (Lead-Exploring 599, MQL 274, SQL 316) confirming the SQL volume drop is real, not just an email-send artifact.
- **june_2026_report_kpis** — top-line scorecard metrics from the June 2026 Newmar performance report (traffic, HVTs, leads, MQLs, SQLs, sales, email ecosystem summary).

## Key storylines already established

1. Month 2 (June) email engagement decline is mostly a **mix shift** toward top-of-funnel volume (Brochure Downloads + Leads-Exploring = ~70% of all sends), not a broad content failure.
2. Niche behavior-triggered workflows (Factory Tour, Inventory Quote) are small but **improving**.
3. **SQL volume genuinely dropped** — confirmed three independent ways: email sends (-34% MoM), Aimbase delivery (-49.9% MoM), and workflow enrollment snapshot (316 SQL vs 599 Lead / 274 MQL). Not explained by graduation into smaller behavior workflows. Points to a lead-scoring/handoff question upstream of email.
