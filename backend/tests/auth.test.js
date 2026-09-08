import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../src/app.js';

describe('POST /api/auth/signup', () => {
  it('creates a tenant and a user scoped to it', async () => {
    const res = await request(app).post('/api/auth/signup').send({
      email: 'alice@example.com',
      password: 'password123',
      tenantName: 'Acme Inc',
    });

    expect(res.status).toBe(201);
    expect(res.body.tenant.name).toBe('Acme Inc');
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.tenantId).toBe(res.body.tenant.id);
  });

  it('rejects a signup for an email that already exists', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'bob@example.com',
      password: 'password123',
      tenantName: 'Bob Co',
    });

    const res = await request(app).post('/api/auth/signup').send({
      email: 'bob@example.com',
      password: 'password456',
      tenantName: 'Bob Co 2',
    });

    expect(res.status).toBe(409);
  });

  it('rejects a signup missing required fields', async () => {
    const res = await request(app).post('/api/auth/signup').send({ email: 'nofields@example.com' });
    expect(res.status).toBe(400);
  });
});

describe('POST /api/auth/login', () => {
  it('issues a JWT whose payload contains userId and tenantId matching the signed-up user', async () => {
    const signupRes = await request(app).post('/api/auth/signup').send({
      email: 'carol@example.com',
      password: 'password123',
      tenantName: 'Carol LLC',
    });

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'carol@example.com',
      password: 'password123',
    });

    expect(loginRes.status).toBe(200);
    expect(loginRes.body.token).toBeTruthy();

    const decoded = jwt.decode(loginRes.body.token);
    expect(decoded.userId).toBe(signupRes.body.user.id);
    expect(decoded.tenantId).toBe(signupRes.body.tenant.id);
  });

  it('rejects invalid credentials', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'nonexistent@example.com',
      password: 'whatever',
    });
    expect(res.status).toBe(401);
  });

  it('rejects a correct email with the wrong password', async () => {
    await request(app).post('/api/auth/signup').send({
      email: 'dave@example.com',
      password: 'correct-password',
      tenantName: 'Dave Inc',
    });

    const res = await request(app).post('/api/auth/login').send({
      email: 'dave@example.com',
      password: 'wrong-password',
    });

    expect(res.status).toBe(401);
  });
});
