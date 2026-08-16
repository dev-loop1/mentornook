import { FastifyRequest, FastifyReply } from 'fastify';

export const requireRole = (allowedRoles: string[]) => {
  return async (request: FastifyRequest, reply: FastifyReply) => {
    try {
      await request.jwtVerify();
      
      const user = request.user as { id: number; role: string };
      
      if (!allowedRoles.includes(user.role)) {
        reply.status(403).send({ error: 'Forbidden: Insufficient permissions' });
        return;
      }
    } catch (err) {
      reply.status(401).send({ error: 'Unauthorized: Invalid or missing token' });
    }
  };
};
