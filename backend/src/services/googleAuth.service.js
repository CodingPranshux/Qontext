import { OAuth2Client } from 'google-auth-library';
import { config } from '../config/index.js';

let client;

/**
 * Verifies a Google ID token (the credential the frontend's Google Identity
 * Services button hands back) against our own client ID as the expected
 * audience, using Google's published signing keys — this is what stops
 * someone from handing us a token minted for a different app. Returns just
 * the fields we actually trust and use; everything else in the payload is
 * ignored.
 */
export async function verifyGoogleIdToken(idToken) {
  if (!config.google.clientId) {
    const err = new Error('GOOGLE_CLIENT_ID is not configured');
    err.status = 500;
    throw err;
  }
  if (!idToken || typeof idToken !== 'string') {
    const err = new Error('idToken is required');
    err.status = 400;
    throw err;
  }

  client ??= new OAuth2Client(config.google.clientId);

  let ticket;
  try {
    ticket = await client.verifyIdToken({ idToken, audience: config.google.clientId });
  } catch {
    const err = new Error('Invalid Google credential');
    err.status = 401;
    throw err;
  }

  const payload = ticket.getPayload();
  if (!payload?.email || !payload.email_verified) {
    const err = new Error('Google account has no verified email');
    err.status = 401;
    throw err;
  }

  return { email: payload.email, name: payload.name || null };
}
