import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyRedis from '@fastify/redis';
import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import connectionRoutes from './routes/connection.js';

const server = Fastify({
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

// Register Plugins
server.register(cors, {
  origin: '*', // For development, allow all. Update for production.
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret_development_key',
});

// Redis setup for caching
server.register(fastifyRedis, {
  host: process.env.REDIS_HOST || '127.0.0.1',
  port: Number(process.env.REDIS_PORT) || 6379,
});

// Rate limiting
server.register(rateLimit, {
  max: 100, // 100 requests
  timeWindow: '1 minute'
});

// Register API Routes
server.register(authRoutes, { prefix: '/api/auth' });
server.register(profileRoutes, { prefix: '/api/profiles' });
server.register(connectionRoutes, { prefix: '/api/connections' });

// Health check endpoint
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
