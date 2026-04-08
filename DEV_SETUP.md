# DEV_SETUP.md — ServiceTrack Local Development

**Last Updated**: 2026-03-31  
**Target Audience**: Backend devs, frontend devs, QA engineers

---

## 📋 PREREQUISITES

Ensure you have installed:
- **Node.js** 18+ (LTS recommended)
  ```bash
  node --version  # Should be v18.x or higher
  npm --version   # Should be v9.x or higher
  ```
- **Git** 2.40+
- **Docker** (optional but recommended for local PostgreSQL)
- **VS Code** + extensions:
  - ESLint
  - Prettier
  - Supabase (optional)
  - SQL Formatter (optional)
- **Postman** or **Insomnia** (for API testing)

---

## 🚀 QUICK START (5 minutes)

### 1. Clone Repository
```bash
cd ~/Documents/Proyectos
git clone https://github.com/yourorg/servicetrack.git
cd servicetrack
```

### 2. Install Dependencies
```bash
npm install
# If you see peer dependency warnings, run:
npm install --legacy-peer-deps
```

### 3. Create `.env.local`
```bash
cp .env.example .env.local
```

Edit `.env.local` with your secrets (see "Environment Variables" section below)

### 4. Setup Database
```bash
# Option A: Use Supabase cloud (recommended for dev)
# No setup needed, just configure credentials in .env.local

# Option B: Local PostgreSQL (for offline dev)
docker run -d \
  --name servicetrack-db \
  -e POSTGRES_PASSWORD=dev_password \
  -e POSTGRES_DB=servicetrack \
  -p 5432:5432 \
  postgres:15
```

### 5. Run Migrations
```bash
npm run db:migrate
# This reads SUPABASE_SCHEMA.sql and applies to your database
```

### 6. Seed Test Data
```bash
npm run db:seed
# Creates 1 test group, 10 users, 100 clientes, 200 vehículos
```

### 7. Start Development Server
```bash
npm run dev
# Opens http://localhost:3000
```

### 8. Verify Setup
```bash
# In another terminal, test API
curl http://localhost:3000/api/health
# Should return: { "status": "ok" }
```

---

## 🔐 ENVIRONMENT VARIABLES

Create `.env.local` in project root:

```env
# ============================================
# SUPABASE (PostgreSQL + Auth + Realtime)
# ============================================
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJ0eXAiOiJKV1QiLCJhbGc...
DATABASE_URL=postgresql://postgres:password@localhost:5432/servicetrack

# ============================================
# NEXT.JS
# ============================================
NEXT_PUBLIC_APP_URL=http://localhost:3000
NODE_ENV=development
NEXTAUTH_SECRET=your-secret-key-here-min-32-chars

# ============================================
# INTEGRATIONS - WhatsApp
# ============================================
WHATSAPP_BUSINESS_ACCOUNT_ID=123456789
WHATSAPP_ACCESS_TOKEN=EAAxxxxx...
WHATSAPP_WEBHOOK_VERIFY_TOKEN=your-webhook-token

# ============================================
# INTEGRATIONS - Claude API
# ============================================
CLAUDE_API_KEY=sk-ant-...

# ============================================
# INTEGRATIONS - Email (Outlook)
# ============================================
OUTLOOK_CLIENT_ID=...
OUTLOOK_CLIENT_SECRET=...
OUTLOOK_REDIRECT_URI=http://localhost:3000/api/auth/outlook/callback

# ============================================
# INTEGRATIONS - Email (Gmail)
# ============================================
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
GMAIL_REDIRECT_URI=http://localhost:3000/api/auth/gmail/callback

# ============================================
# INTEGRATIONS - N8N (Workflow Engine)
# ============================================
N8N_WEBHOOK_URL=http://localhost:5678/webhook
N8N_WEBHOOK_SECRET=dev-secret
N8N_USER_EMAIL=dev@servicetrack.local
N8N_USER_PASSWORD=devpass123

# ============================================
# MONITORING (Optional)
# ============================================
SENTRY_DSN=https://xxx@sentry.io/yyy
LOGDNA_INGESTION_KEY=...

# ============================================
# LOCAL DEV ONLY
# ============================================
DEBUG=servicetrack:*
LOG_LEVEL=debug
```

