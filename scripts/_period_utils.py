"""Shared helper for ordering period_label strings chronologically.

Labels look like "OLD (Apr 11-May 7)" or "NEW (June 4-30)" — this parses the
first "<Month> <Day>" token out of the parenthesized range and sorts on that,
so a freshly-imported period (e.g. "NEW (Jul 1-28)") slots into the right
place automatically instead of needing a hardcoded list maintained by hand.

Limitation: sorts by (month, day) only, not year — fine as long as all
periods fall within a single year. If the dataset ever spans a year
boundary, this needs a year-aware rework.
"""
import re
from datetime import datetime

_DATE_RE = re.compile(r"\(([A-Za-z]+)\s+(\d+)")


def period_sort_key(period_label):
    m = _DATE_RE.search(period_label)
    if not m:
        return (99, 99)
    month_str, day_str = m.group(1), int(m.group(2))
    month_num = None
    for candidate, fmt in ((month_str[:3], "%b"), (month_str, "%B")):
        try:
            month_num = datetime.strptime(candidate, fmt).month
            break
        except ValueError:
            continue
    if month_num is None:
        month_num = 99
    return (month_num, day_str)


def sorted_periods(period_labels):
    return sorted(set(period_labels), key=period_sort_key)
