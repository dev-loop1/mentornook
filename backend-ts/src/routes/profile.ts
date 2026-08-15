import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

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
        include: { user: { select: { username: true, email: true } } }
      });

      if (!profile) {
        return reply.code(404).send({ error: 'Profile not found' });
      }

      const skills_list = profile.skills ? profile.skills.split(',') : [];
      const interests_list = profile.interests ? profile.interests.split(',') : [];
      const profileData = { ...profile, name: profile.user.username, skills_list, interests_list };

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
      const profile = await prisma.profile.update({
        where: { userId: user.id },
        data: {
          headline,
          bio,
          skills,
          interests,
          location,
          linkedinUrl: linkedin_url,
          websiteUrl: website_url,
          role: role || undefined,
        }
      });

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
        include: { user: { select: { id: true, username: true } } }
      });
      if (!profile) return reply.code(404).send({ error: 'Profile not found' });
      
      const skills_list = profile.skills ? profile.skills.split(',') : [];
      const interests_list = profile.interests ? profile.interests.split(',') : [];

      return { ...profile, name: profile.user.username, skills_list, interests_list };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/users', async (request, reply) => {
    try {
      const profiles = await prisma.profile.findMany({
        include: { user: { select: { id: true, username: true } } }
      });
      
      const results = profiles.map(p => ({
        ...p,
        name: p.user.username,
        skills_list: p.skills ? p.skills.split(',') : [],
        interests_list: p.interests ? p.interests.split(',') : [],
      }));

      return { count: results.length, results };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
