// Opens a new window, writes a full printable HTML document into it, and
// triggers the browser print dialog -- same window.open + document.write +
// @media print approach as components/Card.vue's openPrintDialog, factored
// out because this one renders arbitrary rich-text document bodies (a
// printed order document) rather than a fixed QR-code card layout.
//
// bodyHtml is trusted to already be safe HTML: callers are responsible for
// escaping any user-controlled text before it lands in bodyHtml (see
// utils/documentVariableSubstitution.ts).
export function printHtmlDocument(title: string, bodyHtml: string): void {
  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  const escapedTitle = title
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>${escapedTitle}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
          font-size: 14px;
          line-height: 1.5;
          color: #111;
          padding: 24px;
          max-width: 800px;
          margin: 0 auto;
        }
        table { width: 100%; border-collapse: collapse; }
        @media print {
          body { padding: 0; max-width: 100%; }
        }
      </style>
    </head>
    <body>${bodyHtml}</body>
    </html>
  `;
  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    setTimeout(() => printWindow.close(), 500);
  }, 100);
}
