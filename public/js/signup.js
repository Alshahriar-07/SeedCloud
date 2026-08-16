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
  var captchaQuestion = document.getElementById('captcha-question');
  var captchaAnswer = document.getElementById('captcha-answer');
  var captchaHint = document.getElementById('captcha-hint');
  var captchaRefresh = document.getElementById('captcha-refresh');

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // The challenge id comes from the server; the expected answer stays server-side.
  var challenge = null;

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

  function loadChallenge() {
    return fetch('/api/captcha', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('captcha unavailable');
        return r.json();
      })
      .then(function (data) {
        challenge = { id: data.id };
        captchaQuestion.textContent = 'What is ' + data.expression + '?';
        captchaAnswer.value = '';
        setHint(captchaHint, null);
        captchaAnswer.focus();
      })
      .catch(function () {
        challenge = null;
        captchaQuestion.textContent = 'Human verification unavailable';
        setHint(captchaHint, 'Could not load the question. Please refresh and try again.');
      });
  }

  function validateCaptcha() {
    if (!challenge) {
      setHint(captchaHint, 'Please generate a new question.');
      return false;
    }
    if (!captchaAnswer.value.trim()) {
      setHint(captchaHint, 'Please solve the calculation.');
      return false;
    }
    setHint(captchaHint, null);
    return true;
  }

  nameInput.addEventListener('input', validateName);
  emailInput.addEventListener('input', function () {
    errBox.hidden = true;
    setHint(emailHint, null);
  });
  passwordInput.addEventListener('input', validatePassword);
  confirmInput.addEventListener('input', validateConfirm);
  captchaRefresh.addEventListener('click', loadChallenge);
  captchaAnswer.addEventListener('input', function () {
    setHint(captchaHint, null);
  });

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
        loadChallenge();

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          errBox.hidden = true;
          if (!validate()) return;
          if (!validateCaptcha()) return;

          var name = nameInput.value.trim();
          var email = emailInput.value.trim();
          var password = passwordInput.value;

          SA.setBusy(submitBtn, true, 'Creating account…');

          fetch('/api/captcha/verify', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ challengeId: challenge.id, answer: captchaAnswer.value.trim() }),
          })
            .then(function (r) {
              return r.json().then(function (data) {
                return { ok: r.ok, data: data };
              });
            })
            .then(function (result) {
              if (!result.ok) {
                var reason = (result.data && result.data.error) || 'incorrect';
                if (reason === 'expired') {
                  setHint(captchaHint, 'Please generate a new question.');
                } else {
                  setHint(captchaHint, 'Incorrect answer. Try again.');
                }
                // A failed attempt is single-use: always issue a fresh question.
                return loadChallenge().then(function () {
                  SA.setBusy(submitBtn, false);
                });
              }

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
                });
            })
            .catch(function (err) {
              SA.setBusy(submitBtn, false);
              submitBtn.classList.remove('success');
              showError(SA.friendlyAuthError(err));
              loadChallenge();
            });
        });
      });
    })
    .catch(function () {
      showError('Could not load configuration. Is the Seed Cloud server running?');
      SA.hideLoading();
    });
})();