import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export default async function connectionRoutes(server: FastifyInstance) {
  const verifyToken = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  };

  server.post('/connections/request', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    const { user_id } = request.body as any;

    if (!user_id) {
      return reply.code(400).send({ error: 'user_id is required' });
    }

    if (user.id === Number(user_id)) {
      return reply.code(400).send({ error: 'You cannot connect with yourself' });
    }

    try {
      const existingConnection = await prisma.connection.findFirst({
        where: {
          OR: [
            { requesterId: user.id, receiverId: Number(user_id) },
            { requesterId: Number(user_id), receiverId: user.id }
          ]
        }
      });

      if (existingConnection) {
        return reply.code(409).send({ error: 'Connection request already exists or you are already connected' });
      }

      const connection = await prisma.connection.create({
        data: {
          requesterId: user.id,
          receiverId: Number(user_id),
        }
      });

      return { message: 'Connection request sent successfully', connection };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.put('/connections/:id', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;
    const { action } = request.body as any;

    if (!action || !['accept', 'decline'].includes(action)) {
      return reply.code(400).send({ error: 'Valid action (accept/decline) is required' });
    }

    try {
      const connection = await prisma.connection.findUnique({
        where: { id: Number(id) }
      });

      if (!connection) {
        return reply.code(404).send({ error: 'Connection not found' });
      }

      if (connection.receiverId !== user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updatedConnection = await prisma.connection.update({
        where: { id: connection.id },
        data: {
          status: action === 'accept' ? 'accepted' : 'declined',
          acceptedAt: action === 'accept' ? new Date() : null,
        }
      });

      return updatedConnection;
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.delete('/connections/:id', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    const { id } = request.params as any;

    try {
      const connection = await prisma.connection.findUnique({
        where: { id: Number(id) }
      });

      if (!connection) {
        return reply.code(404).send({ error: 'Connection not found' });
      }

      if (connection.requesterId !== user.id && connection.receiverId !== user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      await prisma.connection.delete({ where: { id: connection.id } });

      return reply.code(204).send();
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/connections', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;

    try {
      const connections = await prisma.connection.findMany({
        where: {
          OR: [
            { requesterId: user.id },
            { receiverId: user.id }
          ]
        },
        include: {
          requester: { select: { id: true, username: true, email: true } },
          receiver: { select: { id: true, username: true, email: true } }
        }
      });

      const incoming = [];
      const outgoing = [];
      const current = [];

      for (const conn of connections) {
        const formattedConn = {
          ...conn,
          created_at: conn.createdAt,
          accepted_at: conn.acceptedAt
        };

        if (conn.status === 'accepted') {
          current.push(formattedConn);
        } else if (conn.status === 'pending') {
          if (conn.receiverId === user.id) {
            incoming.push(formattedConn);
          } else {
            outgoing.push(formattedConn);
          }
        }
      }

      return { incoming, outgoing, current };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
