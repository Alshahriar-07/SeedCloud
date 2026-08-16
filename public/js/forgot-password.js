(function () {
  var createClient = window.supabase.createClient;
  var SA = window.SeedAuth;
  var form = document.getElementById('forgot-form');
  var successPanel = document.getElementById('forgot-success');
  var emailInput = document.getElementById('email');
  var emailHint = document.getElementById('email-hint');
  var errBox = document.getElementById('forgot-error');
  var submitBtn = document.getElementById('forgot-submit');
  var resendBtn = document.getElementById('forgot-resend');
  var resendStatus = document.getElementById('forgot-resend-status');
  var emailLine = document.getElementById('forgot-email-line');

  var email = null;
  var cooldown = 0;
  var cooldownTimer = null;
  var RESEND_COOLDOWN = 30;

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

  function setStatus(message, type) {
    resendStatus.className = 'verify-resend-status' + (type ? ' ' + type : '');
    resendStatus.textContent = message;
    resendStatus.hidden = false;
  }

  function startCooldown() {
    cooldown = RESEND_COOLDOWN;
    resendBtn.disabled = true;
    resendBtn.textContent = 'Resend in ' + cooldown + 's';
    if (cooldownTimer) clearInterval(cooldownTimer);
    cooldownTimer = setInterval(function () {
      cooldown -= 1;
      if (cooldown <= 0) {
        clearInterval(cooldownTimer);
        cooldownTimer = null;
        resendBtn.disabled = false;
        resendBtn.textContent = 'Resend email';
      } else {
        resendBtn.textContent = 'Resend in ' + cooldown + 's';
      }
    }, 1000);
  }

  function resend(client) {
    if (!email) return;
    if (cooldown > 0) return;
    SA.setBusy(resendBtn, true, 'Sending…');
    client.auth
      .resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })
      .then(function (res) {
        if (res.error) throw res.error;
        SA.setBusy(resendBtn, false);
        setStatus('Email sent. Check your inbox again.', 'ok');
        SA.toast('Email sent', 'success');
        startCooldown();
      })
      .catch(function (err) {
        SA.setBusy(resendBtn, false);
        var message = err.message || '';
        if (/second|security purposes|rate/i.test(message)) {
          setStatus('Please wait before requesting another email.', 'err');
          startCooldown();
        } else {
          setStatus(SA.friendlyAuthError(err), 'err');
          resendBtn.disabled = false;
        }
      });
  }

  fetch('/api/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    })
    .then(function (cfg) {
      var client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

      return client.auth.getSession().then(function (res) {
        if (res.data && res.data.session && SA.isEmailConfirmed(res.data.session.user)) {
          window.location.href = '/dashboard';
          return;
        }
        SA.hideLoading();

        emailInput.addEventListener('input', function () {
          errBox.hidden = true;
          setHint(emailHint, null);
        });

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          errBox.hidden = true;
          email = emailInput.value.trim();
          if (!email) {
            setHint(emailHint, 'Enter your email.');
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setHint(emailHint, 'Please enter a valid email address.');
            return;
          }

          SA.setBusy(submitBtn, true, 'Sending…');

          client.auth
            .resetPasswordForEmail(email, { redirectTo: window.location.origin + '/reset-password' })
            .then(function (res) {
              if (res.error) throw res.error;
              emailLine.textContent = email;
              form.hidden = true;
              successPanel.hidden = false;
              resendBtn.addEventListener('click', function () {
                resend(client);
              });
              SA.toast('Reset link sent', 'success');
            })
            .catch(function (err) {
              SA.setBusy(submitBtn, false);
              showError(SA.friendlyAuthError(err));
            });
        });
      });
    })
    .catch(function () {
      showError('Could not load configuration. Is the Seed Cloud server running?');
      SA.hideLoading();
    });
})();