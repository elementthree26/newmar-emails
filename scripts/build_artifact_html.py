#!/usr/bin/env python3
"""Builds the shareable HTML outputs from index.html + assets/*.

Produces two files under dist/:
  - newmar-email-dashboard.html            a full standalone page (doctype/html/head/body),
                                            for sending directly to someone (double-click to open).
  - newmar-email-dashboard-artifact.html   content-only (no doctype/html/head/body wrapper),
                                            for publishing via the Artifact tool, which supplies
                                            its own page skeleton.

Run scripts/export_data.py first if data/newmar_email_ecosystem.db changed —
this script does not read the .db itself, only assets/data.js.

Usage:
    python3 scripts/build_artifact_html.py
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
DIST = ROOT / "dist"

SCRIPT_TAGS_RE = re.compile(
    r'<script src="assets/data\.js"></script>\s*'
    r'<script src="assets/charts\.js"></script>\s*'
    r'<script src="assets/app\.js"></script>'
)


def read(path):
    return path.read_text()


def inline_scripts_block():
    data_js = read(ROOT / "assets" / "data.js")
    charts_js = read(ROOT / "assets" / "charts.js")
    app_js = read(ROOT / "assets" / "app.js")
    return (
        f"<script>\n{data_js}\n</script>\n"
        f"<script>\n{charts_js}\n</script>\n"
        f"<script>\n{app_js}\n</script>"
    )


def build_standalone(html, css):
    out = html.replace(
        '<link rel="stylesheet" href="assets/styles.css" />',
        f"<style>\n{css}\n</style>",
    )
    out = SCRIPT_TAGS_RE.sub(lambda m: inline_scripts_block(), out)
    return out


def build_artifact_content(html, css):
    title_tag = re.search(r"<title>.*?</title>", html, re.S).group(0)
    body_inner = re.search(r"<body>(.*)</body>", html, re.S).group(1)
    body_inner = SCRIPT_TAGS_RE.sub("", body_inner)
    return (
        f"{title_tag}\n"
        f"<style>\n{css}\n</style>\n"
        f"{body_inner}\n"
        f"{inline_scripts_block()}\n"
    )


def main():
    html = read(INDEX)
    css = read(ROOT / "assets" / "styles.css")

    DIST.mkdir(exist_ok=True)

    standalone_path = DIST / "newmar-email-dashboard.html"
    standalone_path.write_text(build_standalone(html, css))
    print(f"Wrote {standalone_path} ({standalone_path.stat().st_size:,} bytes)")

    artifact_path = DIST / "newmar-email-dashboard-artifact.html"
    artifact_path.write_text(build_artifact_content(html, css))
    print(f"Wrote {artifact_path} ({artifact_path.stat().st_size:,} bytes)")


if __name__ == "__main__":
    main()
