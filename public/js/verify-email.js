(function () {
  var createClient = window.supabase.createClient;
  var SA = window.SeedAuth;
  var emailEl = document.getElementById('verify-email');
  var openBtn = document.getElementById('open-email-btn');
  var resendBtn = document.getElementById('resend-btn');
  var resendStatus = document.getElementById('resend-status');
  var email = null;
  var cooldown = 0;
  var cooldownTimer = null;
  var RESEND_COOLDOWN = 30;

  var MAIL_PROVIDERS = [
    { match: /@gmail\.com$/i, url: 'https://mail.google.com' },
    { match: /@googlemail\.com$/i, url: 'https://mail.google.com' },
    { match: /@(outlook|hotmail|live|msn)\./i, url: 'https://outlook.live.com/mail/' },
    { match: /@yahoo\./i, url: 'https://mail.yahoo.com' },
    { match: /@aol\./i, url: 'https://mail.aol.com' },
    { match: /@(icloud|me)\./i, url: 'https://www.icloud.com/mail/' },
    { match: /@(protonmail|proton)\./i, url: 'https://mail.proton.me' },
  ];

  function mailUrl(addr) {
    for (var i = 0; i < MAIL_PROVIDERS.length; i++) {
      if (MAIL_PROVIDERS[i].match.test(addr)) return MAIL_PROVIDERS[i].url;
    }
    return 'mailto:';
  }

  function setStatus(message, type) {
    resendStatus.className = 'verify-resend-status' + (type ? ' ' + type : '');
    resendStatus.textContent = message;
    resendStatus.hidden = false;
  }

  function startCooldown() {
    cooldown = RESEND_COOLDOWN;
    resendBtn.disabled = true;
    resendBtn.classList.remove('loading');
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
    resendBtn.disabled = true;
    setStatus('Sending…');
    SA.setBusy(resendBtn, true, 'Sending…');
    client.auth
      .resend({ type: 'signup', email: email })
      .then(function (res) {
        if (res.error) throw res.error;
        SA.setBusy(resendBtn, false);
        setStatus('Email sent. Check your inbox again.', 'ok');
        SA.toast('Email sent', 'success');
        startCooldown();
      })
      .catch(function (err) {
        SA.setBusy(resendBtn, false);
        var message = err.message || 'Could not resend the email.';
        if (/second|security purposes|rate/i.test(message)) {
          setStatus('Please wait before requesting another email.', 'err');
          startCooldown();
        } else {
          setStatus(SA.friendlyAuthError(err), 'err');
          resendBtn.disabled = false;
        }
      });
  }

  function isConfirmedSession(session) {
    if (!session) return false;
    return Boolean(
      session.user && (session.user.email_confirmed_at || session.user.confirmed_at)
    );
  }

  function redirectIfConfirmed(client) {
    client.auth.getSession().then(function (res) {
      if (res.data && res.data.session && isConfirmedSession(res.data.session)) {
        window.location.href = '/dashboard';
      }
    });
  }

  function readEmail() {
    var params = new URLSearchParams(window.location.search);
    var q = params.get('email');
    if (q) return q;
    try {
      var stored = localStorage.getItem('sc_pending_email');
      if (stored) return stored;
    } catch (e) {}
    return null;
  }

  fetch('/api/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    })
    .then(function (cfg) {
      var client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

      email = readEmail();
      if (email) {
        emailEl.textContent = email;
        openBtn.href = mailUrl(email);
      } else {
        emailEl.textContent = 'your email';
        openBtn.style.display = 'none';
      }

      resendBtn.addEventListener('click', function () {
        resend(client);
      });

      client.auth.onAuthStateChange(function (event) {
        if (event === 'SIGNED_IN') {
          window.location.href = '/dashboard';
        }
      });

      redirectIfConfirmed(client);
      setInterval(function () {
        redirectIfConfirmed(client);
      }, 4000);

      SA.hideLoading();
    })
    .catch(function () {
      emailEl.textContent = 'your email';
      resendBtn.disabled = true;
      setStatus('Could not load configuration. Is the Seed Cloud server running?', 'err');
      SA.hideLoading();
    });
})();
