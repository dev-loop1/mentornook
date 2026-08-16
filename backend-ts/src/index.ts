import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from '@fastify/jwt';
import rateLimit from '@fastify/rate-limit';
import fastifyRedis from '@fastify/redis';
import fastifyWebsocket from '@fastify/websocket';
import metricsPlugin from 'fastify-metrics';
import { prisma } from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import connectionRoutes from './routes/connection.js';
import websocketRoutes from './routes/websocket.js';
import documentRoutes from './routes/document.js';

const server = Fastify({
  ignoreTrailingSlash: true,
  logger: {
    level: 'info',
    // Emit structured JSON logs by default, but use pretty-print if running locally
    ...(process.env.NODE_ENV !== 'production' && {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      }
    })
  },
  genReqId: function (req) { return req.headers['x-request-id'] as string || crypto.randomUUID() }
});

server.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRFToken', 'Accept'],
});

server.register(jwt, {
  secret: process.env.JWT_SECRET || 'supersecret_development_key',
});

// Configure Redis (Temporarily disabled for local testing)
// server.register(fastifyRedis, {
//   host: process.env.REDIS_HOST || '127.0.0.1',
//   port: Number(process.env.REDIS_PORT) || 6379,
// });

// Configure rate limit utilizing Redis if available
server.register(rateLimit, {
  max: 100,
  timeWindow: '1 minute',
  // redis: server.redis, // This will use the redis connection once initialized
});

// Expose /metrics endpoint
server.register(metricsPlugin, {
  endpoint: '/metrics',
});

// Register WebSockets
server.register(fastifyWebsocket);

server.register(authRoutes, { prefix: '/api' });
server.register(profileRoutes, { prefix: '/api' });
server.register(connectionRoutes, { prefix: '/api' });
server.register(websocketRoutes, { prefix: '/api' });
server.register(documentRoutes, { prefix: '/api' });

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

// Ready check endpoint
server.get('/ready', async (request, reply) => {
  try {
    // Check both DB and Redis
    await prisma.$queryRaw`SELECT 1`;
    // if (server.redis) await server.redis.ping();
    return { status: 'ready', database: 'connected', redis: 'disabled' };
  } catch (error) {
    server.log.error(error, 'Readiness check failed');
    return reply.code(503).send({ status: 'not ready' });
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
