import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: process.env.CORS_ORIGIN ?? 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const config = new DocumentBuilder()
    .setTitle('IT Talent API')
    .setDescription('IT Talent backend API')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'access-token',
    )
    .build();

  const document = SwaggerModule.createDocument(app, config, {
    operationIdFactory: (controllerKey, methodKey) =>
      `${controllerKey}-${methodKey}`,
  });

  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },

    customCss: `
      .swagger-login {
        position: fixed;
        top: 10px;
        right: 20px;
        z-index: 9999;
        background: white;
        border: 1px solid #ddd;
        border-radius: 8px;
        padding: 12px;
        box-shadow: 0 2px 10px rgba(0,0,0,.15);
        font-family: sans-serif;
      }

      .swagger-login input {
        display: block;
        width: 220px;
        margin-bottom: 8px;
        padding: 7px 9px;
        border: 1px solid #ccc;
        border-radius: 4px;
        box-sizing: border-box;
      }

      .swagger-login button {
        width: 220px;
        padding: 8px;
        border: 0;
        border-radius: 4px;
        background: #4990e2;
        color: white;
        cursor: pointer;
      }

      .swagger-login button:hover {
        background: #357abd;
      }

      .swagger-login-status {
        margin-top: 8px;
        font-size: 13px;
      }
    `,

    customJsStr: `
      (() => {
        function createLoginForm() {
          if (document.querySelector('.swagger-login')) {
            return;
          }

          const container = document.createElement('div');
          container.className = 'swagger-login';

          container.innerHTML = \`
            <strong>API Login</strong>

            <input
              id="swagger-login-email"
              type="email"
              placeholder="Email"
              value="admin@example.com"
            />

            <input
              id="swagger-login-password"
              type="password"
              placeholder="Password"
              value="Admin12345!"
            />

            <button id="swagger-login-button">
              Login
            </button>

            <div
              id="swagger-login-status"
              class="swagger-login-status"
            ></div>
          \`;

          document.body.appendChild(container);

          document
            .getElementById('swagger-login-button')
            .addEventListener('click', async () => {
              const email = document
                .getElementById('swagger-login-email')
                .value;

              const password = document
                .getElementById('swagger-login-password')
                .value;

              const status = document.getElementById(
                'swagger-login-status',
              );

              status.textContent = 'Logging in...';

              try {
                const response = await fetch(
                  '/api/v1/auth/login',
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Accept': 'application/json',
                    },
                    credentials: 'include',
                    body: JSON.stringify({
                      email,
                      password,
                    }),
                  },
                );

                const data = await response.json();

                if (!response.ok) {
                  throw new Error(
                    data.message || 'Login failed',
                  );
                }

                if (!data.accessToken) {
                  throw new Error(
                    'No accessToken returned by login endpoint',
                  );
                }

                // Swagger UI API
                const ui = window.ui;

                if (!ui) {
                  throw new Error(
                    'Swagger UI is not available',
                  );
                }

                ui.preauthorizeApiKey(
                  'access-token',
                  data.accessToken,
                );

                status.textContent = '✓ Logged in';
                status.style.color = 'green';

              } catch (error) {
                console.error(error);

                status.textContent =
                  '✗ ' + (error.message || 'Login failed');

                status.style.color = 'red';
              }
            });
        }

        // Swagger UI needs a moment to initialize.
        const interval = setInterval(() => {
          if (window.ui) {
            clearInterval(interval);
            createLoginForm();
          }
        }, 100);

        setTimeout(() => {
          clearInterval(interval);
        }, 10000);
      })();
    `,
  });

  await app.listen(process.env.PORT ?? 3000);
}

bootstrap();