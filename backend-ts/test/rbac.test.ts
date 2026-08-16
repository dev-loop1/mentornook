import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import Fastify from 'fastify';
import jwt from '@fastify/jwt';
import authRoutes from '../src/routes/auth.js';
import profileRoutes from '../src/routes/profile.js';
import { requireRole } from '../src/middleware/rbac.js';

describe('RBAC Authorization', () => {
  const app = Fastify();

  beforeAll(async () => {
    app.register(jwt, { secret: 'test_secret' });
    
    // A mock protected route specifically for RBAC testing
    app.delete('/api/admin-only', { 
      preValidation: [
        async (req, rep) => req.jwtVerify(), 
        requireRole(['ADMIN'])
      ] 
    }, async (req, rep) => {
      return rep.code(204).send();
    });

    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('should allow ADMIN to access admin-only route', async () => {
    const token = app.jwt.sign({ id: 1, role: 'ADMIN' });
    
    const response = await request(app.server)
      .delete('/api/admin-only')
      .set('Authorization', `Bearer ${token}`);
      
    expect(response.status).toBe(204);
  });

  it('should block MENTEE from accessing admin-only route', async () => {
    const token = app.jwt.sign({ id: 2, role: 'MENTEE' });
    
    const response = await request(app.server)
      .delete('/api/admin-only')
      .set('Authorization', `Bearer ${token}`);
      
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Forbidden');
  });

  it('should block MENTOR from accessing admin-only route', async () => {
    const token = app.jwt.sign({ id: 3, role: 'MENTOR' });
    
    const response = await request(app.server)
      .delete('/api/admin-only')
      .set('Authorization', `Bearer ${token}`);
      
    expect(response.status).toBe(403);
    expect(response.body.error).toContain('Forbidden');
  });

  it('should block unauthenticated requests', async () => {
    const response = await request(app.server)
      .delete('/api/admin-only');
      
    expect(response.status).toBe(401);
  });
});
