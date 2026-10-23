import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  const corsOrigin = process.env.CORS_ORIGIN;

  app.enableCors({
    origin: corsOrigin
      ? corsOrigin.split(',').map((origin) => origin.trim())
      : 'http://localhost:3000',
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

  if (process.env.NODE_ENV !== 'production') {
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

      .swagger-login input[hidden] {
        display: none;
      }

      .swagger-login-buttons {
        display: flex;
        gap: 8px;
      }

      .swagger-login button {
        flex: 1;
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

      .swagger-login #swagger-logout-button {
        background: #d9534f;
      }

      .swagger-login #swagger-logout-button:hover {
        background: #c9302c;
      }

      .swagger-login button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .swagger-login-status {
        margin-top: 8px;
        font-size: 13px;
        overflow-wrap: anywhere;
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
              autocomplete="username"
            />

            <input
              id="swagger-login-password"
              type="password"
              placeholder="Password"
              autocomplete="current-password"
            />

            <div class="swagger-login-buttons">
              <button id="swagger-login-button" type="button">
                Login
              </button>

              <button
                id="swagger-logout-button"
                type="button"
                hidden
              >
                Logout
              </button>
            </div>

            <div
              id="swagger-login-status"
              class="swagger-login-status"
              role="status"
              aria-live="polite"
            ></div>
          \`;

          document.body.appendChild(container);

          const emailInput = document.getElementById(
            'swagger-login-email',
          );

          const passwordInput = document.getElementById(
            'swagger-login-password',
          );

          const loginButton = document.getElementById(
            'swagger-login-button',
          );

          const logoutButton = document.getElementById(
            'swagger-logout-button',
          );

          const status = document.getElementById(
            'swagger-login-status',
          );

          // Initially, show the login fields and Login button.
          loginButton.hidden = false;
          logoutButton.hidden = true;

          loginButton.addEventListener('click', async () => {
            const email = emailInput.value.trim();
            const password = passwordInput.value;

            if (!email || !password) {
              status.hidden = false;
              status.textContent =
                'Enter your email and password.';
              status.style.color = 'red';
              return;
            }

            loginButton.disabled = true;
            status.hidden = false;
            status.textContent = 'Logging in...';
            status.style.color = '';

            try {
              const response = await fetch(
                '/api/v1/auth/login',
                {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
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

              // Keep the title visible and show only Logout.
              emailInput.hidden = true;
              passwordInput.hidden = true;
              loginButton.hidden = true;
              logoutButton.hidden = false;
              status.hidden = true;

              passwordInput.value = '';
            } catch (error) {
              console.error(error);

              status.hidden = false;
              status.textContent =
                '✗ ' +
                (error instanceof Error
                  ? error.message
                  : 'Login failed');

              status.style.color = 'red';
            } finally {
              loginButton.disabled = false;
            }
          });

          logoutButton.addEventListener('click', () => {
            const ui = window.ui;

            if (ui) {
              ui.authActions.logout(['access-token']);
            }

            emailInput.value = '';
            passwordInput.value = '';

            // Show the login fields again after logout.
            emailInput.hidden = false;
            passwordInput.hidden = false;
            logoutButton.hidden = true;
            loginButton.hidden = false;

            status.hidden = false;
            status.textContent = 'Logged out';
            status.style.color = 'green';
          });
        }

        // Wait until Swagger UI is initialized.
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
  }

  await app.listen(Number(process.env.PORT ?? 3000));
}

void bootstrap();
