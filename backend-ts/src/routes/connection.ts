import { FastifyInstance } from 'fastify';
import { prisma } from '../db.js';

export default async function connectionRoutes(server: FastifyInstance) {
  // Middleware to verify JWT token
  server.addHook('onRequest', async (request, reply) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  });

  server.post('/', async (request, reply) => {
    const user = request.user as any;
    const { receiverId } = request.body as any;

    if (!receiverId) {
      return reply.code(400).send({ error: 'receiverId is required' });
    }

    if (user.id === receiverId) {
      return reply.code(400).send({ error: 'You cannot connect with yourself' });
    }

    try {
      const existingConnection = await prisma.connection.findUnique({
        where: {
          requesterId_receiverId: {
            requesterId: user.id,
            receiverId: receiverId
          }
        }
      });

      if (existingConnection) {
        return reply.code(409).send({ error: 'Connection request already exists' });
      }

      const connection = await prisma.connection.create({
        data: {
          requesterId: user.id,
          receiverId: receiverId,
        }
      });

      return { message: 'Connection request sent successfully', connection };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.put('/:connectionId/status', async (request, reply) => {
    const user = request.user as any;
    const { connectionId } = request.params as any;
    const { status } = request.body as any;

    if (!status || !['accepted', 'declined'].includes(status)) {
      return reply.code(400).send({ error: 'Valid status (accepted/declined) is required' });
    }

    try {
      const connection = await prisma.connection.findUnique({
        where: { id: Number(connectionId) }
      });

      if (!connection) {
        return reply.code(404).send({ error: 'Connection not found' });
      }

      // Only the receiver can accept or decline
      if (connection.receiverId !== user.id) {
        return reply.code(403).send({ error: 'Forbidden' });
      }

      const updatedConnection = await prisma.connection.update({
        where: { id: connection.id },
        data: {
          status,
          acceptedAt: status === 'accepted' ? new Date() : null,
        }
      });

      return { message: `Connection ${status}`, connection: updatedConnection };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.get('/', async (request, reply) => {
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
          requester: { select: { id: true, username: true } },
          receiver: { select: { id: true, username: true } }
        }
      });

      return { connections };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });
}
