(function () {
  var createClient = window.supabase.createClient;
  var SA = window.SeedAuth;
  var form = document.getElementById('signup-form');
  var errBox = document.getElementById('signup-error');
  var submitBtn = document.getElementById('signup-submit');
  var nameInput = form.name;
  var emailInput = form.email;
  var passwordInput = form.password;
  var confirmInput = form['confirm-password'];
  var nameHint = document.getElementById('name-hint');
  var emailHint = document.getElementById('email-hint');
  var passwordHint = document.getElementById('password-hint');
  var confirmHint = document.getElementById('confirm-hint');

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

  function validateName() {
    var name = nameInput.value.trim();
    if (!name) {
      setHint(nameHint, 'Enter your name.');
      return false;
    }
    if (name.length > 60) {
      setHint(nameHint, 'Name must be 60 characters or fewer.');
      return false;
    }
    if (name.length < 2) {
      setHint(nameHint, 'Name is too short.');
      return false;
    }
    setHint(nameHint, null);
    return true;
  }

  function validateEmail() {
    var email = emailInput.value.trim();
    if (!email) {
      setHint(emailHint, 'Enter your email.');
      return false;
    }
    if (!EMAIL_RE.test(email)) {
      setHint(emailHint, 'Please enter a valid email address.');
      return false;
    }
    setHint(emailHint, null);
    return true;
  }

  function validatePassword() {
    var pw = passwordInput.value;
    if (!pw) {
      setHint(passwordHint, 'Enter a password.');
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
      setHint(confirmHint, 'Confirm your password.');
      return false;
    }
    if (cw !== passwordInput.value) {
      setHint(confirmHint, 'Passwords do not match.');
      return false;
    }
    setHint(confirmHint, null);
    return true;
  }

  // Runs every validation and returns true only when the whole form is valid.
  function validate() {
    var ok = validateName();
    ok = validateEmail() && ok;
    ok = validatePassword() && ok;
    ok = validateConfirm() && ok;
    return ok;
  }

  nameInput.addEventListener('input', validateName);
  emailInput.addEventListener('input', function () {
    errBox.hidden = true;
    setHint(emailHint, null);
  });
  passwordInput.addEventListener('input', validatePassword);
  confirmInput.addEventListener('input', validateConfirm);

  fetch('/api/config')
    .then(function (r) {
      if (!r.ok) throw new Error('config unavailable');
      return r.json();
    })
    .then(function (cfg) {
      var client = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

      return client.auth.getSession().then(function (res) {
        if (res.data && res.data.session) {
          var dest = SA.isEmailConfirmed(res.data.session.user) ? '/dashboard' : '/verify-email';
          window.location.href = dest;
          return null;
        }
        SA.hideLoading();

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          errBox.hidden = true;
          if (!validate()) return;

          var name = nameInput.value.trim();
          var email = emailInput.value.trim();
          var password = passwordInput.value;

          SA.setBusy(submitBtn, true, 'Creating account…');

          var options = {
            data: { full_name: name },
            emailRedirectTo: window.location.origin + '/dashboard',
          };
          return client.auth
            .signUp({ email: email, password: password, options: options })
            .then(function (res) {
              if (res.error) throw res.error;

              submitBtn.disabled = true;
              submitBtn.classList.add('success');
              submitBtn.textContent = '✓ Account created';
              try {
                localStorage.setItem('sc_pending_email', email);
              } catch (e) {}

              var dest =
                res.data && res.data.session
                  ? '/dashboard'
                  : '/verify-email?email=' + encodeURIComponent(email);
              setTimeout(function () {
                window.location.href = dest;
              }, 700);
            })
            .catch(function (err) {
              SA.setBusy(submitBtn, false);
              submitBtn.classList.remove('success');
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