const LOCAL_DEVELOPMENT_ORIGIN = 'http://localhost:5173';

export function getCorsOrigins(
  nodeEnv = process.env.NODE_ENV,
  corsOrigin = process.env.CORS_ORIGIN,
): string[] {
  const isProduction = nodeEnv === 'production';

  if (!corsOrigin?.trim()) {
    if (isProduction) {
      throw new Error(
        'CORS configuration error: CORS_ORIGIN must be explicitly set in production.',
      );
    }

    return [LOCAL_DEVELOPMENT_ORIGIN];
  }

  const origins = corsOrigin.split(',').map((origin) => origin.trim());

  if (origins.some((origin) => !origin)) {
    throw new Error(
      'CORS configuration error: CORS_ORIGIN contains an empty origin.',
    );
  }

  const validatedOrigins = origins.map((origin) => {
    if (origin === '*' || origin.includes('*')) {
      throw new Error(
        'CORS configuration error: wildcard origins are not allowed when credentials are enabled.',
      );
    }

    let parsed: URL;

    try {
      parsed = new URL(origin);
    } catch {
      throw new Error(
        `CORS configuration error: invalid origin "${origin}". Use a valid HTTP(S) origin.`,
      );
    }

    if (
      !['http:', 'https:'].includes(parsed.protocol) ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.origin !== origin
    ) {
      throw new Error(
        `CORS configuration error: invalid origin "${origin}". Provide only an origin, without a path, credentials, query, or fragment.`,
      );
    }

    return origin;
  });

  if (new Set(validatedOrigins).size !== validatedOrigins.length) {
    throw new Error(
      'CORS configuration error: duplicate origins are not allowed.',
    );
  }

  return validatedOrigins;
}
