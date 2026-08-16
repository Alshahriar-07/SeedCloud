import crypto from 'node:crypto';
import { adminClient } from './supabase.js';

// Server-side math challenge ("human verification").
//
// The challenge is generated here, the expected answer is stored in Supabase
// (it must survive Vercel serverless invocations, which share no memory)
// keyed by a random challenge id, and the frontend only ever receives the id
// and the expression to display ("8 + 7"). The answer is never sent to the
// browser, so it cannot be trusted from client-side JavaScript alone — every
// answer is validated by this module on signup.
//
// Requires the `captcha_challenges` table from db/migration_serverless.sql.

const TTL_MS = 10 * 60 * 1000;

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export async function createMathChallenge() {
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
  const { error } = await adminClient.from('captcha_challenges').insert({
    id,
    answer,
    expires_at: new Date(Date.now() + TTL_MS).toISOString(),
  });
  if (error) throw error;

  // Opportunistic cleanup of expired challenges; best-effort.
  await adminClient
    .from('captcha_challenges')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .catch(() => {});

  return { id, expression: `${left} ${operator} ${right}` };
}

// Single use: the challenge is deleted on every verification attempt, so a
// validated answer cannot be replayed and stale challenges naturally expire.
export async function verifyMathChallenge(id, answer) {
  if (!id) return { ok: false, reason: 'expired' };
  const { data } = await adminClient
    .from('captcha_challenges')
    .select('answer, expires_at')
    .eq('id', id)
    .maybeSingle();
  await adminClient.from('captcha_challenges').delete().eq('id', id).catch(() => {});

  if (!data || Date.now() > new Date(data.expires_at).getTime()) {
    return { ok: false, reason: 'expired' };
  }

  const userAnswer = Number(String(answer == null ? '' : answer).trim());
  if (!Number.isFinite(userAnswer) || userAnswer !== data.answer) {
    return { ok: false, reason: 'incorrect' };
  }

  return { ok: true };
}