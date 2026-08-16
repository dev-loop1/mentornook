import { FastifyInstance } from 'fastify';
import bcrypt from 'bcrypt';
import { prisma } from '../db.js';

export default async function authRoutes(server: FastifyInstance) {
  server.post('/register', async (request, reply) => {
    const { username, email, password, first_name, last_name, role } = request.body as any;

    if (!username || !email || !password) {
      return reply.code(400).send({ error: 'Username, email, and password are required' });
    }

    try {
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [{ email }, { username }]
        }
      });

      if (existingUser) {
        return reply.code(409).send({ error: 'Username or email already in use' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: hashedPassword,
          role: role || 'MENTEE',
          profile: {
            create: {}
          }
        },
        include: { profile: true }
      });

      const token = server.jwt.sign({ id: user.id, username: user.username, role: user.role });
      
      return { 
        message: 'User registered successfully', 
        token, 
        user: { id: user.id, username: user.username, email: user.email, role: user.role } 
      };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.post('/login', async (request, reply) => {
    const { username, password } = request.body as any;

    if (!username || !password) {
      return reply.code(400).send({ error: 'Username and password are required' });
    }

    try {
      const user = await prisma.user.findUnique({
        where: { username },
        include: { profile: true }
      });

      if (!user) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const isValidPassword = await bcrypt.compare(password, user.password);

      if (!isValidPassword) {
        return reply.code(401).send({ error: 'Invalid credentials' });
      }

      const token = server.jwt.sign({ id: user.id, username: user.username, role: user.role });

      return { 
        message: 'Login successful', 
        token, 
        user: { id: user.id, username: user.username, role: user.role } 
      };
    } catch (error) {
      server.log.error(error);
      return reply.code(500).send({ error: 'Internal Server Error' });
    }
  });

  server.post('/logout', async (request, reply) => {
    return { success: true, message: 'Logged out successfully' };
  });
}
