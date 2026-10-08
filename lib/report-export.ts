// Helper utility to download CSV or generate executive printable PDF reports

import { downloadCsv } from './csv';

export interface ReportPdfConfig {
  title: string;
  subtitle?: string;
  restaurantName?: string;
  logoUrl?: string;
  dateRange: string;
  kpis?: { label: string; value: string }[];
  headers: string[];
  rows: (string | number)[][];
}

export function exportAsCsv(filename: string, headers: string[], rows: (string | number)[][]) {
  downloadCsv(filename, [headers, ...rows]);
}

export function printExecutivePdf({
  title,
  subtitle,
  restaurantName = 'OrderKar Restaurant',
  logoUrl,
  dateRange,
  kpis = [],
  headers,
  rows,
}: ReportPdfConfig) {
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow popups to open and print the report.');
    return;
  }

  const kpisHtml =
    kpis.length > 0
      ? `
    <div class="kpi-grid">
      ${kpis
        .map(
          (k) => `
        <div class="kpi-card">
          <div class="kpi-label">${k.label}</div>
          <div class="kpi-val">${k.value}</div>
        </div>
      `
        )
        .join('')}
    </div>
  `
      : '';

  const tableHeadersHtml = headers.map((h) => `<th>${h}</th>`).join('');
  const tableRowsHtml = rows
    .map(
      (r, idx) => `
      <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
        ${r.map((cell) => `<td>${cell ?? '—'}</td>`).join('')}
      </tr>
    `
    )
    .join('');

  const html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>${title} — ${restaurantName}</title>
      <style>
        @page {
          size: A4;
          margin: 14mm 12mm 14mm 12mm;
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          padding: 24px;
          line-height: 1.4;
          font-size: 11px;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #6d28d9;
          padding-bottom: 16px;
          margin-bottom: 20px;
        }
        .brand-section {
          display: flex;
          align-items: center;
          gap: 14px;
        }
        .logo-img {
          width: 52px;
          height: 52px;
          object-fit: cover;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
        }
        .logo-fallback {
          width: 52px;
          height: 52px;
          border-radius: 12px;
          background: #6d28d9;
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 900;
        }
        .company-name {
          font-size: 22px;
          font-weight: 900;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .report-badge {
          display: inline-block;
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.8px;
          background: #f3e8ff;
          color: #6d28d9;
          padding: 3px 8px;
          border-radius: 6px;
          margin-top: 4px;
        }
        .meta-section {
          text-align: right;
        }
        .report-title {
          font-size: 16px;
          font-weight: 800;
          color: #1e293b;
        }
        .report-window {
          font-size: 11px;
          color: #64748b;
          font-weight: 600;
          margin-top: 2px;
        }
        .generated-date {
          font-size: 10px;
          color: #94a3b8;
          margin-top: 2px;
        }
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 10px 12px;
        }
        .kpi-label {
          font-size: 9.5px;
          font-weight: 800;
          text-transform: uppercase;
          color: #64748b;
          letter-spacing: 0.5px;
        }
        .kpi-val {
          font-size: 17px;
          font-weight: 900;
          color: #0f172a;
          margin-top: 4px;
          font-family: ui-monospace, monospace;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 10.5px;
        }
        th {
          background: #f1f5f9;
          color: #334155;
          text-align: left;
          font-weight: 800;
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 9px 10px;
          border-bottom: 2px solid #cbd5e1;
        }
        td {
          padding: 8px 10px;
          border-bottom: 1px solid #e2e8f0;
          color: #1e293b;
        }
        .even-row {
          background: #ffffff;
        }
        .odd-row {
          background: #f8fafc;
        }
        .footer {
          margin-top: 30px;
          padding-top: 14px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9.5px;
          color: #94a3b8;
        }
        @media print {
          body {
            padding: 0;
          }
          .no-print {
            display: none !important;
          }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <div class="brand-section">
          ${
            logoUrl
              ? `<img src="${logoUrl}" class="logo-img" alt="${restaurantName}" onerror="this.style.display='none'" />`
              : `<div class="logo-fallback">${restaurantName.charAt(0)}</div>`
          }
          <div>
            <div class="company-name">${restaurantName}</div>
            <div class="report-badge">Executive Business Report</div>
          </div>
        </div>
        <div class="meta-section">
          <div class="report-title">${title}</div>
          <div class="report-window">Range: ${dateRange}</div>
          <div class="generated-date">Printed: ${new Date().toLocaleString('en-PK')}</div>
        </div>
      </div>

      ${kpisHtml}

      <table>
        <thead>
          <tr>${tableHeadersHtml}</tr>
        </thead>
        <tbody>
          ${tableRowsHtml}
        </tbody>
      </table>

      <div class="footer">
        <span>OrderKar SaaS Cloud Management · All Rights Reserved</span>
        <span>Confidential Internal Document · Page 1 of 1</span>
      </div>

      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
