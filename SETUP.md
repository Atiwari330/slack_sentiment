# Setup Guide

This guide will help you set up your Slack app and AI configuration.

## Prerequisites

- Node.js 20+ installed
- A Slack workspace where you have admin permissions
- A Vercel account (for AI Gateway) OR an OpenAI/Anthropic API key

---

## Step 1: Create a Slack App

### 1.1 Go to Slack API Dashboard

1. Visit [https://api.slack.com/apps](https://api.slack.com/apps)
2. Click **"Create New App"**
3. Select **"From scratch"**
4. Enter an app name (e.g., "Channel Chat Assistant")
5. Select your workspace
6. Click **"Create App"**

### 1.2 Configure Bot Token Scopes

1. In the left sidebar, click **"OAuth & Permissions"**
2. Scroll down to **"Bot Token Scopes"**
3. Click **"Add an OAuth Scope"** and add the following scopes:

| Scope | Description |
|-------|-------------|
| `channels:read` | View basic information about public channels |
| `channels:history` | View messages in public channels the bot is added to |
| `groups:read` | (Optional) View basic info about private channels |
| `groups:history` | (Optional) View messages in private channels |
| `users:read` | (Optional) View user names in messages |

### 1.3 Install the App to Your Workspace

1. Scroll up to **"OAuth Tokens for Your Workspace"**
2. Click **"Install to Workspace"**
3. Review the permissions and click **"Allow"**
4. Copy the **"Bot User OAuth Token"** (starts with `xoxb-`)
5. Paste this token into your `.env` file as `SLACK_BOT_TOKEN`

### 1.4 Invite the Bot to Channels

**Important:** The bot can only read messages from channels it has been invited to.

1. Go to any Slack channel you want to analyze
2. Type `/invite @YourBotName` (replace with your bot's name)
3. The bot will now have access to that channel's message history

---

## Step 2: Configure AI Provider

You have several options for the AI backend:

### Option A: Vercel AI Gateway (Recommended)

The AI Gateway provides a unified API to access multiple AI providers with built-in rate limiting, caching, and analytics.

1. Go to [https://vercel.com/dashboard](https://vercel.com/dashboard)
2. Navigate to your team settings
3. Click on **"AI Gateway"** in the sidebar
4. Click **"Create API Key"**
5. Copy the key and add it to your `.env` file as `AI_GATEWAY_API_KEY`

**Configure Your Model Provider:**
1. In AI Gateway settings, click **"Providers"**
2. Add your preferred provider (OpenAI, Anthropic, etc.)
3. Enter your provider API key
4. The AI Gateway will route requests through your configured provider

**Model Format for AI Gateway:**
```
AI_MODEL=openai/gpt-4o
AI_MODEL=anthropic/claude-3-5-sonnet-20241022
AI_MODEL=google/gemini-2.0-flash-exp
```

### Option B: OpenAI Direct

1. Go to [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
2. Click **"Create new secret key"**
3. Copy the key and add it to your `.env` file as `OPENAI_API_KEY`
4. Set `AI_MODEL=gpt-4o` (or another OpenAI model)

### Option C: Anthropic Direct

1. Go to [https://console.anthropic.com/](https://console.anthropic.com/)
2. Navigate to **"API Keys"**
3. Create a new key
4. Copy the key and add it to your `.env` file as `ANTHROPIC_API_KEY`
5. Set `AI_MODEL=claude-3-5-sonnet-20241022`

---

## Step 3: Environment Setup

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and fill in your values:
   ```env
   SLACK_BOT_TOKEN=xoxb-your-actual-token
   AI_GATEWAY_API_KEY=your-actual-gateway-key
   AI_MODEL=openai/gpt-4o
   ```

---

## Step 4: Run the Application

1. Install dependencies (if not already done):
   ```bash
   npm install
   ```

2. Start the development server:
   ```bash
   npm run dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser

---

## Troubleshooting

### "Channel not found" or empty channel list
- Make sure your bot token has the `channels:read` scope
- Re-install the app to your workspace after adding scopes

### "not_in_channel" error when fetching messages
- The bot must be invited to each channel: `/invite @YourBotName`
- Private channels require `groups:read` and `groups:history` scopes

### Rate limiting issues
- Slack has rate limits on API calls
- The app caches channel history to minimize API calls
- For new apps (2025): conversations.history is limited to 1 req/min for non-marketplace apps

### AI responses not working
- Verify your AI_GATEWAY_API_KEY or provider API key is correct
- Check that the AI_MODEL format matches your provider setup
- For AI Gateway: ensure you've configured a provider in the dashboard

---

## Security Notes

- **Never commit your `.env` file** - it's already in `.gitignore`
- Bot tokens provide access to your Slack workspace - keep them secure
- Consider using environment variables in production instead of `.env` files
- Rotate your tokens periodically

---

## Resources

- [Slack API Documentation](https://api.slack.com/docs)
- [Vercel AI Gateway Docs](https://vercel.com/docs/ai-gateway)
- [AI SDK Documentation](https://ai-sdk.dev/docs)
- [Next.js Documentation](https://nextjs.org/docs)
