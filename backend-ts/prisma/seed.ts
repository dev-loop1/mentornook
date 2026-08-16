import { Role } from '@prisma/client';
import bcrypt from 'bcrypt';
import { prisma } from '../src/db.js';

async function main() {
  const passwordHash = await bcrypt.hash('password123', 10);

  // Create Admin
  const admin = await prisma.user.upsert({
    where: { email: 'admin@mentornook.com' },
    update: {},
    create: {
      email: 'admin@mentornook.com',
      username: 'admin',
      password: passwordHash,
      role: Role.ADMIN,
      profile: {
        create: {
          headline: 'System Administrator',
          bio: 'Overseeing MentorNook operations.',
        },
      },
    },
  });

  // Create Mentor
  const mentor = await prisma.user.upsert({
    where: { email: 'mentor@mentornook.com' },
    update: {},
    create: {
      email: 'mentor@mentornook.com',
      username: 'expert_mentor',
      password: passwordHash,
      role: Role.MENTOR,
      profile: {
        create: {
          headline: 'Senior Software Engineer',
          bio: '10 years of experience in backend systems.',
          skills: 'Node.js, TypeScript, PostgreSQL',
          interests: 'Mentorship, Open Source',
        },
      },
    },
  });

  // Create Mentee
  const mentee = await prisma.user.upsert({
    where: { email: 'mentee@mentornook.com' },
    update: {},
    create: {
      email: 'mentee@mentornook.com',
      username: 'eager_mentee',
      password: passwordHash,
      role: Role.MENTEE,
      profile: {
        create: {
          headline: 'Junior Developer',
          bio: 'Looking to level up in full-stack web development.',
          skills: 'JavaScript, HTML, CSS',
          interests: 'Web Dev, Cloud Architecture',
        },
      },
    },
  });

  console.log({ admin, mentor, mentee });
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
