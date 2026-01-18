# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slack Sentiment Analysis Dashboard - A Next.js application that monitors customer account health by analyzing Slack channel conversations. It provides:
1. **Sentiment Dashboard** (`/dashboard`) - At-a-glance view of all accounts with color-coded health indicators (red/yellow/green)
2. **Account Management** (`/accounts`) - Map customer names to Slack channels
3. **Voice Email Assistant** (`/voice`) - Compose and send emails using voice dictation with AI-powered drafting
4. **Contact Management** (`/contacts`) - Manage email contacts for the voice assistant
5. **Chat Interface** (`/`) - AI-powered chat for querying individual channel discussions

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
│  /voice          → Voice email assistant (PWA)               │
│  /contacts       → Contact management                        │
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
│  GET/POST /api/contacts         → Contact CRUD              │
│  GET /api/voice/token           → Deepgram temporary key    │
│  POST /api/voice/compose        → AI email composition      │
│  POST /api/voice/revise         → AI email revision         │
│  GET /api/gmail/auth            → Start Gmail OAuth         │
│  GET /api/gmail/callback        → OAuth callback            │
│  POST /api/gmail/send           → Send approved email       │
└─────────────────────────────────────────────────────────────┘
    ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  Supabase (PostgreSQL)  → Accounts & sentiment storage      │
│  Slack Web API          → Channel/message data              │
│  AI Provider            → Sentiment analysis & chat         │
│  Deepgram               → Real-time voice transcription     │
│  Gmail API              → Email sending via OAuth           │
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

### Voice Email Assistant
| File | Purpose |
|------|---------|
| `src/app/voice/page.tsx` | Main voice assistant page (PWA) |
| `src/components/voice/voice-assistant.tsx` | State machine orchestrator |
| `src/components/voice/voice-record-button.tsx` | Mic button with pulse animation |
| `src/components/voice/transcription-display.tsx` | Real-time transcription |
| `src/components/voice/email-draft-card.tsx` | Draft preview + actions |
| `src/components/voice/feedback-input.tsx` | Voice/text revision input |
| `src/components/voice/gmail-connect.tsx` | OAuth connection UI |
| `src/lib/agents/email-composer.ts` | AI agent with tools |
| `src/lib/deepgram.ts` | Deepgram client config |
| `src/lib/gmail.ts` | Gmail API client + OAuth |
| `src/lib/encryption.ts` | Token encryption utilities |
| `src/lib/db/contacts.ts` | Contact CRUD operations |
| `src/lib/db/email-drafts.ts` | Draft storage |

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

# Voice Email Assistant
DEEPGRAM_API_KEY=...               # Deepgram API key for voice transcription

# Gmail OAuth (from Google Cloud Console)
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REDIRECT_URI=http://localhost:3000/api/gmail/callback

# Token Encryption (generate with: openssl rand -hex 32)
TOKEN_ENCRYPTION_KEY=...           # 64 hex chars for AES-256 encryption
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

## Voice Email Assistant

### User Flow
1. Open `/voice` on phone/desktop → tap mic button
2. Speak freely: "Send an email to Ben from Imagine asking if they have a feature for..."
3. AI processes transcription → identifies recipient from contacts → drafts email
4. Review draft → approve OR provide voice/text feedback for revision
5. On approval → connect Gmail → email sent via Gmail API

### Database Tables
- `contacts` - Contact knowledge base with name, email, company, role, context, tags
- `company_info` - Key-value store for company context (used by AI)
- `email_drafts` - Draft history with versioning and status tracking
- `gmail_tokens` - Encrypted OAuth tokens for Gmail

### AI Agent Tools
The email composer agent (`src/lib/agents/email-composer.ts`) has these tools:
- `search_contacts` - Fuzzy search contacts by name/company/email
- `get_contact` - Get full contact details
- `get_company_info` - Get company context for personalization
- `create_draft` - Generate the email draft

### PWA Configuration
- Manifest at `public/manifest.json`
- Mobile-optimized layout (no sidebar on `/voice`)
- Add to home screen support for iOS/Android

### Gmail OAuth Setup
1. Create project in Google Cloud Console
2. Enable Gmail API
3. Create OAuth 2.0 credentials (Web application)
4. Add authorized redirect URI: `http://localhost:3000/api/gmail/callback`
5. Copy Client ID and Client Secret to environment variables
