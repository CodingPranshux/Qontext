import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';
import { verifyGoogleIdToken } from './googleAuth.service.js';

const SALT_ROUNDS = 10;

function slugify(value) {
  return (value || '').toLowerCase().replace(/[^a-z0-9-]/g, '');
}

/** Finds a free Tenant.name by appending a short random suffix on collision. */
async function generateUniqueTenantName(seed) {
  const base = slugify(seed) || 'workspace';
  let candidate = base;

  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (!(await Tenant.findOne({ name: candidate }))) return candidate;
    candidate = `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }

  throw new Error('Could not generate a unique tenant name');
}

export function signToken({ userId, tenantId }) {
  return jwt.sign({ userId, tenantId }, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn,
  });
}

export function verifyToken(token) {
  return jwt.verify(token, config.jwt.secret);
}

/**
 * Signup creates a brand-new tenant owned by this user. Joining an existing
 * tenant (invites) is out of scope for Phase 1.
 */
export async function signup({ email, password, tenantName }) {
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    const err = new Error('A user with this email already exists');
    err.status = 409;
    throw err;
  }

  const tenant = await Tenant.create({ name: tenantName });
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
  const user = await User.create({
    email: email.toLowerCase(),
    passwordHash,
    tenantId: tenant._id,
  });

  return { user, tenant };
}

export async function login({ email, password }) {
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    const err = new Error('Invalid email or password');
    err.status = 401;
    throw err;
  }

  // tenantId comes from the User record looked up server-side by email —
  // never from anything the client sent.
  const token = signToken({
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
  });

  return { token, user };
}

/**
 * "Continue with Google": verifies the ID token, then either logs an
 * existing user in or auto-provisions a brand-new tenant for a first-time
 * Google sign-in — mirrors signup()'s "every new user gets their own
 * tenant" model, just without a signup form to collect a tenant name from.
 */
export async function loginWithGoogle({ idToken }) {
  const { email } = await verifyGoogleIdToken(idToken);
  const normalizedEmail = email.toLowerCase();

  let user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    const tenantName = await generateUniqueTenantName(normalizedEmail.split('@')[0]);
    const tenant = await Tenant.create({ name: tenantName });
    // Google-authenticated accounts never use a password — a random,
    // never-surfaced hash keeps `passwordHash` populated (the schema
    // requires it) without creating a guessable credential.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), SALT_ROUNDS);
    user = await User.create({ email: normalizedEmail, passwordHash, tenantId: tenant._id });
  }

  const token = signToken({
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
  });

  return { token, user };
}
