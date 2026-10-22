
import 'dotenv/config';
import * as argon2 from 'argon2';

import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    const candidateEmail = process.env.E2E_CANDIDATE_EMAIL;
    const candidatePassword = process.env.E2E_CANDIDATE_PASSWORD;

    const recruiterEmail = process.env.E2E_RECRUITER_EMAIL;
    const recruiterPassword = process.env.E2E_RECRUITER_PASSWORD;

    if (!adminEmail || !adminPassword) {
        throw new Error(
            'ADMIN_EMAIL and ADMIN_PASSWORD must be defined',
        );
    }

    if (!candidateEmail || !candidatePassword) {
        throw new Error(
            'E2E_CANDIDATE_EMAIL and E2E_CANDIDATE_PASSWORD must be defined',
        );
    }

    if (!recruiterEmail || !recruiterPassword) {
        throw new Error(
            'E2E_RECRUITER_EMAIL and E2E_RECRUITER_PASSWORD must be defined',
        );
    }

    if (process.env.NODE_ENV === 'production') {
        throw new Error(
            'This script is intended for development and test environments only',
        );
    }

    const adapter = new PrismaPg({
        connectionString,
    });

    const prisma = new PrismaClient({ adapter });

    try {
        // ------------------------------------------------------------
        // Bootstrap ADMIN
        // ------------------------------------------------------------

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
                    firstName: 'Admin',
                    lastName: 'User',
                    role: 'ADMIN',
                    status: 'ACTIVE',
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
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

        const candidatePasswordHash =
            await argon2.hash(candidatePassword);

        const candidate = await prisma.user.upsert({
            where: {
                email: candidateEmail,
            },
            update: {
                passwordHash: candidatePasswordHash,
                firstName: 'Candidate',
                lastName: 'User',
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
            create: {
                email: candidateEmail,
                passwordHash: candidatePasswordHash,
                firstName: 'Candidate',
                lastName: 'User',
                role: 'CANDIDATE',
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                firstName: true,
                lastName: true,
                role: true,
                status: true,
            },
        });

        console.log('E2E CANDIDATE ready:');
        console.log(candidate);

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

        // ------------------------------------------------------------
        // E2E RECRUITER
        // ------------------------------------------------------------

        const recruiterPasswordHash =
            await argon2.hash(recruiterPassword);

        const recruiterUser = await prisma.user.upsert({
            where: {
                email: recruiterEmail,
            },
            update: {
                passwordHash: recruiterPasswordHash,
                firstName: 'Recruiter',
                lastName: 'User',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
            create: {
                email: recruiterEmail,
                passwordHash: recruiterPasswordHash,
                firstName: 'Recruiter',
                lastName: 'User',
                role: 'RECRUITER',
                status: 'ACTIVE',
            },
            select: {
                id: true,
                email: true,
                role: true,
                status: true,
            },
        });

        console.log('E2E RECRUITER ready:');
        console.log(recruiterUser);

        // ------------------------------------------------------------
        // E2E COMPANY
        // ------------------------------------------------------------

        const company = await prisma.company.upsert({
            where: {
                slug: 'it-talent-test-company',
            },
            update: {
                name: 'IT Talent Test Company',
                website: 'https://example.com',
                description:
                    'Test company for recruiter and job E2E testing.',
                location: 'Amsterdam',
            },
            create: {
                name: 'IT Talent Test Company',
                slug: 'it-talent-test-company',
                website: 'https://example.com',
                description:
                    'Test company for recruiter and job E2E testing.',
                location: 'Amsterdam',
            },
            select: {
                id: true,
                name: true,
                slug: true,
            },
        });

        console.log('E2E COMPANY ready:');
        console.log(company);

        // ------------------------------------------------------------
        // Recruiter profile
        // ------------------------------------------------------------

        const recruiterProfile =
            await prisma.recruiter.upsert({
                where: {
                    userId: recruiterUser.id,
                },
                update: {
                    companyId: company.id,
                    jobTitle: 'Technical Recruiter',
                },
                create: {
                    userId: recruiterUser.id,
                    companyId: company.id,
                    jobTitle: 'Technical Recruiter',
                },
                select: {
                    id: true,
                    userId: true,
                    companyId: true,
                    jobTitle: true,
                },
            });

        console.log('E2E RECRUITER PROFILE ready:');
        console.log(recruiterProfile);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(
        'Failed to initialize development/test accounts.',
    );
    console.error(error);
    process.exitCode = 1;
});
