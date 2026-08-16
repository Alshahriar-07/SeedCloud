(function () {
  var createClient = window.supabase.createClient;
  var SA = window.SeedAuth;
  var form = document.getElementById('auth-form');
  var errBox = document.getElementById('auth-error');
  var submitBtn = document.getElementById('auth-submit');

  function showError(message) {
    errBox.textContent = message;
    errBox.hidden = false;
  }

  function go(path) {
    window.location.href = path;
  }

  fetch('/api/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    })
    .then(function (cfg) {
      var client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

      return client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) {
          if (SA.isEmailConfirmed(res.data.session.user)) {
            go('/dashboard');
          } else {
            go('/verify-email');
          }
          return;
        }
        SA.hideLoading();

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          errBox.hidden = true;

          var email = form.email.value.trim();
          var password = form.password.value;
          if (!email || !password) {
            showError('Enter your email and password.');
            return;
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            showError('Please enter a valid email address.');
            return;
          }

          SA.setBusy(submitBtn, true, 'Signing in…');

          client.auth
            .signInWithPassword({ email: email, password: password })
            .then(function (res) {
              if (res.error) throw res.error;
              go('/dashboard');
            })
            .catch(function (err) {
              SA.setBusy(submitBtn, false);
              var message = err.message || '';
              if (/not confirmed/i.test(message)) {
                try {
                  localStorage.setItem('sc_pending_email', email);
                } catch (e) {}
                go('/verify-email?email=' + encodeURIComponent(email));
                return;
              }
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