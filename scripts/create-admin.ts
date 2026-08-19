import 'dotenv/config';
import * as argon2 from 'argon2';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
    }

    const adapter = new PrismaPg({
        connectionString,
    });

    const prisma = new PrismaClient({ adapter });

    try {
        // ------------------------------------------------------------
        // Bootstrap ADMIN
        // ------------------------------------------------------------

        const adminEmail = 'admin@example.com';
        const adminPassword = 'Admin12345!';

        const existingAdmin = await prisma.user.findFirst({
            where: {
                role: 'ADMIN',
            },
            select: {
                id: true,
                email: true,
            },
        });

        if (existingAdmin) {
            console.log(
                `ADMIN already exists: ${existingAdmin.email} (${existingAdmin.id})`,
            );
        } else {
            const existingAdminEmail = await prisma.user.findUnique({
                where: {
                    email: adminEmail,
                },
                select: {
                    id: true,
                },
            });

            if (existingAdminEmail) {
                throw new Error(
                    `${adminEmail} already exists but is not an ADMIN. Aborting.`,
                );
            }

            const passwordHash = await argon2.hash(adminPassword);

            const admin = await prisma.user.create({
                data: {
                    email: adminEmail,
                    passwordHash,
                    role: 'ADMIN',
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    email: true,
                    role: true,
                    status: true,
                },
            });

            console.log('Bootstrap ADMIN created:');
            console.log(admin);
        }

        // ------------------------------------------------------------
        // E2E CANDIDATE
        // ------------------------------------------------------------

        const candidateEmail = 'test2@example.com';
        const candidatePassword = 'Test12345!';

        const candidatePasswordHash =
            await argon2.hash(candidatePassword);

        const candidate = await prisma.user.upsert({
            where: {
                email: candidateEmail,
            },
            update: {
                passwordHash: candidatePasswordHash,
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
            create: {
                email: candidateEmail,
                passwordHash: candidatePasswordHash,
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
            },
        });

        console.log('E2E CANDIDATE ready:');
        console.log(candidate);
        console.log(`Email: ${candidateEmail}`);
        console.log(`Password: ${candidatePassword}`);

        // ------------------------------------------------------------
        // Candidate profile
        // ------------------------------------------------------------

        const existingCandidateProfile =
            await prisma.candidate.findUnique({
                where: {
                    userId: candidate.id,
                },
                select: {
                    id: true,
                },
            });

        if (existingCandidateProfile) {
            console.log(
                `Candidate profile already exists: ${existingCandidateProfile.id}`,
            );
        } else {
            const candidateProfile =
                await prisma.candidate.create({
                    data: {
                        userId: candidate.id,
                    },
                    select: {
                        id: true,
                        userId: true,
                    },
                });

            console.log('Candidate profile created:');
            console.log(candidateProfile);
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});