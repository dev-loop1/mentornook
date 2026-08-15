import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import connectionRoutes from './routes/connection.js';

const server = Fastify({
  ignoreTrailingSlash: true,
  logger: {
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss Z',
        ignore: 'pid,hostname',
      },
    },
  },
});

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRFToken', 'Accept'],
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret_development_key',
});

server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute'
});

server.register(authRoutes, { prefix: '/api' });
server.register(profileRoutes, { prefix: '/api' });
server.register(connectionRoutes, { prefix: '/api' });

server.get('/health', async (request, reply) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    server.log.error(error, 'Database connection failed');
    return reply.code(503).send({ status: 'error', database: 'disconnected' });
  }
});

const start = async () => {
  try {
    await server.listen({ port: 3000, host: '0.0.0.0' });
    server.log.info(`Server is listening on port 3000`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
