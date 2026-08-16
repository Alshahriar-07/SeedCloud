// Shared helpers for the auth pages (/, /signup, /verify-email, /forgot-password,
// /reset-password). Loaded as a classic script before each page's own script.
(function () {
  var CHECK_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>';
  var X_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';
  var INFO_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>';
  var CLOSE_SVG =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>';

  function setBusy(btn, busy, busyText) {
    if (!btn) return;
    if (busy) {
      if (!btn.dataset.origLabel) btn.dataset.origLabel = btn.textContent.trim();
      btn.disabled = true;
      btn.classList.add('loading');
      btn.setAttribute('aria-busy', 'true');
      var sp = document.createElement('span');
      sp.className = 'spinner';
      sp.setAttribute('aria-hidden', 'true');
      btn.textContent = '';
      btn.appendChild(sp);
      btn.appendChild(document.createTextNode(busyText || ''));
    } else {
      btn.disabled = false;
      btn.classList.remove('loading');
      btn.removeAttribute('aria-busy');
      btn.textContent = btn.dataset.origLabel || busyText || '';
    }
  }

  function setInline(el, message, type) {
    if (!el) return;
    el.textContent = message || '';
    el.classList.remove('is-error', 'is-ok');
    if (type === 'err') el.classList.add('is-error');
    else if (type === 'ok') el.classList.add('is-ok');
    el.hidden = !message;
  }

  function dismissToast(el) {
    if (!el || el.classList.contains('leaving')) return;
    el.classList.add('leaving');
    setTimeout(function () {
      el.remove();
    }, 190);
  }

  function toast(message, type) {
    var wrap = document.getElementById('toast-wrap');
    if (!wrap) return;
    type = type || 'info';
    var el = document.createElement('div');
    el.className = 'toast ' + type;

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = type === 'success' ? CHECK_SVG : type === 'error' ? X_SVG : INFO_SVG;

    var text = document.createElement('span');
    text.textContent = message;

    var close = document.createElement('button');
    close.className = 'toast-close';
    close.type = 'button';
    close.setAttribute('aria-label', 'Dismiss');
    close.innerHTML = CLOSE_SVG;
    close.addEventListener('click', function () {
      dismissToast(el);
    });

    el.appendChild(icon);
    el.appendChild(text);
    el.appendChild(close);
    wrap.appendChild(el);

    var timer = setTimeout(function () {
      dismissToast(el);
    }, 4200);
    el.addEventListener('mouseenter', function () {
      clearTimeout(timer);
    });
    el.addEventListener('mouseleave', function () {
      timer = setTimeout(function () {
        dismissToast(el);
      }, 1500);
    });
  }

  function hideLoading() {
    var el = document.getElementById('auth-loading');
    if (!el) return;
    el.classList.add('leaving');
    setTimeout(function () {
      if (el.parentNode) el.parentNode.removeChild(el);
    }, 220);
  }

  function isEmailConfirmed(user) {
    return Boolean(user && (user.email_confirmed_at || user.confirmed_at));
  }

  function friendlyAuthError(err) {
    var m = String((err && (err.message || err.msg)) || '').toLowerCase();
    if (/already registered|already been registered|user already exists|user_already_exists/i.test(m))
      return 'An account with this email already exists.';
    if (/invalid login credentials|invalid email or password/i.test(m))
      return 'Incorrect email or password.';
    if (/email not confirmed|not confirmed/i.test(m))
      return 'Please confirm your email before signing in.';
    if (/rate limit|too many (requests|attempts)|security purposes/i.test(m))
      return 'Too many attempts. Please try again in a minute.';
    if (/unable to validate email|invalid email|email address is invalid/i.test(m))
      return 'Please enter a valid email address.';
    if (/password should be|weak_password|at least 6/i.test(m))
      return 'Your password is too weak. Use at least 6 characters with a letter and a number.';
    if (/fetch failed|network|failed to fetch|connection/i.test(m))
      return 'Could not reach the server. Please check your connection and try again.';
    if (/timeout|timed out/i.test(m))
      return 'The request timed out. Please try again.';
    return 'Something went wrong. Please try again.';
  }

  window.SeedAuth = {
    setBusy: setBusy,
    setInline: setInline,
    toast: toast,
    hideLoading: hideLoading,
    isEmailConfirmed: isEmailConfirmed,
    friendlyAuthError: friendlyAuthError,
  };
})();