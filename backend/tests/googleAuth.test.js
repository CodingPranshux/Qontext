import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

// Google ID-token verification is a real network call to Google's own
// signing keys — mocked at the module boundary so the suite is
// deterministic with no network access or a real Google OAuth client.
const { verifyGoogleIdTokenMock } = vi.hoisted(() => ({
  verifyGoogleIdTokenMock: vi.fn(async (idToken) => {
    if (idToken === 'invalid-token') {
      const err = new Error('Invalid Google credential');
      err.status = 401;
      throw err;
    }
    // Tests pass the desired email as the "token" itself for simplicity.
    return { email: idToken, name: 'Test User' };
  }),
}));

vi.mock('../src/services/googleAuth.service.js', () => ({ verifyGoogleIdToken: verifyGoogleIdTokenMock }));

const { default: app } = await import('../src/app.js');
const { User } = await import('../src/models/User.js');
const { Tenant } = await import('../src/models/Tenant.js');

describe('POST /api/auth/google', () => {
  it('auto-provisions a brand-new tenant and user on first sign-in', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'newperson@gmail.com' });

    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.email).toBe('newperson@gmail.com');

    const user = await User.findOne({ email: 'newperson@gmail.com' });
    expect(user).toBeTruthy();
    const tenant = await Tenant.findById(user.tenantId);
    expect(tenant).toBeTruthy();
  });

  it('logs an existing user in without creating a second tenant', async () => {
    const first = await request(app).post('/api/auth/google').send({ idToken: 'returning@gmail.com' });
    const tenantCountBefore = await Tenant.countDocuments();

    const second = await request(app).post('/api/auth/google').send({ idToken: 'returning@gmail.com' });

    expect(second.status).toBe(200);
    expect(second.body.user.tenantId).toBe(first.body.user.tenantId);
    expect(await Tenant.countDocuments()).toBe(tenantCountBefore);
  });

  it('gives two different Google users distinct tenants even with the same local-part', async () => {
    const a = await request(app).post('/api/auth/google').send({ idToken: 'sameprefix@gmail.com' });
    const b = await request(app).post('/api/auth/google').send({ idToken: 'sameprefix@work.com' });

    expect(a.body.user.tenantId).not.toBe(b.body.user.tenantId);
  });

  it('rejects a request with no idToken', async () => {
    const res = await request(app).post('/api/auth/google').send({});
    expect(res.status).toBe(400);
  });

  it('rejects an invalid Google credential', async () => {
    const res = await request(app).post('/api/auth/google').send({ idToken: 'invalid-token' });
    expect(res.status).toBe(401);
  });

  it('lets an existing email/password user also sign in via Google (account by email)', async () => {
    await request(app)
      .post('/api/auth/signup')
      .send({ email: 'dual@example.com', password: 'password123', tenantName: 'Dual Tenant' });

    const res = await request(app).post('/api/auth/google').send({ idToken: 'dual@example.com' });
    expect(res.status).toBe(200);
    expect(await User.countDocuments({ email: 'dual@example.com' })).toBe(1);
  });
});
