import { PrismaClient } from '@prisma/client';

// Prisma client initialization with connection URL from env
// According to Prisma 7, we pass the URL directly into the client constructor when not using an adapter.
export const prisma = new PrismaClient();
