// Minimal client-side router. Keeps clean URLs (/dashboard, /files, ...) on top
// of the single app shell (app.html). Page rendering is delegated to app.js via
// setRenderer so page modules can navigate without importing app.js.

let renderFn = null;

export function setRenderer(fn) {
  renderFn = fn;
}

export function normalizePath(path) {
  let p = path.split('?')[0];
  if (p.length > 1 && p.endsWith('/')) p = p.slice(0, -1);
  return p;
}

export function navigate(path, opts = {}) {
  const target = normalizePath(path);
  const current = normalizePath(window.location.pathname);

  if (opts.replace) {
    window.history.replaceState({}, '', target + (opts.query || ''));
  } else if (target !== current) {
    window.history.pushState({}, '', target + (opts.query || ''));
  }

  if (renderFn) renderFn(target);
}

export function showRouteForPath() {
  navigate(window.location.pathname, { replace: true });
}
