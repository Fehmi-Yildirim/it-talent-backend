# React + TypeScript + Vite

This template provides a minimal setup to get React working in Vite with HMR and some Oxlint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on development and build performance. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the Oxlint configuration

If you are developing a production application, we recommend enabling type-aware lint rules by installing `oxlint-tsgolint` and editing `.oxlintrc.json`:

```json
{
  "$schema": "./node_modules/oxlint/configuration_schema.json",
  "plugins": ["react", "typescript", "oxc"],
  "options": {
    "typeAware": true
  },
  "rules": {
    "react/rules-of-hooks": "error",
    "react/only-export-components": ["warn", { "allowConstantExport": true }]
  }
}
```

See the [Oxlint rules documentation](https://oxc.rs/docs/guide/usage/linter/rules) for the full list of rules and categories.

## Environment Configuration

The frontend uses environment variables to configure the API base URL.

### Local setup

1. Copy `.env.example` to `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

   On Windows PowerShell, you can use:

   ```powershell
   Copy-Item .env.example .env.local
   ```

2. Set `VITE_API_BASE_URL` in `.env.local` to the base URL of your backend API. For example:

   ```dotenv
   VITE_API_BASE_URL=http://localhost:3000/api/v1
   ```

3. Start the frontend using the development command configured in `package.json`.

### Security notes

- Keep `.env.local` and other environment-specific files out of version control.
- `.env.example` is the tracked template for required environment variables. Keep its values safe and suitable for sharing.
- Variables prefixed with `VITE_` are exposed to client-side code and may be included in the built frontend. **Never store secrets, API keys, passwords, or private tokens in `VITE_` variables.**
- Store sensitive credentials on the backend, not in the frontend environment configuration.

## Related repositories

- [Backend](https://github.com/Fehmi-Yildirim/it-talent-backend)
- [Project documentation](./docs/)
