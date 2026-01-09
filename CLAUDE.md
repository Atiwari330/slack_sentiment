# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Slack Channel Chat Assistant - A Next.js application that enables AI-powered conversations about Slack channel messages. It fetches message history from Slack, feeds it as context to an AI model, and provides a chat interface for querying channel discussions.

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
Client Components (React 19, "use client")
    ├─ page.tsx → Main layout with channel info sidebar + chat area
    ├─ ChannelSelector → Searchable channel dropdown dialog
    └─ ChatInterface → Chat UI with useChat hook from @ai-sdk/react
    ↓
API Routes (Next.js App Router)
    ├─ POST /api/chat → Streams AI responses with channel context
    ├─ GET /api/slack/channels → Lists accessible Slack channels
    └─ GET /api/slack/history → Fetches channel message history
    ↓
External Services
    ├─ Slack Web API (@slack/web-api) → Channel/message data
    └─ AI Provider (Vercel AI Gateway, OpenAI, or Anthropic)
```

## Key Files

| File | Purpose |
|------|---------|
| `src/lib/slack.ts` | Slack API client - `getChannels()`, `getChannelHistory()`, `formatMessagesForContext()` |
| `src/app/api/chat/route.ts` | AI streaming endpoint - converts UI messages to model format, builds system prompt with Slack context |
| `src/components/chat-interface.tsx` | Chat UI - uses `useChat` hook, `sendMessage()` with body params for channelId |
| `src/components/channel-selector.tsx` | Channel picker with search and member count display |

## AI SDK v6 Patterns

This project uses AI SDK v6 which has significant API changes from v4/v5:

- **Message format**: Messages use `parts` array instead of `content` string
- **useChat hook**: No longer manages input state internally - use `useState` separately
- **sendMessage()**: Pass `{ text: input }` as first arg, custom body in second arg options
- **Streaming response**: Use `toUIMessageStreamResponse()` instead of `toDataStreamResponse()`
- **Provider creation**: Use `createGateway()` from `'ai'` package for Vercel AI Gateway

## Environment Variables

```
SLACK_BOT_TOKEN=xoxb-...           # Required - Slack bot token
AI_GATEWAY_API_KEY=vck_...         # Vercel AI Gateway key (recommended)
# OR
OPENAI_API_KEY=sk-...              # Direct OpenAI
# OR
ANTHROPIC_API_KEY=sk-ant-...       # Direct Anthropic

AI_MODEL=openai/gpt-4o             # Model identifier (provider/model for gateway)
```

## Slack Bot Setup

The bot requires these OAuth scopes: `channels:read`, `channels:history` (required), `groups:read`, `groups:history`, `users:read` (optional). Must be invited to channels with `/invite @BotName` to read message history.

## TypeScript

- Strict mode enabled
- Path alias: `@/*` maps to `./src/*`
- UI components use Radix primitives with Tailwind (Shadcn pattern)
