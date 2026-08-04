#!/usr/bin/env python3
"""Imports one period's email-performance CSV into the dashboard's SQLite DB.

Upserts rows into `email_performance_by_period` for the given period, then
recomputes the two rollup tables (`workflow_performance_by_period`,
`program_level_metrics`) for that period from the email-level data, so
everything stays internally consistent.

Usage:
    python3 scripts/import_email_csv.py path/to/export.csv --period-label "NEW (Jul 1-28)"
    python3 scripts/import_email_csv.py path/to/export.csv --period-label "..." --dry-run

Expected scope: this pipeline is for the automated per-workflow emails only
(the 12 HubSpot workflows already tracked). Exclude newsletters, one-off
broadcasts, surveys, and dealer-meeting comms from the CSV before importing —
those are out of scope for this dashboard (see program_level_metrics notes).

CSV column names are matched fuzzily (case/space/punctuation-insensitive)
against common HubSpot export headers — see HEADER_SYNONYMS below. Any
missing derived metric (open rate, click rate, CTR, bounce rate, delivered)
is computed from the raw counts when possible.

Workflow classification: if the CSV has no workflow column, each email name
is looked up in `email_workflow_classification`. Unrecognized email names are
imported with workflow_name = "Unclassified" and reported at the end — go
back and fix those in the DB (email_workflow_classification table) before
the numbers are fully trustworthy in the Workflows tab.
"""
import argparse
import csv
import sqlite3
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _period_utils import sorted_periods  # noqa: E402

DB_PATH = ROOT / "data" / "newmar_email_ecosystem.db"

HEADER_SYNONYMS = {
    "email_name": ["email name", "email", "name", "campaign name", "campaign", "subject", "content name"],
    "sent": ["sent", "sends", "total sent", "delivered sends"],
    "delivered": ["delivered", "est delivered", "estimated delivered", "successful deliveries"],
    "opened": ["opened", "opens", "unique opens", "total opens"],
    "open_rate": ["open rate", "open rate %", "openrate"],
    "clicked": ["clicked", "clicks", "unique clicks", "total clicks"],
    "click_rate": ["click rate", "click rate %", "click-through rate (clicks/delivered)", "ctr (clicks/delivered)"],
    "ctr": ["ctr", "click through rate", "click-through rate", "ctr (clicks/opens)", "clickthrough rate"],
    "bounced": ["bounced", "bounces", "hard bounces", "total bounces", "est bounced"],
    "bounce_rate": ["bounce rate", "bounce rate %"],
    "workflow_name": ["workflow", "workflow name", "campaign workflow"],
}


def normalize_header(h):
    return "".join(ch for ch in h.strip().lower() if ch.isalnum() or ch == " ").strip()


def build_header_map(fieldnames):
    normalized = {normalize_header(h): h for h in fieldnames}
    field_map = {}
    for canonical, synonyms in HEADER_SYNONYMS.items():
        for syn in synonyms:
            if syn in normalized:
                field_map[canonical] = normalized[syn]
                break
    return field_map


