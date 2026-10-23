export type EnvironmentVariables = Record<string, unknown>;

const PLACEHOLDER_SECRET_PATTERN =
    /replace-with|change-me|your-secret|secret-key|example/i;

function requireNonEmptyString(
    config: EnvironmentVariables,
    key: string,
): string {
    const value = config[key];

    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new Error(`Environment variable ${key} must be defined`);
    }

    return value.trim();
}

function validateDatabaseUrl(value: string): void {
    let parsed: URL;

    try {
        parsed = new URL(value);
    } catch {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }

    if (
        !['postgres:', 'postgresql:'].includes(parsed.protocol) ||
        !parsed.hostname ||
        parsed.pathname.length <= 1
    ) {
        throw new Error('DATABASE_URL must be a valid PostgreSQL URL');
    }
}

function validateCorsOrigin(value: string, production: boolean): void {
    const origins = value.split(',').map((origin) => origin.trim());

    if (origins.some((origin) => origin.length === 0)) {
        throw new Error('CORS_ORIGIN contains an empty origin');
    }

    for (const origin of origins) {
        let parsed: URL;

        try {
            parsed = new URL(origin);
        } catch {
            throw new Error('CORS_ORIGIN must contain valid HTTP(S) origins');
        }

        if (
            !['http:', 'https:'].includes(parsed.protocol) ||
            parsed.origin !== origin.replace(/\/$/, '')
        ) {
            throw new Error('CORS_ORIGIN must contain valid HTTP(S) origins');
        }

        if (
            production &&
            ['localhost', '127.0.0.1', '::1'].includes(
                parsed.hostname.replace(/^\[|\]$/g, ''),
            )
        ) {
            throw new Error('CORS_ORIGIN must not use localhost in production');
        }
    }
}

export function validateEnvironment(
    config: EnvironmentVariables,
): EnvironmentVariables {
    const nodeEnv = config.NODE_ENV ?? 'development';

    if (
        typeof nodeEnv !== 'string' ||
        !['development', 'test', 'production'].includes(nodeEnv)
    ) {
        throw new Error('NODE_ENV must be development, test, or production');
    }

    const production = nodeEnv === 'production';

    const databaseUrl = requireNonEmptyString(config, 'DATABASE_URL');
    validateDatabaseUrl(databaseUrl);

    const jwtSecret = requireNonEmptyString(config, 'JWT_SECRET');

    if (PLACEHOLDER_SECRET_PATTERN.test(jwtSecret)) {
        throw new Error('JWT_SECRET must not be a placeholder value');
    }

    if (production && Buffer.byteLength(jwtSecret, 'utf8') < 32) {
        throw new Error('JWT_SECRET must be at least 32 bytes in production');
    }

    if (config.PORT !== undefined) {
        const port = Number(config.PORT);

        if (
            !Number.isInteger(port) ||
            port < 1 ||
            port > 65535
        ) {
            throw new Error('PORT must be an integer between 1 and 65535');
        }
    }

    const corsOrigin = config.CORS_ORIGIN;

    if (production && typeof corsOrigin !== 'string') {
        throw new Error('CORS_ORIGIN must be defined in production');
    }

    if (corsOrigin !== undefined) {
        if (typeof corsOrigin !== 'string' || corsOrigin.trim() === '') {
            throw new Error('CORS_ORIGIN must not be empty when defined');
        }

        validateCorsOrigin(corsOrigin, production);
    }

    return {
        ...config,
        NODE_ENV: nodeEnv,
    };
}
