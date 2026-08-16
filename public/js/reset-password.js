(function () {
  var createClient = window.supabase.createClient;
  var SA = window.SeedAuth;
  var form = document.getElementById('reset-form');
  var invalidPanel = document.getElementById('reset-invalid');
  var passwordInput = document.getElementById('password');
  var confirmInput = document.getElementById('confirm-password');
  var passwordHint = document.getElementById('password-hint');
  var confirmHint = document.getElementById('confirm-hint');
  var errBox = document.getElementById('reset-error');
  var submitBtn = document.getElementById('reset-submit');

  var ready = false;
  var pollTimer = null;
  var hasRecoverySignal = /[?&#](access_token|code|type=recovery)/.test(window.location.href);
  var eventFired = false;

  function showError(message) {
    errBox.textContent = message;
    errBox.hidden = false;
  }

  function setHint(el, message) {
    if (message) {
      el.textContent = message;
      el.classList.add('is-error');
      el.hidden = false;
    } else {
      el.classList.remove('is-error');
      el.hidden = true;
    }
  }

  function validatePassword() {
    var pw = passwordInput.value;
    if (!pw) {
      setHint(passwordHint, 'Enter a new password.');
      return false;
    }
    var problems = [];
    if (pw.length < 6) problems.push('at least 6 characters');
    if (!/[A-Za-z]/.test(pw)) problems.push('at least one letter');
    if (!/\d/.test(pw)) problems.push('at least one number');
    if (problems.length) {
      setHint(passwordHint, 'Password needs ' + problems.join(', ') + '.');
      return false;
    }
    setHint(passwordHint, null);
    return true;
  }

  function validateConfirm() {
    var cw = confirmInput.value;
    if (!cw) {
      setHint(confirmHint, 'Confirm your new password.');
      return false;
    }
    if (cw !== passwordInput.value) {
      setHint(confirmHint, 'Passwords do not match.');
      return false;
    }
    setHint(confirmHint, null);
    return true;
  }

  function validate() {
    var ok = validatePassword();
    ok = validateConfirm() && ok;
    return ok;
  }

  function showForm(client) {
    if (ready) return;
    ready = true;
    if (pollTimer) clearInterval(pollTimer);
    SA.hideLoading();
    form.hidden = false;

    passwordInput.addEventListener('input', validatePassword);
    confirmInput.addEventListener('input', validateConfirm);

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      errBox.hidden = true;
      if (!validate()) return;

      SA.setBusy(submitBtn, true, 'Updating…');

      client.auth
        .updateUser({ password: passwordInput.value })
        .then(function (res) {
          if (res.error) throw res.error;
          submitBtn.disabled = true;
          submitBtn.classList.add('success');
          submitBtn.textContent = '✓ Password updated';
          SA.toast('Password updated. Sign in with your new password.', 'success');
          setTimeout(function () {
            window.location.href = '/';
          }, 1100);
        })
        .catch(function (err) {
          SA.setBusy(submitBtn, false);
          submitBtn.classList.remove('success');
          showError(SA.friendlyAuthError(err));
        });
    });
  }

  function showInvalid() {
    if (ready) return;
    ready = true;
    if (pollTimer) clearInterval(pollTimer);
    SA.hideLoading();
    invalidPanel.hidden = false;
  }

  fetch('/api/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    })
    .then(function (cfg) {
      var client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

      // Recovery links arrive as a PASSWORD_RECOVERY event (token-hash or PKCE).
      client.auth.onAuthStateChange(function (event, session) {
        if (event === 'PASSWORD_RECOVERY' && session) {
          eventFired = true;
          showForm(client);
        }
      });

      // Fallback: poll for the recovered session for a few seconds. Only accept
      // the session when it came from a recovery link (event or URL signal), so a
      // normal logged-in session can never silently change a password here.
      var tries = 0;
      pollTimer = setInterval(function () {
        if (ready) return;
        client.auth.getSession().then(function (res) {
          if (
            (eventFired || hasRecoverySignal) &&
            res.data.session &&
            res.data.session.user &&
            SA.isEmailConfirmed(res.data.session.user)
          ) {
            showForm(client);
          } else if (++tries >= 12) {
            showInvalid();
          }
        });
      }, 500);
    })
    .catch(function () {
      errBox.textContent = 'Could not load configuration. Is the Seed Cloud server running?';
      errBox.hidden = false;
      SA.hideLoading();
      showInvalid();
    });
})();