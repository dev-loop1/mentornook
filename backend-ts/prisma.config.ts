import { defineConfig } from '@prisma/config';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env explicitly to ensure they are available
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

export default defineConfig({
  datasource: {
    url: process.env["DATABASE_URL"],
  },
  migrations: {
    seed: 'npx tsx prisma/seed.ts',
  },
});
