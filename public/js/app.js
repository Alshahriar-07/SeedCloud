import { qs, toast, debounce, closeModal } from './ui.js';
import { api, setTokenProvider } from './api.js';
import { store, refreshProviders, isEmailConfirmed } from './store.js';
import { navigate, showRouteForPath, normalizePath, setRenderer } from './router.js';
import * as browser from './browser.js';
import * as clouds from './clouds.js';
import * as storage from './storage.js';
import * as upload from './upload.js';
import * as dashboard from './dashboard.js';
import * as downloads from './downloads.js';
import * as access from './access.js';
import * as profile from './profile.js';
import * as settings from './settings.js';

const ROUTES = {
  '/dashboard': { view: 'dashboard', title: 'Overview', render: () => dashboard.render() },
  '/files': { view: 'files', title: 'My Files', render: () => browser.render() },
  '/upload': { view: 'upload', title: 'Upload', render: () => upload.renderPage() },
  '/downloads': { view: 'downloads', title: 'Downloads', render: () => downloads.render() },
  '/access': { view: 'access', title: 'Access', render: () => access.render() },
  '/storage': { view: 'storage', title: 'Storage', render: () => storage.render() },
  '/clouds': { view: 'clouds', title: 'Clouds', render: () => clouds.render() },
  '/profile': { view: 'profile', title: 'Profile', render: () => profile.render() },
  '/settings': { view: 'settings', title: 'Settings', render: () => settings.render() },
};
const DEFAULT_ROUTE = '/dashboard';

const PROVIDER_NAMES = {
  pcloud: 'pCloud',
  'google-drive': 'Google Drive',
  onedrive: 'Microsoft OneDrive',
  dropbox: 'Dropbox',
  koofr: 'Koofr',
  box: 'Box',
  mega: 'MEGA',
  mediafire: 'MediaFire',
  'proton-drive': 'Proton Drive',
  degoo: 'Degoo',
  icedrive: 'Icedrive',
  idrive: 'IDrive',
  icloud: 'Apple iCloud',
  sync: 'Sync.com',
  internxt: 'Internxt',
};

function providerName(id) {
  return PROVIDER_NAMES[id] || id;
}

function renderRoute(path) {
  const route = ROUTES[path] || ROUTES[DEFAULT_ROUTE];
  const finalPath = ROUTES[path] ? path : DEFAULT_ROUTE;

  document.title = `Seed Cloud — ${route.title}`;

  for (const btn of document.querySelectorAll('.nav-item')) {
    btn.classList.toggle('active', btn.dataset.path === finalPath);
  }
  for (const key of Object.keys(ROUTES)) {
    qs(`#view-${ROUTES[key].view}`).hidden = ROUTES[key].view !== route.view;
  }
  qs('#sidebar').classList.remove('open');

  route.render();

  // Re-trigger the subtle entrance animation for this navigation.
  const activeView = qs(`#view-${route.view}`);
  activeView.classList.remove('view-enter');
  void activeView.offsetWidth;
  activeView.classList.add('view-enter');
}

function renderAccount(user) {
  const name = (user.user_metadata && user.user_metadata.full_name) || '';
  qs('#account-name').textContent = name || 'Seed Cloud user';
  qs('#account-email').textContent = user.email || user.id;
  const initial = name.trim() ? name.trim().charAt(0) : (user.email || '?').charAt(0);
  qs('#account-avatar').textContent = initial;
}

function handleUrlParams() {
  const params = new URLSearchParams(window.location.search);
  const connected = params.get('connected');
  const error = params.get('connect_error');

  const ERROR_MESSAGES = {
    cancelled: 'You cancelled the connection. No changes were made.',
    state: 'Connection could not be verified. Please try again.',
    expired: 'Connection request expired. Please try again.',
    already_connected: 'This cloud account is already connected.',
    not_configured: 'This provider is not configured on this server yet.',
    coming_soon: 'This provider is not available for connecting yet.',
    invalid_code: 'The provider returned an invalid code. Please try again.',
    provider_api: 'The provider could not confirm the account. Please try again.',
    database: 'Could not save the connection. Please try again.',
    unknown: 'Could not complete the connection. Please try again.',
  };

  if (connected) {
    toast(`${providerName(connected)} connected`, 'success');
  }
  if (error) {
    toast(
      ERROR_MESSAGES[error] || `Could not connect ${providerName(error)}. Please try again.`,
      'error'
    );
  }
  if (connected || error) {
    window.history.replaceState({}, '', normalizePath(window.location.pathname));
  }
}

async function init() {
  const cfg = await api.get('/api/config');
  store.supabase = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const { data } = await store.supabase.auth.getSession();
  if (!data.session) {
    window.location.href = '/';
    return;
  }
  if (!isEmailConfirmed(data.session.user)) {
    window.location.href = '/verify-email';
    return;
  }
  store.user = data.session.user;
  setTokenProvider(() =>
    store.supabase.auth.getSession().then((r) => (r.data.session ? r.data.session.access_token : null))
  );

  setRenderer(renderRoute);
  renderAccount(data.session.user);

  store.supabase.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_OUT') window.location.href = '/';
  });

  qs('#account-btn').addEventListener('click', () => {
    const menu = qs('#account-menu');
    menu.hidden = !menu.hidden;
  });
  document.addEventListener('click', (e) => {
    const menu = qs('#account-menu');
    if (!menu.hidden && !e.target.closest('.account-wrap')) menu.hidden = true;
  });
  qs('#logout-btn').addEventListener('click', () => {
    try {
      localStorage.removeItem('sc_pending_email');
    } catch (e) {}
    store.supabase.auth.signOut();
  });

  for (const btn of document.querySelectorAll('.nav-item')) {
    btn.addEventListener('click', () => navigate(btn.dataset.path));
  }

  const searchInput = qs('#global-search');
  searchInput.addEventListener(
    'input',
    debounce(() => browser.setSearchQuery(searchInput.value), 180)
  );

  const shell = qs('#shell');
  const isMobile = () => window.innerWidth <= 760;

  qs('#menu-btn').addEventListener('click', () => {
    if (isMobile()) {
      qs('#sidebar').classList.toggle('open');
    } else {
      toggleCollapse();
    }
  });

  function toggleCollapse() {
    const collapsed = shell.classList.toggle('sidebar-collapsed');
    try {
      localStorage.setItem('sc_sidebar_collapsed', collapsed ? '1' : '0');
    } catch (e) {}
  }
  try {
    if (localStorage.getItem('sc_sidebar_collapsed') === '1' && !isMobile()) {
      shell.classList.add('sidebar-collapsed');
    }
  } catch (e) {}
  const collapseBtn = qs('#sidebar-collapse-btn');
  if (collapseBtn) collapseBtn.addEventListener('click', toggleCollapse);

  qs('#modal-backdrop').addEventListener('click', (e) => {
    if (e.target.id === 'modal-backdrop') closeModal();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      qs('#context-menu').hidden = true;
      closeModal();
    }
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      qs('#global-search').focus();
    }
  });

  window.addEventListener('popstate', showRouteForPath);

  upload.init();
  handleUrlParams();

  try {
    await refreshProviders();
  } catch (err) {
    toast(`Could not load providers: ${err.message}`, 'error');
    store.providers = [];
  }

  clouds.renderSidebar();
  storage.refresh();
  browser.refresh();
  showRouteForPath();

  const loadingEl = document.getElementById('auth-loading');
  if (loadingEl) loadingEl.remove();
}

init().catch((err) => {
  const loadingEl = document.getElementById('auth-loading');
  if (loadingEl) loadingEl.remove();
  console.error(err);
  window.location.href = '/';
});
