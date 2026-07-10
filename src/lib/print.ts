// Printing inside the Tauri webview.
//
// The previous approach printed a hidden iframe via iframe.contentWindow.print().
// That silently no-ops in WebView2 (Windows) and WKWebView (macOS): those engines
// only reliably drive the print dialog for the TOP-LEVEL document, not a nested
// frame — so "Print receipt" appeared to do nothing.
//
// Instead we inject the content into the live document and print the top window,
// hiding everything except the print root with an @media print stylesheet.

/** Escape a value for safe interpolation into printed HTML. `bodyHtml` is injected into the live
 *  document, so any user-controlled string (product/customer name, notes) MUST pass through this
 *  or a value like `<img src=x onerror=…>` would execute when printed. */
export function escapeHtml(value: unknown): string {
  return String(value ?? "").replace(/[&<>"']/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : c === '"' ? "&quot;" : "&#39;"
  );
}

/** Print a chunk of body HTML via the top-level document. `headExtra` may carry
 *  caller <style> rules (e.g. @page size/margins for labels or receipts). */
export function printHtmlBody(title: string, bodyHtml: string, headExtra = "") {
  const previousTitle = document.title;

  // Remove any leftovers from an interrupted previous run.
  document.getElementById("fp-print-root")?.remove();
  document.getElementById("fp-print-extra")?.remove();
  document.getElementById("fp-print-style")?.remove();

  // Caller-provided styles (page margins, label dimensions, …).
  if (headExtra) {
    const extra = document.createElement("div");
    extra.id = "fp-print-extra";
    extra.innerHTML = headExtra;
    document.head.appendChild(extra);
  }

  // The content to print, injected into the live document.
  const root = document.createElement("div");
  root.id = "fp-print-root";
  root.innerHTML = bodyHtml;
  document.body.appendChild(root);

  // While printing, show only the print root.
  const style = document.createElement("style");
  style.id = "fp-print-style";
  style.media = "print";
  style.textContent =
    "body * { visibility: hidden !important; }" +
    "#fp-print-root, #fp-print-root * { visibility: visible !important; }" +
    "#fp-print-root { position: absolute; left: 0; top: 0; width: 100%; }";
  document.head.appendChild(style);

  // Windows/macOS use document.title as the print job / default file name.
  document.title = title;

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    root.remove();
    style.remove();
    document.getElementById("fp-print-extra")?.remove();
    document.title = previousTitle;
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);

  // Defer so the injected content lays out before the print dialog opens
  // (a single tick can print a blank page in WebView2).
  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      try {
        window.focus();
        window.print();
      } catch {
        /* ignore — cleanup still runs */
      }
      // Fallback cleanup if afterprint never fires (e.g. dialog dismissed).
      setTimeout(cleanup, 60000);
    }),
  );
}
