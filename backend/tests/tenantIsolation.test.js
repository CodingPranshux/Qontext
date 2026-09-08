import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../src/app.js';

let counter = 0;
async function signupAndLogin() {
  counter += 1;
  const email = `user${counter}@example.com`;
  const password = 'password123';
  const tenantName = `Tenant ${counter}`;

  await request(app).post('/api/auth/signup').send({ email, password, tenantName });
  const loginRes = await request(app).post('/api/auth/login').send({ email, password });
  return loginRes.body; // { token, user: { id, email, tenantId } }
}

describe('tenant_id derivation on protected routes', () => {
  it('attaches the tenantId and userId from a valid JWT to the request', async () => {
    const { token, user } = await signupAndLogin();

    const res = await request(app).get('/api/protected/me').set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(user.tenantId);
    expect(res.body.userId).toBe(user.id);
  });

  it('rejects a protected request with no Authorization header', async () => {
    const res = await request(app).get('/api/protected/me');
    expect(res.status).toBe(401);
  });

  it('rejects a protected request with an invalid/tampered token', async () => {
    const res = await request(app).get('/api/protected/me').set('Authorization', 'Bearer not-a-real-token');
    expect(res.status).toBe(401);
  });

  it('rejects a request that tries to pass tenantId in the request body', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/protected/echo')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenantId: '000000000000000000000000', foo: 'bar' });

    expect(res.status).toBe(400);
  });

  it('rejects a request that tries to pass tenant_id (snake_case) in the request body', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .post('/api/protected/echo')
      .set('Authorization', `Bearer ${token}`)
      .send({ tenant_id: '000000000000000000000000' });

    expect(res.status).toBe(400);
  });

  it('rejects a request that tries to pass tenantId as a query param', async () => {
    const { token } = await signupAndLogin();

    const res = await request(app)
      .get('/api/protected/me?tenantId=000000000000000000000000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
  });

  it('never lets one tenant read another tenant via a spoofed body tenantId - request is rejected outright', async () => {
    const tenantA = await signupAndLogin();
    const tenantB = await signupAndLogin();

    const res = await request(app)
      .post('/api/protected/echo')
      .set('Authorization', `Bearer ${tenantA.token}`)
      .send({ tenantId: tenantB.user.tenantId });

    expect(res.status).toBe(400);
  });

  it('a request with no forbidden fields still gets the correct tenantId attached from the JWT, not the body', async () => {
    const { token, user } = await signupAndLogin();

    const res = await request(app)
      .post('/api/protected/echo')
      .set('Authorization', `Bearer ${token}`)
      .send({ foo: 'bar' });

    expect(res.status).toBe(200);
    expect(res.body.tenantId).toBe(user.tenantId);
  });
});
