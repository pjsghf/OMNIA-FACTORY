# OMNIA Scriptor — Enterprise AI Editorial Studio

OMNIA Scriptor is an enterprise-grade AI-powered editorial studio designed for authors, publishers, and literary editors. It orchestrates book planning, hierarchical chapter drafting, multi-pass editorial review, typography composition, and production-ready exports (EPUB 3, PDF, HTML5, and Markdown).

---

## 🏛️ System Architecture

The application is structured following a layered, domain-driven architecture:

```
src/
├── lib/
│   ├── ai/                      # AI Orchestration, Prompts, Block Generators & Reviewers
│   │   ├── generation/          # Sequential chapter block & front/end matter generators
│   │   ├── memory/              # BookBible continuity memory engine
│   │   ├── prompts/             # Dynamic prompt builders with directive enforcement
│   │   ├── review/              # Map-reduce hierarchical editorial reviewer
│   │   ├── validation/          # Schema, coverage, and config validators
│   │   ├── orchestrator.ts      # Multi-provider fallback AI orchestrator
│   │   └── types.ts             # AI task types and response interfaces
│   ├── cover/                   # Cover Brief, Format Specs & Vector Compositor Engine
│   │   ├── coverBrief.ts        # Specs for Ebook, Print A5, Trade 6x9, Square Catalog
│   │   └── coverCanvasRenderer.ts # Vector SVG canvas renderer with burned-in typography
│   ├── rendering/               # Unified Editorial AST & Export Engines
│   │   ├── editorialAST.ts      # Abstract Syntax Tree parser and XHTML/HTML/MD renderers
│   │   └── canonicalRenderer.ts # Canonical HTML reader renderer
│   ├── pdf/                     # Puppeteer-backed PDF Print Generator & CSS paged media
│   ├── security/                # CSP headers, Rate Limiters, Privacy Policy & LGPD
│   ├── config/                  # Startup environment variable validation
│   ├── observability/           # Structured JSON logger with sensitive data redaction
│   └── validation/              # Preflight gate validators for publishing readiness
├── components/                  # React 19 UI stages (Config, Outline, Editor, Audit, Export)
└── server.ts                    # Express + Vite server with API endpoints
```

---

## 🚀 Local Setup & Development

### Prerequisites
- Node.js 20+
- npm 10+

### Environment Configuration
Copy `.env.example` to `.env` and set your configuration:

```env
PORT=3000
NODE_ENV=development
GEMINI_API_KEY=AIzaSy...
```

### Commands

```bash
# Install dependencies
npm install

# Start development server with live Vite middleware
npm run dev

# Run TypeScript typechecks and linting
npm run lint

# Build production bundle (client + server.cjs)
npm run build

# Start production server
npm run start

# Verify the AI providers against their live APIs (see below)
npm run verify:providers
```

### Verifying the AI providers

The automated suite never calls a real provider, so a wrong model id or a wrong
base URL passes CI and only fails in front of a user. `npm run verify:providers`
closes that gap: it lists the account's real Gemini models and checks every id in
`catalog.ts` against them, then makes one minimal OpenCode completion.

Run it after changing `catalog.ts` or a provider URL. Exit codes:

| Code | Meaning |
| --- | --- |
| `0` | Everything configured was reached and works |
| `1` | Something is genuinely broken — read the output |
| `2` | Inconclusive: nothing ran (missing key, or egress blocked by a proxy) |

Exit `2` is not a pass. A restrictive network answers `403` to the `CONNECT`,
which looks identical to a provider rejecting the key — the script tells the two
apart so a network policy is never mistaken for a bad credential.

---

## 🛡️ Security & Privacy (LGPD / GDPR)

1. **Security Headers (Helmet & CSP)**
   - Strict Content Security Policy (CSP) allowing inline styles for previewing and data URIs for canvas export.
   - HTTP Strict Transport Security (HSTS) enabled in production environments.
   - `X-Content-Type-Options: nosniff` and `X-Frame-Options` configured to support AI Studio preview frames.

2. **Rate Limiting & Cost Protection**
   - Global API Rate Limiter: 300 requests per 15 minutes.
   - Editorial AI Endpoint Limiter: 30 requests per minute.

3. **Data Minimization & Privacy**
   - Manuscripts processed server-side in memory; zero permanent third-party training.
   - Project Data Deletion Endpoint (`POST /api/editorial/projects/:id/delete-data`).
   - Privacy Policy Manifest Endpoint (`GET /api/privacy-policy`).

---

## 📖 API Endpoints Reference

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Service health status, uptime, and env diagnostics |
| `GET` | `/api/privacy-policy` | Privacy policy manifest and LGPD/GDPR rights |
| `POST` | `/api/editorial/validate-config` | Validates genre, target audience, and directive parameters |
| `POST` | `/api/editorial/plan-book` | Generates a structured editorial outline with chapter briefs |
| `POST` | `/api/editorial/generate-chapter-block` | Generates chapter content in sequential, coherent blocks |
| `POST` | `/api/editorial/generate-matter` | Generates front matter and end matter sections |
| `POST` | `/api/editorial/review-hierarchical` | Runs map-reduce editorial audit across all chapters |
| `POST` | `/api/editorial/generate-cover` | Background artwork + vector typography composite rendering |
| `POST` | `/api/editorial/generate-pdf` | Generates printable PDF via headless Puppeteer browser |
| `POST` | `/api/projects/backup` | Exports versioned project backup package |
| `POST` | `/api/projects/restore` | Validates and restores project backup package |
| `POST` | `/api/editorial/projects/:id/delete-data` | LGPD project data deletion confirmation |

---

## 📋 Operational Runbooks

### Runbook 1: Production Deployment Procedure
1. Run `npm run lint` to ensure zero TypeScript or compilation errors.
2. Execute `npm run build` to compile static Vite assets into `/dist` and create `/dist/server.cjs`.
3. Set `NODE_ENV=production` and verify `process.env.PORT` binding.
4. Launch via `npm run start` and verify health check via `GET /api/health`.

### Runbook 2: Key Rotation Procedure
1. Generate new API key in Google AI Studio / GCP Console.
2. Update `GEMINI_API_KEY` in environment secrets manager.
3. Perform zero-downtime server restart. Check `/api/health` for `geminiConfigured: true`.

### Runbook 3: Provider Outage Fallback
If primary AI provider experiences elevated latencies or HTTP 429:
- The `AiOrchestrator` automatically retries with exponential backoff (up to 3 attempts).
- Fallback vector compositors trigger automatically for cover artwork generation.

---

## 🟢 Release Gate & Preflight Criteria

Before exporting production books, the **Preflight Gate Engine** checks:
- [x] All chapters present with text > 100 words.
- [x] Metadata complete (Title, Author, BCP-47 language tag).
- [x] No placeholder text (e.g. `Lorem Ipsum`, `[INSIRA AQUI]`).
- [x] Offline assets resolved (data URIs / embedded SVGs).
- [x] EPUB3 validation compliance (strict XHTML schema and metadata tags).
