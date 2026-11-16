
import {
    ServiceUnavailableException,
    UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';

import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

type DemoUser = {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: 'CANDIDATE' | 'RECRUITER' | 'ADMIN';
    status: 'ACTIVE' | 'PENDING';
    isDemo: boolean;
    passwordHash: string;
};

describe('AuthService demoLogin', () => {
    let service: AuthService;

    const prisma = {
        user: {
            findUnique: jest.fn(),
        },
    };

    const jwtService = {
        signAsync: jest.fn(),
    };

    const configService = {
        get: jest.fn(),
    };

    const createDemoUser = (
        overrides: Partial<DemoUser> = {},
    ): DemoUser => ({
        id: 'demo-user-123',
        email: 'demo@example.com',
        firstName: 'Demo',
        lastName: 'User',
        role: 'CANDIDATE',
        status: 'ACTIVE',
        isDemo: true,
        passwordHash: 'not-used-for-demo-login',
        ...overrides,
    });

    beforeEach(() => {
        jest.clearAllMocks();

        service = new AuthService(
            prisma as unknown as PrismaService,
            jwtService as unknown as JwtService,
            configService as unknown as ConfigService,
        );

        configService.get.mockReturnValue('demo@example.com');
        jwtService.signAsync.mockResolvedValue('demo-access-token');
    });

    it('logs in an active candidate demo account', async () => {
        const user = createDemoUser();
        prisma.user.findUnique.mockResolvedValue(user);

        const result = await service.demoLogin({
            role: 'CANDIDATE',
        });

        expect(configService.get).toHaveBeenCalledWith(
            'DEMO_CANDIDATE_EMAIL',
        );
        expect(prisma.user.findUnique).toHaveBeenCalledWith({
            where: { email: 'demo@example.com' },
        });
        expect(result.user).toEqual({
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
            status: user.status,
            isDemo: true,
        });
        expect(result.accessToken).toBe('demo-access-token');
        expect(jwtService.signAsync).toHaveBeenCalledWith({
            sub: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            role: user.role,
        });
    });

    it('logs in an active recruiter demo account', async () => {
        const user = createDemoUser({
            id: 'demo-recruiter-123',
            email: 'recruiter@example.com',
            role: 'RECRUITER',
        });

        configService.get.mockReturnValue('recruiter@example.com');
        prisma.user.findUnique.mockResolvedValue(user);

        const result = await service.demoLogin({
            role: 'RECRUITER',
        });

        expect(configService.get).toHaveBeenCalledWith(
            'DEMO_RECRUITER_EMAIL',
        );
        expect(result.user.role).toBe('RECRUITER');
        expect(result.user.isDemo).toBe(true);
        expect(result.accessToken).toBe('demo-access-token');
    });

    it('rejects demo login when the email configuration is missing', async () => {
        configService.get.mockReturnValue(undefined);

        await expect(
            service.demoLogin({ role: 'CANDIDATE' }),
        ).rejects.toBeInstanceOf(ServiceUnavailableException);

        expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });

    it('rejects demo login when the configured account does not exist', async () => {
        prisma.user.findUnique.mockResolvedValue(null);

        await expect(
            service.demoLogin({ role: 'CANDIDATE' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an account that is not marked as a demo account', async () => {
        prisma.user.findUnique.mockResolvedValue(
            createDemoUser({ isDemo: false }),
        );

        await expect(
            service.demoLogin({ role: 'CANDIDATE' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects an inactive demo account', async () => {
        prisma.user.findUnique.mockResolvedValue(
            createDemoUser({ status: 'PENDING' }),
        );

        await expect(
            service.demoLogin({ role: 'CANDIDATE' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('rejects a demo account with the wrong role', async () => {
        prisma.user.findUnique.mockResolvedValue(
            createDemoUser({ role: 'RECRUITER' }),
        );

        await expect(
            service.demoLogin({ role: 'CANDIDATE' }),
        ).rejects.toBeInstanceOf(UnauthorizedException);
    });
});
