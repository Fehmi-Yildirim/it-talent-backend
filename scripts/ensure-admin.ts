
import 'dotenv/config';
import * as argon2 from 'argon2';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

async function main() {
    const connectionString = process.env.DATABASE_URL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!connectionString) {
        throw new Error('DATABASE_URL is not defined');
    }

    if (!adminEmail || !adminPassword) {
        throw new Error(
            'ADMIN_EMAIL and ADMIN_PASSWORD must be defined',
        );
    }

    if (adminPassword.length < 8) {
        throw new Error(
            'ADMIN_PASSWORD must contain at least 8 characters',
        );
    }

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({ adapter });

    try {
        const existingAdmin = await prisma.user.findFirst({
            where: { role: 'ADMIN' },
            select: { id: true, email: true },
        });

        if (existingAdmin) {
            console.log(
                `ADMIN already exists: ${existingAdmin.email}`,
            );
            return;
        }

        const existingUser = await prisma.user.findUnique({
            where: { email: adminEmail },
            select: { id: true },
        });

        if (existingUser) {
            throw new Error(
                `${adminEmail} already exists but is not an ADMIN.`,
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
                role: true,
                status: true,
            },
        });

        console.log('Admin account created successfully:');
        console.log(admin);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error('Failed to ensure admin account.');
    console.error(error);
    process.exitCode = 1;
});
