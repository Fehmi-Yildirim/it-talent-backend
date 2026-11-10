import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

const ADMIN_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1';
const CANDIDATE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb1';
const CANDIDATE_PROFILE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb2';

async function ensureUser(
  prisma: Pick<PrismaClient, 'user'>,
  input: {
    id: string;
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    role: 'ADMIN' | 'CANDIDATE';
  },
) {
  const existingById = await prisma.user.findUnique({
    where: { id: input.id },
  });

  const existingByEmail = await prisma.user.findUnique({
    where: { email: input.email },
  });

  if (
    existingById &&
    existingByEmail &&
    existingById.id !== existingByEmail.id
  ) {
    throw new Error(`E2E account identity conflict: ${input.email}`);
  }

  const existing = existingById ?? existingByEmail;

  if (existing) {
    if (
      existing.id !== input.id ||
      existing.email !== input.email ||
      existing.role !== input.role ||
      existing.status !== 'ACTIVE'
    ) {
      throw new Error(
        `Existing account does not match E2E fixture: ${input.email}`,
      );
    }

    const passwordMatches = await argon2.verify(
      existing.passwordHash,
      input.password,
    );

    if (!passwordMatches) {
      throw new Error(
        `Existing E2E account has an unexpected password: ${input.email}`,
      );
    }

    return existing;
  }

  const passwordHash = await argon2.hash(input.password);

  return prisma.user.create({
    data: {
      id: input.id,
      email: input.email,
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      status: 'ACTIVE',
    },
  });
}

async function main() {
  if (process.env.NODE_ENV !== 'test') {
    throw new Error('E2E seed is only allowed when NODE_ENV=test');
  }

  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL is not defined');
  }

  const databaseUrl = new URL(connectionString);

  if (!['localhost', '127.0.0.1', '::1'].includes(databaseUrl.hostname)) {
    throw new Error('E2E seed is only allowed against a local test database');
  }

  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD;

  if (!adminPassword || !candidatePassword) {
    throw new Error(
      'E2E_ADMIN_PASSWORD and E2E_CANDIDATE_PASSWORD must be defined',
    );
  }

  const adapter = new PrismaPg({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    await prisma.$transaction(async (tx) => {
      await ensureUser(tx, {
        id: ADMIN_ID,
        email: 'admin@example.com',
        password: adminPassword,
        firstName: 'E2E',
        lastName: 'Admin',
        role: 'ADMIN',
      });

      const candidate = await ensureUser(tx as PrismaClient, {
        id: CANDIDATE_ID,
        email: 'candidate@example.com',
        password: candidatePassword,
        firstName: 'E2E',
        lastName: 'Candidate',
        role: 'CANDIDATE',
      });

      const existingProfile = await tx.candidate.findUnique({
        where: { userId: candidate.id },
      });

      const profileWithId = await tx.candidate.findUnique({
        where: { id: CANDIDATE_PROFILE_ID },
      });

      if (existingProfile && existingProfile.id !== CANDIDATE_PROFILE_ID) {
        throw new Error('Candidate account already has a different profile');
      }

      if (profileWithId && profileWithId.userId !== candidate.id) {
        throw new Error('E2E candidate profile ID is already in use');
      }

      if (!existingProfile && !profileWithId) {
        await tx.candidate.create({
          data: {
            id: CANDIDATE_PROFILE_ID,
            userId: candidate.id,
          },
        });
      }
    });

    console.log('E2E seed completed successfully.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error('E2E seed failed:', error);
  process.exit(1);
});