### How to Get Credentials

**Supabase**:
1. Go to https://supabase.com/dashboard
2. Create new project or open existing
3. Settings → API Keys → Copy `URL` and `anon key`, `service_role key`

**WhatsApp Business API**:
1. https://developers.facebook.com → Create app → WhatsApp
2. Get `Access Token` and `Business Account ID`
3. Set webhook URL to `http://your-domain/api/webhooks/whatsapp`

**Claude API**:
1. https://console.anthropic.com → API Keys
2. Create key, copy to `.env.local`

**Outlook OAuth**:
1. https://portal.azure.com → Azure AD → App registrations
2. Create new app, set redirect to `http://localhost:3000/api/auth/outlook/callback`
3. Copy Client ID and secret

**Gmail OAuth**:
1. https://console.developers.google.com → Create project
2. OAuth consent screen → Application type = Web
3. Credentials → Create OAuth 2.0 Client ID (Web)
4. Set redirect to `http://localhost:3000/api/auth/gmail/callback`

---

## 📁 PROJECT STRUCTURE

```
servicetrack/
├── src/
│   ├── app/                          # Next.js app directory
│   │   ├── (auth)/                   # Auth routes (login, register, etc.)
│   │   ├── (dashboard)/              # Main app routes
│   │   │   ├── crm/                  # CRM module
│   │   │   │   ├── clientes/
│   │   │   │   ├── vehiculos/
│   │   │   │   └── actividades/
│   │   │   ├── citas/                # Appointments module
│   │   │   ├── taller/               # Workshop module
│   │   │   ├── bandeja/              # Unified inbox (Sprint 8)
│   │   │   └── layout.tsx
│   │   ├── api/                      # API routes
│   │   │   ├── auth/                 # Authentication endpoints
│   │   │   ├── clientes/             # CRM CRUD
│   │   │   ├── citas/                # Appointments CRUD
│   │   │   ├── webhooks/             # WhatsApp, Gmail, Outlook
│   │   │   └── health/               # Health checks
│   │   └── layout.tsx
│   │
│   ├── components/                   # React components
│   │   ├── ui/                       # shadcn/ui (Button, Input, etc.)
│   │   ├── crm/                      # CRM-specific components
│   │   │   ├── ClientForm/
│   │   │   ├── VehicleList/
│   │   │   └── TimelineView/
│   │   ├── citas/                    # Citas-specific
│   │   │   └── KanbanBoard/
│   │   ├── auth/                     # Auth components
│   │   │   └── LoginForm/
│   │   └── common/                   # Shared (Header, Sidebar, etc.)
│   │
│   ├── lib/                          # Utilities
│   │   ├── supabase/                 # Supabase client setup
│   │   │   ├── client.ts
│   │   │   └── server.ts
│   │   ├── api/                      # API client
│   │   │   └── client.ts
│   │   ├── auth/                     # Auth utilities
│   │   │   └── getSession.ts
│   │   ├── validation/               # Zod schemas
│   │   │   ├── cliente.schema.ts
│   │   │   └── cita.schema.ts
│   │   └── utils.ts                  # Helpers
│   │
│   ├── hooks/                        # React hooks
│   │   ├── useAuth.ts
│   │   ├── usePermisos.ts            # Permission checking
│   │   └── useSupabase.ts
│   │
│   ├── types/                        # TypeScript types
│   │   ├── database.ts               # Auto-generated from Supabase
│   │   ├── api.ts
│   │   └── models.ts
│   │
│   └── styles/                       # Global styles
│       └── globals.css
│
├── tests/                            # Test files (mirror src structure)
│   ├── unit/
│   ├── integration/
│   └── e2e/
│
├── migrations/                       # SQL migrations
│   ├── 001_initial_schema.sql        # SUPABASE_SCHEMA.sql content
│   ├── 002_seed_test_data.sql
│   └── ...
│
├── scripts/                          # Utility scripts
│   ├── migrate.ts
│   ├── seed.ts
│   └── export-schema.ts
│
├── docs/                             # Documentation
│   ├── API.md
│   ├── DEPLOYMENT.md
│   └── TROUBLESHOOTING.md
│
├── .env.example                      # Example .env file
├── .env.local                        # (NOT committed) Your secrets
├── .eslintrc.json                    # Linting rules
├── .prettierrc                       # Code formatting
├── tsconfig.json                     # TypeScript config
├── next.config.js                    # Next.js config
├── package.json
├── package-lock.json
└── README.md
```