def parse_number(raw):
    if raw is None:
        return None
    s = str(raw).strip().replace(",", "").replace("%", "")
    if s == "" or s.lower() in ("n/a", "na", "-", "--"):
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("csv_path", type=Path)
    ap.add_argument("--period-label", required=True, help='e.g. "NEW (Jul 1-28)"')
    ap.add_argument("--db", type=Path, default=DB_PATH)
    ap.add_argument("--dry-run", action="store_true", help="Parse and report, but don't write to the DB")
    args = ap.parse_args()

    period_label = args.period_label

    with open(args.csv_path, newline="", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            print("ERROR: CSV has no header row.", file=sys.stderr)
            sys.exit(1)
        field_map = build_header_map(reader.fieldnames)

        if "email_name" not in field_map:
            print(f"ERROR: couldn't find an email-name column among: {reader.fieldnames}", file=sys.stderr)
            print("Add an 'Email name' column, or extend HEADER_SYNONYMS in this script.", file=sys.stderr)
            sys.exit(1)
        if "sent" not in field_map:
            print(f"ERROR: couldn't find a 'sent' column among: {reader.fieldnames}", file=sys.stderr)
            sys.exit(1)

        print(f"Matched columns: { {k: v for k, v in field_map.items()} }")

        rows = list(reader)

    con = sqlite3.connect(args.db)
    cur = con.cursor()

    cur.execute("SELECT email_name, workflow_name FROM email_workflow_classification")
    known_classification = {name: wf for name, wf in cur.fetchall()}

    parsed = []
    unclassified = []
    skipped = []
    for row in rows:
        email_name = (row.get(field_map.get("email_name"), "") or "").strip()
        if not email_name:
            continue

        sent = parse_number(row.get(field_map.get("sent")))
        if sent is None:
            skipped.append(email_name)
            continue

        opened = parse_number(row.get(field_map.get("opened"))) if "opened" in field_map else None
        clicked = parse_number(row.get(field_map.get("clicked"))) if "clicked" in field_map else None
        bounced = parse_number(row.get(field_map.get("bounced"))) if "bounced" in field_map else None
        delivered = parse_number(row.get(field_map.get("delivered"))) if "delivered" in field_map else None
        open_rate = parse_number(row.get(field_map.get("open_rate"))) if "open_rate" in field_map else None
        click_rate = parse_number(row.get(field_map.get("click_rate"))) if "click_rate" in field_map else None
        ctr = parse_number(row.get(field_map.get("ctr"))) if "ctr" in field_map else None
        bounce_rate = parse_number(row.get(field_map.get("bounce_rate"))) if "bounce_rate" in field_map else None

        if bounced is None:
            bounced = 0.0
        if delivered is None:
            delivered = sent - bounced
        if open_rate is None and sent:
            open_rate = round((opened or 0) / sent * 100, 2)
        if click_rate is None and delivered:
            click_rate = round((clicked or 0) / delivered * 100, 2)
        if ctr is None and opened:
            ctr = round((clicked or 0) / opened * 100, 2)
        if bounce_rate is None and sent:
            bounce_rate = round(bounced / sent * 100, 2)

        if "workflow_name" in field_map:
            workflow_name = (row.get(field_map["workflow_name"]) or "").strip() or None
        else:
            workflow_name = None
        if not workflow_name:
            workflow_name = known_classification.get(email_name)
        if not workflow_name:
            workflow_name = "Unclassified"
            unclassified.append(email_name)

        parsed.append(dict(
            email_name=email_name, period_label=period_label, workflow_name=workflow_name,
            sent=sent, est_bounced=bounced, est_delivered=delivered,
            opened=opened or 0, open_rate_pct=open_rate,
            clicked=clicked or 0, click_rate_clicks_over_delivered_pct=click_rate,
            ctr_clicks_over_opens_pct=ctr, bounce_rate_pct=bounce_rate,
        ))

    print(f"\nParsed {len(parsed)} email rows for period '{period_label}'.")
    if skipped:
        print(f"Skipped {len(skipped)} rows with no parseable 'sent' value: {skipped[:10]}{'...' if len(skipped) > 10 else ''}")
    if unclassified:
        print(f"\n{len(unclassified)} email name(s) not found in email_workflow_classification "
              f"— imported as 'Unclassified', fix these before trusting the Workflows tab:")
        for name in sorted(set(unclassified)):
            print(f"  - {name}")

    if args.dry_run:
        print("\n--dry-run: no changes written.")
        return

    cur.executemany(
        """INSERT OR REPLACE INTO email_performance_by_period
           (email_name, period_label, workflow_name, sent, est_bounced, est_delivered,
            opened, open_rate_pct, clicked, click_rate_clicks_over_delivered_pct,
            ctr_clicks_over_opens_pct, bounce_rate_pct)
           VALUES (:email_name, :period_label, :workflow_name, :sent, :est_bounced, :est_delivered,
                   :opened, :open_rate_pct, :clicked, :click_rate_clicks_over_delivered_pct,
                   :ctr_clicks_over_opens_pct, :bounce_rate_pct)""",
        parsed,
    )

    for name in set(unclassified):
        cur.execute(
            "INSERT OR IGNORE INTO email_workflow_classification (email_name, workflow_name) VALUES (?, ?)",
            (name, "Unclassified"),
        )

    # Recompute rollups for this period from the email-level data just written.
    cur.execute("DELETE FROM workflow_performance_by_period WHERE period_label = ?", (period_label,))
    cur.execute(
        """INSERT INTO workflow_performance_by_period
               (workflow_name, period_label, sent, opened, clicked, open_rate_pct, ctr_clicks_over_opens_pct)
           SELECT workflow_name, period_label,
                  SUM(sent), SUM(opened), SUM(clicked),
                  ROUND(SUM(opened) * 100.0 / SUM(sent), 2),
                  CASE WHEN SUM(opened) > 0 THEN ROUND(SUM(clicked) * 100.0 / SUM(opened), 2) END
           FROM email_performance_by_period
           WHERE period_label = ?
           GROUP BY workflow_name, period_label""",
        (period_label,),
    )

    cur.execute(
        """SELECT SUM(sent), SUM(est_delivered), SUM(opened), SUM(clicked)
           FROM email_performance_by_period WHERE period_label = ?""",
        (period_label,),
    )
    tot_sent, tot_delivered, tot_opened, tot_clicked = cur.fetchone()
    cur.execute(
        """INSERT OR REPLACE INTO program_level_metrics
               (period_label, open_rate_pct, click_rate_clicks_over_delivered_pct, ctr_clicks_over_opens_pct, total_sends)
           VALUES (?, ?, ?, ?, ?)""",
        (
            period_label,
            round(tot_opened * 100.0 / tot_sent, 2) if tot_sent else None,
            round(tot_clicked * 100.0 / tot_delivered, 2) if tot_delivered else None,
            round(tot_clicked * 100.0 / tot_opened, 2) if tot_opened else None,
            tot_sent,
        ),
    )

    con.commit()

    cur.execute("SELECT DISTINCT period_label FROM email_performance_by_period")
    print(f"\nPeriods now in the DB, chronological order: {sorted_periods(r[0] for r in cur.fetchall())}")
    print(f"Program-level totals for '{period_label}': sent={tot_sent}, opened={tot_opened}, clicked={tot_clicked}")

    con.close()
    print("\nDone. Next: python3 scripts/export_data.py && python3 scripts/build_artifact_html.py")


if __name__ == "__main__":
    main()
