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
            return;
        }

        const email = 'admin@example.com';
        const password = 'Admin12345!';

        const existingUser = await prisma.user.findUnique({
            where: { email },
            select: { id: true },
        });

        if (existingUser) {
            throw new Error(
                `${email} already exists but is not an ADMIN. Aborting.`,
            );
        }

        const passwordHash = await argon2.hash(password);

        const admin = await prisma.user.create({
            data: {
                email,
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
        console.log(`Email: ${email}`);
        console.log(`Password: ${password}`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});