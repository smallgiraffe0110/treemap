import type { MailLabel } from "@/types";

const LABELS_PER_PAGE = 30;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLabelCell(label: MailLabel, index: number): string {
  const alt = index % 2 === 1 ? " label--alt" : "";
  return `<div class="label${alt}">
  <div class="label__name">${escapeHtml(label.ownerName)}</div>
  <div class="label__address">${escapeHtml(label.address)}</div>
  <div class="label__city">${escapeHtml(label.city)}, ${escapeHtml(label.state)} ${escapeHtml(label.zip)}</div>
  <div class="label__note">Tree care assessment enclosed</div>
</div>`;
}

function renderEmptyCell(): string {
  return `<div class="label label--empty"></div>`;
}

export function generateMailMergeHTML(labels: MailLabel[]): string {
  const padded = Math.ceil(Math.max(labels.length, 1) / LABELS_PER_PAGE) *
    LABELS_PER_PAGE;
  const totalCells = labels.length === 0 ? LABELS_PER_PAGE : padded;

  const cells: string[] = [];
  for (let i = 0; i < totalCells; i++) {
    if (i < labels.length) {
      cells.push(renderLabelCell(labels[i], i));
    } else {
      cells.push(renderEmptyCell());
    }
  }

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>TreeMap Mail Labels &mdash; Avery 5160</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
    color: #111;
    background: #f3f4f6;
  }
  .toolbar {
    position: sticky;
    top: 0;
    z-index: 10;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 20px;
    background: #ffffff;
    border-bottom: 1px solid #e5e7eb;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }
  .toolbar__title {
    font-size: 14px;
    font-weight: 600;
    letter-spacing: 0.01em;
    color: #374151;
  }
  .toolbar__btn {
    appearance: none;
    border: 1px solid #111;
    background: #111;
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    padding: 8px 14px;
    border-radius: 6px;
    cursor: pointer;
  }
  .toolbar__btn:hover { background: #000; }
  .sheet {
    margin: 20px auto;
    padding: 0.5in 0.1875in;
    width: 8.5in;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(0,0,0,0.08);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(3, 2.625in);
    grid-auto-rows: 1in;
    gap: 0;
    justify-content: center;
  }
  .label {
    width: 2.625in;
    height: 1in;
    padding: 0.12in 0.15in;
    overflow: hidden;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: #ffffff;
  }
  .label--empty { background: transparent; }
  .label__name {
    font-weight: 700;
    font-size: 12pt;
    line-height: 1.15;
    margin-bottom: 1px;
  }
  .label__address {
    font-size: 10pt;
    line-height: 1.15;
  }
  .label__city {
    font-size: 10pt;
    line-height: 1.15;
  }
  .label__note {
    font-style: italic;
    font-size: 8pt;
    color: #555;
    margin-top: 2px;
  }
  @media screen {
    .label--alt { background: #fafafa; }
  }
  @page {
    size: letter;
    margin: 0.5in 0.1875in;
  }
  @media print {
    body { background: #ffffff; }
    .toolbar { display: none; }
    .sheet {
      margin: 0;
      padding: 0;
      width: auto;
      box-shadow: none;
    }
    .label, .label--alt { background: #ffffff !important; }
  }
</style>
</head>
<body>
  <div class="toolbar">
    <div class="toolbar__title">TreeMap Mail Labels &mdash; Avery 5160 &middot; ${labels.length} label${labels.length === 1 ? "" : "s"}</div>
    <button type="button" class="toolbar__btn" onclick="window.print()">Print labels</button>
  </div>
  <div class="sheet">
    <div class="grid">
${cells.join("\n")}
    </div>
  </div>
</body>
</html>`;
}
