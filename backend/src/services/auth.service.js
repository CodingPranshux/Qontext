import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { User } from '../models/User.js';
import { Tenant } from '../models/Tenant.js';

const SALT_ROUNDS = 10;

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

  // This is the ONLY place a JWT is minted. tenantId comes from the User
  // record looked up server-side by email — never from anything the client sent.
  const token = signToken({
    userId: user._id.toString(),
    tenantId: user.tenantId.toString(),
  });

  return { token, user };
}