---

## 🛠️ COMMON TASKS

### Run Tests
```bash
# All tests
npm test

# Watch mode (re-run on file change)
npm test -- --watch

# Coverage report
npm test -- --coverage

# Specific test file
npm test -- api/clientes.test.ts
```

### Check Code Quality
```bash
# Lint
npm run lint

# Fix lint errors
npm run lint -- --fix

# Format code
npm run format

# Type check
npm run type-check
```

### Database Operations
```bash
# View all migrations
npm run db:list

# Rollback last migration
npm run db:rollback

# Open Supabase Studio (GUI)
npx supabase studio

# Export schema from live database
npm run db:export-schema

# Generate TypeScript types from schema
npx supabase gen types typescript --local > src/types/database.ts
```

### Build & Deployment
```bash
# Build for production
npm run build

# Start production server
npm run start

# Deploy to Vercel (if connected)
vercel deploy --prod
```

### Reset Everything
```bash
# Delete local database, restart fresh
npm run db:reset

# Clear all test data and re-seed
npm run db:seed
```

---

## 🧪 TESTING GUIDE

### Unit Test Template
```typescript
// src/lib/validation/__tests__/cliente.schema.test.ts
import { describe, it, expect } from 'vitest'
import { clienteSchema } from '../cliente.schema'

describe('clienteSchema', () => {
  it('accepts valid cliente data', () => {
    const data = {
      nombre: 'Juan Pérez',
      whatsapp: '+5551234567',
      empresa_id: '123'
    }
    const result = clienteSchema.safeParse(data)
    expect(result.success).toBe(true)
  })

  it('rejects invalid whatsapp', () => {
    const data = {
      nombre: 'Juan',
      whatsapp: 'not-a-phone',
      empresa_id: '123'
    }
    const result = clienteSchema.safeParse(data)
    expect(result.success).toBe(false)
  })
})
```

### Integration Test Template
```typescript
// tests/integration/api/clientes.test.ts
import { createClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'

describe('POST /api/clientes', () => {
  let supabase: ReturnType<typeof createClient>
  let testGroupId: string

  beforeAll(async () => {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
    // Create test group
    const { data } = await supabase
      .from('grupos')
      .insert({ nombre: 'Test Group' })
      .select('id')
      .single()
    testGroupId = data.id
  })

  it('creates a cliente successfully', async () => {
    const response = await fetch('http://localhost:3000/api/clientes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grupo_id: testGroupId,
        nombre: 'Cliente Test',
        whatsapp: '+5551234567'
      })
    })
    expect(response.status).toBe(201)
    const data = await response.json()
    expect(data.success).toBe(true)
  })

  afterAll(async () => {
    // Cleanup
    await supabase.from('grupos').delete().eq('id', testGroupId)
  })
})
```

### E2E Test Template (Playwright)
```typescript
// tests/e2e/crm-flow.spec.ts
import { test, expect } from '@playwright/test'

test.describe('CRM Flow', () => {
  test('create cliente → vehicle → activity', async ({ page }) => {
    // Login
    await page.goto('http://localhost:3000/login')
    await page.fill('input[name="email"]', 'test@example.com')
    await page.fill('input[name="password"]', 'testpass123')
    await page.click('button[type="submit"]')
    await page.waitForNavigation()

    // Navigate to CRM
    await page.click('a:has-text("CRM")')
    await page.click('button:has-text("Nuevo Cliente")')

    // Fill form
    await page.fill('input[name="nombre"]', 'Juan Pérez')
    await page.fill('input[name="whatsapp"]', '+5551234567')
    await page.click('button[type="submit"]')

    // Verify success
    await expect(page.locator('text=Cliente creado')).toBeVisible()
  })
})
```

