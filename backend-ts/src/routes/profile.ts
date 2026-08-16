import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';
import { requireRole } from '../middleware/rbac.js';

export default async function profileRoutes(server: FastifyInstance) {
  const verifyToken = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  };

  server.get('/profile', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: user.id },
        include: { user: { select: { username: true, email: true, role: true } } }
      });

      if (!profile) {
        return reply.code(404).send({ error: 'Profile not found' });
      }

      const skills_list = profile.skills ? profile.skills.split(',') : [];
      const interests_list = profile.interests ? profile.interests.split(',') : [];
      const profileData = { ...profile, name: profile.user.username, role: profile.user.role, skills_list, interests_list };

      return profileData; 
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.put('/profile', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    const { headline, bio, skills, interests, location, linkedin_url, website_url, role } = request.body as any;

    try {
      const profile = await prisma.profile.upsert({
        where: { userId: user.id },
        update: {
          headline,
          bio,
          skills,
          interests,
          location,
          linkedinUrl: linkedin_url,
          websiteUrl: website_url,
        },
        create: {
          userId: user.id,
          headline,
          bio,
          skills,
          interests,
          location,
          linkedinUrl: linkedin_url,
          websiteUrl: website_url,
        }
      });
      
      if (role) {
        await prisma.user.update({
          where: { id: user.id },
          data: { role: role.toUpperCase() }
        });
      }

      // Invalidate Redis caches for mentor discovery
      if (server.redis) {
        const keys = await server.redis.keys('mentors:*');
        if (keys.length > 0) {
          await server.redis.del(...keys);
        }
      }

      return profile;
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.delete('/profile', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    try {
      await prisma.user.delete({ where: { id: user.id } });
      
      if (server.redis) {
        const keys = await server.redis.keys('mentors:*');
        if (keys.length > 0) await server.redis.del(...keys);
      }
      
      return reply.code(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/profiles/:id', async (request, reply) => {
    const { id } = request.params as any;
    try {
      const profile = await prisma.profile.findUnique({
        where: { userId: Number(id) },
        include: { user: { select: { id: true, username: true, role: true } } }
      });
      if (!profile) return reply.code(404).send({ error: 'Profile not found' });
      
      const skills_list = profile.skills ? profile.skills.split(',') : [];
      const interests_list = profile.interests ? profile.interests.split(',') : [];

      return { ...profile, name: profile.user.username, role: profile.user.role, skills_list, interests_list };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Filtered User Discovery with Cursor Pagination & Redis Caching
  server.get('/users', async (request, reply) => {
    const { cursor, page, limit = 10, skill, role } = request.query as any;
    
    // Support page-based pagination for frontend compatibility if page is provided
    const parsedLimit = Number(limit);
    const parsedPage = page ? Number(page) : 1;
    const skipAmount = page ? (parsedPage - 1) * parsedLimit : (cursor ? 1 : 0);

    const cacheKey = `users:${cursor || 'page' + parsedPage}:${limit}:${skill || 'all'}:${role || 'all'}`;
    
    if (server.redis) {
      const cached = await server.redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }
    }

    try {
      const queryParams: any = {
        take: parsedLimit + (cursor ? 1 : 0), // take 1 extra for cursor
        where: {},
        include: { user: { select: { id: true, username: true, role: true } } },
        orderBy: { id: 'asc' },
        skip: skipAmount
      };

      if (cursor) {
        queryParams.cursor = { id: Number(cursor) };
      }

      if (role) {
         queryParams.where.user = { role: role.toUpperCase() };
      }

      if (skill) {
        queryParams.where.skills = { contains: skill, mode: 'insensitive' };
      }

      const [profiles, totalCount] = await Promise.all([
        prisma.profile.findMany(queryParams),
        prisma.profile.count({ where: queryParams.where })
      ]);

      let nextCursor = null;
      if (profiles.length > parsedLimit && cursor) {
        const nextItem = profiles.pop(); // remove the extra item
        nextCursor = nextItem?.id;
      } else if (profiles.length > parsedLimit) {
        profiles.pop(); // remove extra if no cursor but still over limit
      }

      const results = profiles.map((p: any) => ({
        ...p,
        name: p.user.username,
        role: p.user.role,
        skills_list: p.skills ? p.skills.split(',') : [],
        interests_list: p.interests ? p.interests.split(',') : [],
      }));

      const responsePayload = {
        data: results, // Frontend uses response.data directly in discovery.js if not using .results
        results: results,
        count: totalCount,
        nextCursor
      };

      if (server.redis) {
        // Cache for 5 minutes
        await server.redis.setex(cacheKey, 300, JSON.stringify(responsePayload));
      }

      return responsePayload;
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  // Admin-only route to delete a profile
  server.delete('/mentors/:id', { preValidation: [verifyToken, requireRole(['ADMIN'])] }, async (request, reply) => {
    const { id } = request.params as any;
    try {
      await prisma.user.delete({ where: { id: Number(id) } });
      
      if (server.redis) {
        const keys = await server.redis.keys('mentors:*');
        if (keys.length > 0) await server.redis.del(...keys);
      }

      return reply.code(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
