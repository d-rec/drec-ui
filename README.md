# D-REC UI

The frontend application for the [D-REC Initiative](https://drecs.org/) (Distributed Renewable Energy Certificates). D-REC enables device registration, meter data management, and renewable energy certificate issuance for distributed energy resources. Built as part of the [Energy Web](https://www.energyweb.org/) / [EnAccess](https://enaccess.org/) ecosystem. The backend lives at [drec-origin](https://github.com/d-rec/drec-origin).

## Tech Stack

- Angular 15 / Angular Material
- Bootstrap 5
- TypeScript 4.8 / SCSS
- Ethers.js / Web3
- Cypress (E2E) / Karma + Jasmine (unit)
- Sentry (error monitoring)

## Prerequisites

- **Node.js 20** (LTS/Iron)
- **npm**
- **Docker** (optional, for containerized builds)

## Getting Started

```bash
git clone https://github.com/d-rec/drec-ui.git
cd drec-ui
```

```bash
npm install --legacy-peer-deps
```

```bash
npm start
```

> **Note:** `--legacy-peer-deps` is required due to peer dependency conflicts. The dev server runs at `http://localhost:4200/` and expects the backend API at `http://localhost:3040/api/`.

## Environment Configuration

| Config | File | API URL | Sentry Env |
|---|---|---|---|
| `development` | `environment.ts` | `http://localhost:3040/api/` | `development` |
| `dev` | `environment.dev.ts` | `https://dev-api.drecs.org/api/` | `development` |
| `stage` | `environment.stage.ts` | `https://stage-api.drecs.org/api/` | `staging` |
| `prod` | `environment.prod.ts` | `https://api.drecs.org/api/` | `production` |

Build for a specific environment:

```bash
npm run build -- --configuration=<env>
```

## Available Scripts

### Development

| Command | Description |
|---|---|
| `npm start` | Start dev server (`http://localhost:4200/`) |
| `npm run watch` | Build in watch mode (development config) |

### Build

| Command | Description |
|---|---|
| `npm run build -- --configuration=<env>` | Production build for the given environment |
| `npm run sentry:sourcemaps` | Inject and upload source maps to Sentry |

### Code Quality

| Command | Description |
|---|---|
| `npm run lint` | Lint source files with ESLint |
| `npm run lint:error` | Lint showing only errors (no warnings) |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run prettier` | Check formatting with Prettier |
| `npm run prettier:fix` | Auto-fix formatting |

### Testing

| Command | Description |
|---|---|
| `npm test` | Run unit tests (Karma + Jasmine) |
| `npx cypress run` | Run E2E tests (requires backend + frontend running) |

### Releases

| Command | Description |
|---|---|
| `npm run release` | Create a release (standard-version) |
| `npm run release:patch` | Patch release |
| `npm run release:minor` | Minor release |
| `npm run release:major` | Major release |

## Docker

The project uses a multi-stage Docker build: `node:20-alpine` compiles the Angular app, then the output is served by `nginx:alpine`.

```bash
# Build the image
docker build --build-arg build_environment=prod -t drec-ui .

# Run the container
docker run -p 80:80 drec-ui
```

## Testing

- **Unit tests:** `npm test` runs Karma with Jasmine in a headless Chrome browser.
- **E2E tests:** `npx cypress run` executes Cypress specs located in `cypress/e2e/`. Both the backend and frontend must be running before executing E2E tests.

## Document Preview, OCR & Translation

The device submission form includes document upload fields (COD proof, AC capacity, etc.). Each uploaded file shows an **eye icon** that opens a full-screen preview modal.

### Preview modal features

- **Images** render as `<img>`, **PDFs** render in an `<iframe>`
- **OCR** runs automatically via [tesseract.js](https://github.com/naptha/tesseract.js) (v5) — supports English, French, and other Tesseract-supported languages
- Multi-page PDFs are OCR'd page-by-page with streaming output (earlier pages appear while later ones process)
- **Translate to English** auto-detects the source language and translates via [DeepL API](https://www.deepl.com/docs-api) (requires a `DEEPL_API_KEY` in `environment.ts`; requests are proxied through the Angular dev server to avoid CORS — see `proxy.conf.json`)

## Contributing

Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. This project follows [Conventional Commits](https://www.conventionalcommits.org/) for commit messages.
