import { FastifyInstance } from 'fastify';
import { documentQueue } from '../queue.js';

export default async function documentRoutes(server: FastifyInstance) {
  const verifyToken = async (request: any, reply: any) => {
    try {
      await request.jwtVerify();
    } catch (err) {
      reply.send(err);
    }
  };

  server.post('/documents', { preValidation: [verifyToken] }, async (request, reply) => {
    const user = request.user as any;
    const { documentName } = request.body as { documentName: string };

    if (!documentName) {
      return reply.code(400).send({ error: 'documentName is required' });
    }

    try {
      // Add job to the BullMQ queue
      const job = await documentQueue.add('process-document', {
        userId: user.id,
        documentName
      });

      // Instantly return 202 Accepted
      return reply.code(202).send({ 
        message: 'Document processing started', 
        jobId: job.id 
      });
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Failed to enqueue document' });
    }
  });
}
