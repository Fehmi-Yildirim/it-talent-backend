import { validateEnvironment } from './env.validation';

describe('validateEnvironment', () => {
    const validConfig = {
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/it_talent',
        JWT_SECRET: 'a-local-development-secret',
        CORS_ORIGIN: 'http://localhost:5173',
        PORT: '3000',
    };

    it('accepts valid development configuration', () => {
        expect(validateEnvironment(validConfig)).toMatchObject({
            NODE_ENV: 'development',
            DATABASE_URL: validConfig.DATABASE_URL,
        });
    });

    it('rejects a missing database URL', () => {
        const { DATABASE_URL, ...config } = validConfig;
        void DATABASE_URL;

        expect(() => validateEnvironment(config)).toThrow(
            'DATABASE_URL must be defined',
        );
    });

    it('rejects an invalid database URL', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                DATABASE_URL: 'mysql://localhost/it_talent',
            }),
        ).toThrow('DATABASE_URL must be a valid PostgreSQL URL');
    });

    it('rejects a missing JWT secret', () => {
        const { JWT_SECRET, ...config } = validConfig;
        void JWT_SECRET;

        expect(() => validateEnvironment(config)).toThrow(
            'JWT_SECRET must be defined',
        );
    });

    it('rejects a placeholder JWT secret', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                JWT_SECRET: 'replace-with-your-own-random-secret',
            }),
        ).toThrow('JWT_SECRET must not be a placeholder value');
    });

    it('requires a strong JWT secret in production', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                NODE_ENV: 'production',
                JWT_SECRET: 'too-short',
                CORS_ORIGIN: 'https://app.example.com',
            }),
        ).toThrow('JWT_SECRET must be at least 32 bytes in production');
    });

    it('requires CORS_ORIGIN in production', () => {
        const { CORS_ORIGIN, ...config } = validConfig;
        void CORS_ORIGIN;

        expect(() =>
            validateEnvironment({
                ...config,
                NODE_ENV: 'production',
                JWT_SECRET: 'a'.repeat(32),
            }),
        ).toThrow('CORS_ORIGIN must be defined in production');
    });

    it('rejects localhost CORS origins in production', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                NODE_ENV: 'production',
                JWT_SECRET: 'a'.repeat(32),
                CORS_ORIGIN: 'http://localhost:5173',
            }),
        ).toThrow('CORS_ORIGIN must not use localhost in production');
    });

    it('rejects an invalid port', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                PORT: '70000',
            }),
        ).toThrow('PORT must be an integer between 1 and 65535');
    });

    it('accepts valid production configuration', () => {
        expect(() =>
            validateEnvironment({
                ...validConfig,
                NODE_ENV: 'production',
                JWT_SECRET: 'a'.repeat(32),
                CORS_ORIGIN: 'https://app.example.com',
            }),
        ).not.toThrow();
    });

    it('uses the default CV upload size when not configured', () => {
        expect(validateEnvironment(validConfig)).toMatchObject({
            CV_MAX_FILE_SIZE_BYTES: 10 * 1024 * 1024,
        });
    });

    it('accepts a configured CV upload size', () => {
        expect(
            validateEnvironment({
                ...validConfig,
                CV_MAX_FILE_SIZE_BYTES: '5242880',
            }),
        ).toMatchObject({
            CV_MAX_FILE_SIZE_BYTES: 5 * 1024 * 1024,
        });
    });

    it.each(['0', '-1', 'abc', '1.5', '9007199254740992'])(
        'rejects invalid CV upload size: %s',
        (value) => {
            expect(() =>
                validateEnvironment({
                    ...validConfig,
                    CV_MAX_FILE_SIZE_BYTES: value,
                }),
            ).toThrow(
                'CV_MAX_FILE_SIZE_BYTES must be a positive safe integer',
            );
        },
    );
});
