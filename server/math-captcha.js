import crypto from 'node:crypto';

// Server-side math challenge ("human verification").
//
// The challenge is generated here, the expected answer is stored in memory
// keyed by a random challenge id, and the frontend only ever receives the id
// and the expression to display ("8 + 7"). The answer is never sent to the
// browser, so it cannot be trusted from client-side JavaScript alone — every
// answer is validated by this module on signup.

const store = new Map();
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 5000;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function createMathChallenge() {
  let left;
  let right;
  let operator;
  let answer;

  if (Math.random() < 0.5) {
    operator = '+';
    left = randInt(1, 8);
    right = randInt(1, 9 - left);
    answer = left + right;
  } else {
    operator = '-';
    left = randInt(2, 9);
    right = randInt(1, left - 1);
    answer = left - right;
  }

  const id = crypto.randomBytes(16).toString('hex');
  store.set(id, { answer, createdAt: Date.now() });

  // Keep the store bounded: drop expired entries once it grows past a cap.
  if (store.size > MAX_ENTRIES) {
    const now = Date.now();
    for (const [key, entry] of store) {
      if (now - entry.createdAt > TTL_MS) store.delete(key);
    }
  }

  return { id, expression: `${left} ${operator} ${right}` };
}

// Single use: the challenge is consumed on every verification attempt, so a
// validated answer cannot be replayed and stale challenges naturally expire.
export function verifyMathChallenge(id, answer) {
  if (!id) return { ok: false, reason: 'expired' };
  const entry = store.get(id);
  store.delete(id);

  if (!entry || Date.now() - entry.createdAt > TTL_MS) {
    return { ok: false, reason: 'expired' };
  }

  const userAnswer = Number(String(answer == null ? '' : answer).trim());
  if (!Number.isFinite(userAnswer) || userAnswer !== entry.answer) {
    return { ok: false, reason: 'incorrect' };
  }

  return { ok: true };
}