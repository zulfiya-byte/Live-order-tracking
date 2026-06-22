"""Generate docs/PXP-Client-Portal-Documentation.pdf from DOCUMENTATION.md.

Usage (from repo root):
    pip install markdown xhtml2pdf
    python docs/generate_pdf.py

Run this after meaningful updates to DOCUMENTATION.md so the PDF stays in sync.
"""
from pathlib import Path
import markdown
from xhtml2pdf import pisa

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "DOCUMENTATION.md"
OUT = ROOT / "docs" / "PXP-Client-Portal-Documentation.pdf"

CSS = """
@page { size: A4; margin: 1.8cm 1.6cm; }
body { font-family: Helvetica, Arial, sans-serif; font-size: 10.5pt; color: #1f2937; line-height: 1.5; }
h1 { color: #0369A1; font-size: 22pt; border-bottom: 3px solid #29ABE2; padding-bottom: 6px; }
h2 { color: #15233B; font-size: 15pt; margin-top: 18px; border-bottom: 1px solid #E5EAF0; padding-bottom: 3px; }
h3 { color: #15233B; font-size: 12pt; margin-top: 12px; }
blockquote { background: #E8F4FB; border-left: 4px solid #29ABE2; padding: 8px 12px; color: #334155; }
code { font-family: "Courier New", monospace; background: #F1F5F9; padding: 1px 4px; font-size: 9pt; }
pre { background: #15233B; color: #E8F4FB; padding: 12px; font-size: 8.5pt; }
table { border-collapse: collapse; width: 100%; font-size: 9pt; margin: 8px 0; }
th { background: #15233B; color: #fff; text-align: left; padding: 5px 7px; }
td { border: 1px solid #E5EAF0; padding: 5px 7px; vertical-align: top; }
tr:nth-child(even) td { background: #F5F8FB; }
a { color: #0369A1; text-decoration: none; }
"""


def main():
    md = SRC.read_text(encoding="utf-8")
    html_body = markdown.markdown(md, extensions=["tables", "fenced_code", "toc"])
    html = f"<html><head><meta charset='utf-8'><style>{CSS}</style></head><body>{html_body}</body></html>"
    OUT.parent.mkdir(exist_ok=True)
    with open(OUT, "wb") as f:
        result = pisa.CreatePDF(html, dest=f)
    if result.err:
        raise SystemExit("PDF generation failed")
    print(f"Wrote {OUT}")


if __name__ == "__main__":
    main()
