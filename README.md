# IT Talent Backend

<p align="center">
  <a href="https://nestjs.com/" target="_blank">
    <img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" />
  </a>
</p>

<p align="center">
  A progressive <a href="https://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.
</p>

## Description

IT Talent Backend is a NestJS and TypeScript backend application.

## Project setup

```bash
npm install
```

## Environment configuration

Configure the required environment variables in your local `.env` file. See `.env.example` for the available configuration options and example values.

Never commit production secrets, passwords, or private keys to version control.

## Compile and run the project

```bash
# Development
npm run start

# Watch mode
npm run start:dev

# Production mode
npm run start:prod
```

## Authentication Rate Limiting

The API applies rate limits to authentication endpoints to help protect against brute-force login attempts and registration abuse.

Default limits:

- **Login** (`POST /api/v1/auth/login`): 5 requests per 60 seconds per client IP.
- **Registration** (`POST /api/v1/auth/register`): 3 requests per 60 seconds per client IP.
- Requests exceeding a limit receive HTTP `429 Too Many Requests`.

The limits can be configured using the following environment variables:

| Variable | Default | Description |
|---|---:|---|
| `AUTH_LOGIN_TTL_MS` | `60000` | Login rate-limit window in milliseconds |
| `AUTH_LOGIN_LIMIT` | `5` | Maximum login requests per window |
| `AUTH_REGISTER_TTL_MS` | `60000` | Registration rate-limit window in milliseconds |
| `AUTH_REGISTER_LIMIT` | `3` | Maximum registration requests per window |

All four values must be positive safe integers. The default rate-limit window is 60 seconds.

### Reverse Proxy and Client IP Security

Rate limiting relies on the client IP address reported by the HTTP server. The application must not blindly trust client-supplied `X-Forwarded-For` headers.

If the API runs behind a reverse proxy or load balancer, ensure that:

- The proxy removes or overwrites untrusted incoming forwarding headers.
- The application trusts forwarding information only from explicitly trusted proxy infrastructure.
- The application cannot be reached directly by clients who could bypass the trusted proxy.
- Proxy trust settings match the actual deployment topology.

Do not enable broad proxy trust without verifying the deployment configuration. Incorrect proxy trust can allow clients to spoof their IP address and bypass IP-based rate limits.

## Run tests

```bash
# Unit tests
npm run test

# End-to-end tests
npm run test:e2e

# Test coverage
npm run test:cov
```
