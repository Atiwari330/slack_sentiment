# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slack Sentiment Analysis Dashboard - A Next.js application that monitors customer account health by analyzing Slack channel conversations. It provides:
1. **Sentiment Dashboard** (`/dashboard`) - At-a-glance view of all accounts with color-coded health indicators (red/yellow/green)
2. **Morning Briefing** (`/briefing`) - Unified triage interface with AI-suggested actions for at-risk accounts
3. **Account Management** (`/accounts`) - Map customer names to Slack channels
4. **Voice Email Assistant** (`/voice`) - Compose and send emails using voice dictation with AI-powered drafting
5. **Brain Dump** (`/brain-dump`) - Turn voice/text input into Slack messages and Asana tasks
6. **Contact Management** (`/contacts`) - Manage email contacts for the voice assistant
7. **Chat Interface** (`/`) - AI-powered chat for querying individual channel discussions

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
│  /briefing       → Morning briefing (triage interface)      │
│  /accounts       → Account management                        │
│  /voice          → Voice email assistant (PWA)               │
│  /brain-dump     → Brain dump assistant                      │
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
│  GET /api/briefing/generate     → Generate briefing items   │
│  POST /api/briefing/action/*    → Approve/skip/revise       │
│  GET /api/briefing/actions/[id] → Action history            │
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

### Morning Briefing
| File | Purpose |
|------|---------|
| `src/app/briefing/page.tsx` | Main briefing page with queue |
| `src/components/briefing/briefing-card.tsx` | Individual account action card |
| `src/components/briefing/action-history.tsx` | Action history component |
| `src/lib/agents/briefing-generator.ts` | AI agent for generating suggestions |
| `src/lib/db/account-actions.ts` | Account actions CRUD operations |
| `src/app/api/briefing/generate/route.ts` | Generate briefing suggestions |
| `src/app/api/briefing/action/approve/route.ts` | Execute approved actions |
| `src/app/api/briefing/action/skip/route.ts` | Skip actions with reason |
| `src/app/api/briefing/action/revise/route.ts` | Revise suggestions with feedback |

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

## Morning Briefing

### Overview
The Morning Briefing feature provides a unified triage interface that surfaces at-risk accounts (RED/YELLOW sentiment or medium+ urgency) with AI-generated action suggestions. It reduces the 7+ context switches typically needed to take action on an at-risk account to a single flow.

### User Flow
1. Open `/briefing` (or click "Morning Briefing" in sidebar)
2. See queue of at-risk accounts sorted by urgency
3. For each account card:
   - View sentiment badge, account name, issue summary
   - See AI-suggested Slack message (expandable)
   - Approve & Send, Revise with feedback, or Skip
4. Actions are logged to `account_actions` table for tracking

### Database Table: `account_actions`
```sql
CREATE TABLE account_actions (
  id UUID PRIMARY KEY,
  account_id UUID REFERENCES accounts(id),
  action_type TEXT CHECK (action_type IN ('slack_message', 'email', 'asana_task', 'skip')),
  trigger_source TEXT CHECK (trigger_source IN ('briefing', 'manual')),
  suggested_action TEXT,
  issue_summary TEXT,
  executed_message TEXT,
  slack_channel_id TEXT,
  slack_message_ts TEXT,
  status TEXT CHECK (status IN ('suggested', 'executed', 'skipped')),
  sentiment_at_action TEXT,
  urgency_at_action TEXT,
  skip_reason TEXT,
  created_at TIMESTAMPTZ,
  executed_at TIMESTAMPTZ
);
```

### AI Agent Tools
The briefing generator agent (`src/lib/agents/briefing-generator.ts`) has these tools:
- `fetch_recent_messages` - Get Slack channel context
- `get_past_actions` - Check what actions have been taken
- `generate_suggestion` - Create issue summary and suggested message

### API Endpoints
- `GET /api/briefing/generate?limit=5` - Generate briefing for top N at-risk accounts
- `POST /api/briefing/action/approve` - Send approved message to Slack
- `POST /api/briefing/action/skip` - Log skipped action with optional reason
- `POST /api/briefing/action/revise` - Regenerate suggestion with feedback
- `GET /api/briefing/actions/[accountId]` - Get action history for an account

### Integration Points
- **Sidebar**: "Morning Briefing" navigation item with Coffee icon
- **Account Detail Panel**: Action History section shows past actions taken