---

## 🐛 DEBUGGING

### Enable Debug Logs
```bash
DEBUG=servicetrack:* npm run dev
# or
LOG_LEVEL=debug npm run dev
```

### Browser DevTools
- Chrome/Edge: `F12` → Network tab (API calls), Console (errors)
- React Developer Tools extension: Check component state, hooks

### VSCode Debugger
```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js",
      "type": "node",
      "request": "launch",
      "program": "${workspaceFolder}/node_modules/.bin/next",
      "args": ["dev"],
      "cwd": "${workspaceFolder}",
      "runtimeArgs": ["--inspect"]
    }
  ]
}
```

### Database Debugging
```bash
# Connect to local PostgreSQL
psql -h localhost -U postgres -d servicetrack

# View RLS policies
SELECT * FROM pg_policies WHERE tablename = 'clientes';

# Check triggers
SELECT * FROM information_schema.triggers WHERE table_name = 'vehiculos';

# Test RLS (as service role, no security)
SELECT * FROM clientes WHERE grupo_id = 'xxx';
```

---

## 📚 USEFUL COMMANDS

```bash
# Generate TypeScript types from database schema
npm run gen:types

# Export database schema as SQL
npm run export:schema

# Create a new migration
npm run migration:create -- "add_new_table"

# Validate all SQL migrations
npm run validate:sql

# Check dependencies for vulnerabilities
npm audit

# Update dependencies
npm update

# Clear all caches and reinstall
npm ci
```

---

## 🚨 COMMON ISSUES & FIXES

| Issue | Solution |
|-------|----------|
| `NEXT_PUBLIC_SUPABASE_URL is not set` | Make sure `.env.local` exists with Supabase credentials |
| Database connection refused | Check `DATABASE_URL` is correct; verify PostgreSQL is running (`docker ps`) |
| `Cannot find module '@supabase/supabase-js'` | Run `npm install` (forgot step 2?) |
| Port 3000 already in use | `lsof -i :3000` to find process, or use `PORT=3001 npm run dev` |
| Webpack build hangs | Clear cache: `rm -rf .next && npm run build` |
| RLS denies all queries | Check user has grupo_id; verify RLS policies; run `SELECT current_user_id();` in Supabase |
| WhatsApp webhook not firing | Verify webhook URL is publicly accessible; check verify token matches `.env.local` |
| Tests fail randomly | May be database state pollution; run `npm run db:reset` before tests |

---

## 🔗 EXTERNAL RESOURCES

- **Supabase Docs**: https://supabase.com/docs
- **Next.js Docs**: https://nextjs.org/docs
- **TypeScript Handbook**: https://www.typescriptlang.org/docs/
- **Zod Validation**: https://zod.dev
- **Playwright Testing**: https://playwright.dev
- **Vitest**: https://vitest.dev
- **Tailwind CSS**: https://tailwindcss.com
- **shadcn/ui**: https://ui.shadcn.com

---

## ✅ CHECKLIST: Ready to Code?

- [ ] Node.js 18+ installed
- [ ] `.env.local` created with all secrets
- [ ] `npm install` completed
- [ ] `npm run db:migrate` completed
- [ ] `npm run db:seed` completed
- [ ] `npm run dev` starts without errors
- [ ] `http://localhost:3000` loads in browser
- [ ] Can login with test user (admin@servicetrack.local / admin123)
- [ ] Tests pass: `npm test`

If all checks pass → **Ready to start coding!** 🚀

---

## 📞 SUPPORT

Stuck? Try:
1. Check this file (you are here)
2. Read `/docs/TROUBLESHOOTING.md`
3. Check Supabase status: https://status.supabase.com
4. Ask in team Slack #development
5. Create GitHub issue with logs + error message
