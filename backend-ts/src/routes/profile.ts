import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export default async function profileRoutes(server: FastifyInstance) {
  // Middleware to verify JWT token
  server.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  server.get('/', async (request, reply) => {
    const user = request.user as any;
    const cacheKey = `profile:${user.id}`;
    
    try {
      // Check cache first
      const cachedProfile = await server.redis.get(cacheKey);
      if (cachedProfile) {
        return { profile: JSON.parse(cachedProfile), cached: true };
      }

      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        include: {
          user: {
            select: { username: true, email: true }
          }
        }
      });

      if (!profile) {
        return reply.code(404).send({ error: 'Profile not found' });
      }

      // Set cache for 1 hour
      await server.redis.set(cacheKey, JSON.stringify(profile), 'EX', 3600);

      return { profile, cached: false };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.put('/', async (request, reply) => {
    const user = request.user as any;
    const { headline, bio, skills, interests, location, linkedinUrl, websiteUrl } = request.body as any;

    try {
      const profile = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          headline,
          bio,
          skills,
          interests,
          location,
          linkedinUrl,
          websiteUrl,
        }
      });

      // Invalidate cache
      const cacheKey = `profile:${user.id}`;
      await server.redis.del(cacheKey);

      return { message: 'Profile updated successfully', profile };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Example of RBAC: only mentors can access this route (just an example for now)
  server.get('/mentor-only-data', async (request, reply) => {
    const user = request.user as any;

    if (user.role !== 'mentor') {
      return reply.code(403).send({ error: 'Forbidden: Requires mentor role' });
    }

    return { data: 'This is restricted data only for mentors' };
  });
}
