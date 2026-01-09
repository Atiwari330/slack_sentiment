# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slack Sentiment Analysis Dashboard - A Next.js application that monitors customer account health by analyzing Slack channel conversations. It provides:
1. **Sentiment Dashboard** (`/dashboard`) - At-a-glance view of all accounts with color-coded health indicators (red/yellow/green)
2. **Account Management** (`/accounts`) - Map customer names to Slack channels
3. **Chat Interface** (`/`) - AI-powered chat for querying individual channel discussions

## Commands

```bash
npm run dev      # Start development server (default: localhost:3000)
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

## Architecture

```
User Browser
    ↓
┌─────────────────────────────────────────────────────────────┐
│                        Pages                                 │
│  /dashboard      → Sentiment dashboard (main view)          │
│  /accounts       → Account management                        │
│  /               → Chat interface (legacy)                   │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│                      API Routes                              │
│  GET/POST /api/accounts         → Account CRUD              │
│  POST /api/analyze/[accountId]  → Analyze single account    │
│  POST /api/analyze/batch        → Analyze all accounts      │
│  GET /api/cron/analyze          → Cron trigger (secured)    │
│  POST /api/chat                 → AI chat streaming         │
│  GET /api/slack/channels        → List Slack channels       │
│  GET /api/slack/history         → Fetch channel messages    │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  Supabase (PostgreSQL)  → Accounts & sentiment storage      │
│  Slack Web API          → Channel/message data              │
│  AI Provider            → Sentiment analysis & chat         │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

### Sentiment Dashboard
| File | Purpose |
|------|---------|
| `src/app/dashboard/page.tsx` | Main dashboard with account grid |
| `src/components/dashboard/account-row.tsx` | Account row with sentiment color |
| `src/components/dashboard/header.tsx` | Dashboard header with summary stats |
| `src/lib/sentiment/analyze.ts` | Core sentiment analysis function |
| `src/lib/sentiment/prompts.ts` | AI prompt templates for analysis |

### Database Layer
| File | Purpose |
|------|---------|
| `src/lib/supabase.ts` | Supabase client + TypeScript types |
| `src/lib/db/accounts.ts` | Account CRUD operations |
| `src/lib/db/sentiment.ts` | Sentiment result storage/retrieval |
| `src/lib/db/schema.sql` | PostgreSQL schema (run in Supabase) |

### Slack Integration
| File | Purpose |
|------|---------|
| `src/lib/slack.ts` | `getChannels()`, `getChannelHistory()`, `formatMessagesForContext()` |

### Chat Interface (Legacy)
| File | Purpose |
|------|---------|
| `src/app/api/chat/route.ts` | AI streaming endpoint |
| `src/components/chat-interface.tsx` | Chat UI with useChat hook |
| `src/components/channel-selector.tsx` | Channel picker dialog |

## Sentiment Classification

Accounts are classified into three categories:

- **RED (At Risk)**: Cancellation mentions, unresolved critical issues, strong frustration, escalation threats
- **YELLOW (Needs Attention)**: Mild frustration, questions about contracts, feature requests, competitor mentions
- **GREEN (Healthy)**: Positive engagement, successful resolution, gratitude, expansion discussions

## Environment Variables

```bash
# Slack
SLACK_BOT_TOKEN=xoxb-...           # Required - Slack bot token

# AI Provider (choose one)
AI_GATEWAY_API_KEY=vck_...         # Vercel AI Gateway (recommended)
OPENAI_API_KEY=sk-...              # Direct OpenAI
ANTHROPIC_API_KEY=sk-ant-...       # Direct Anthropic

AI_MODEL=openai/gpt-4o             # Model identifier

# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Service role key (server-side only)

# Cron Security
CRON_SECRET=your-random-secret     # Secures the cron endpoint
```

## Automated Analysis

The app supports automated daily analysis via Vercel Cron:

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/analyze",
    "schedule": "0 6 * * *"
  }]
}
```

Runs at 6 AM UTC daily. Manual analysis available via dashboard "Analyze All" button.

## Setup Steps

1. Create Supabase project and run `src/lib/db/schema.sql` in SQL Editor
2. Add Supabase credentials to `.env`
3. Ensure Slack bot is invited to customer channels
4. Add accounts via `/accounts` page
5. Click "Analyze All" or wait for cron

## AI SDK v6 Patterns

- **Message format**: Messages use `parts` array instead of `content` string
- **generateText()**: Used for sentiment analysis (non-streaming)
- **streamText()**: Used for chat interface (streaming)
- **Provider creation**: Use `createGateway()` for Vercel AI Gateway

## TypeScript

- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- UI components use Radix primitives with Tailwind (Shadcn pattern)
