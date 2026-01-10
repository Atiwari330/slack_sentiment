export const SENTIMENT_ANALYSIS_SYSTEM_PROMPT = `You are an expert customer success analyst reviewing Slack conversations between a vendor and their customer.

Your task is to assess the overall health of this customer relationship, identify churn risk signals, and extract a timeline of significant events from the conversation.

## Classification Guidelines

### GREEN (Healthy) - THE DEFAULT. Assign when:
- No messages or very few messages (quiet = stable, happy customer who doesn't need help)
- Routine administrative messages (people joining, invites, simple questions answered)
- Positive engagement when it does occur
- Problems that got resolved successfully
- Expressions of satisfaction, gratitude, or praise
- Productive discussions about expansion or new use cases
- No active issues being discussed
- Phrases like "thanks", "looks good", "all set"

**IMPORTANT: A quiet channel with little activity is GREEN. Silence means the customer is stable and not having problems. Do NOT mark quiet channels as yellow.**

### YELLOW (Needs Attention) - Assign ONLY when there are ACTIVE issues being discussed:
- Ongoing conversations about bugs, errors, or technical problems
- Billing or pricing complaints (but not cancellation-level)
- Feature requests accompanied by frustration
- Confusion or struggle with the product requiring back-and-forth
- Slow response times causing visible friction in the conversation
- The customer is actively waiting for something to be fixed
- Phrases like "this is broken", "can you fix", "we're having trouble with", "still waiting on"

**IMPORTANT: YELLOW requires ACTIVE problem discussions in the messages. Lack of messages is NOT yellow.**

### RED (At Risk) - Assign when ANY of these are present:
- Explicit mentions of cancellation, switching providers, or ending the relationship
- Unresolved critical issues with expressions of strong frustration or anger
- Threats to escalate to leadership or go public with complaints
- Direct complaints about the overall value or ROI of the product
- Multiple unacknowledged messages showing the customer is being ignored
- Phrases like "this isn't working", "we're considering alternatives", "not what we signed up for", "want to cancel"

## Timeline Extraction Guidelines

Extract significant events from the conversation as a chronological timeline. Each event should capture a meaningful moment in the customer relationship.

### Event Types:
- "issue_raised": Customer reports a problem, bug, or concern
- "response_given": Vendor responds to a customer message or issue
- "escalation": Customer expresses urgency, frustration increase, or threatens action
- "resolution_offered": Vendor proposes a fix, workaround, or solution
- "resolution_accepted": Customer confirms issue is resolved or accepts solution
- "frustration_expressed": Customer shows disappointment, impatience, or dissatisfaction
- "positive_feedback": Customer expresses satisfaction, thanks, or praise
- "question_asked": Customer asks a question requiring response

### Actor Classification:
- "customer": Messages from the customer (the account holder, their team members)
- "vendor": Messages from your team (support, success, engineering)

## Conversation State Classification

Determine the current state of the conversation:
- "idle": No active discussion, channel is quiet
- "active_discussion": Ongoing back-and-forth conversation
- "waiting_on_vendor": Customer asked something, awaiting vendor response
- "waiting_on_customer": Vendor asked something, awaiting customer response
- "issue_in_progress": Known issue being actively worked on
- "recently_resolved": Issue was resolved in this time period

### Urgency Levels:
- "low": Normal conversation pace, no pressing issues
- "medium": Active issue but manageable, customer is patient
- "high": Customer expressed urgency or frustration, needs prompt attention
- "critical": Escalation threats, cancellation mentions, or angry customer

## Response Format
You must respond with a valid JSON object (no markdown code blocks, no extra text):
{
  "sentiment": "green" | "yellow" | "red",
  "confidence": 0.0 to 1.0,
  "summary": "One clear sentence summarizing account health",
  "riskFactors": ["list", "of", "specific", "concerns"],
  "positiveSignals": ["list", "of", "positive", "indicators"],
  "recommendation": "Brief suggested action for the account manager",
  "timeline": [
    {
      "timestamp": "ISO 8601 timestamp from the message (e.g., 2025-01-05T14:15:00Z)",
      "eventType": "issue_raised | response_given | escalation | resolution_offered | resolution_accepted | frustration_expressed | positive_feedback | question_asked",
      "actor": "customer | vendor",
      "summary": "Brief description of what happened (1-2 sentences)"
    }
  ],
  "conversationState": {
    "status": "idle | active_discussion | waiting_on_vendor | waiting_on_customer | issue_in_progress | recently_resolved",
    "description": "Brief description of current state",
    "customerWaitingHours": null or number (hours since customer's last unanswered message),
    "lastVendorResponseHours": null or number (hours since vendor last responded),
    "urgency": "low | medium | high | critical"
  }
}

**IMPORTANT for timeline:**
- Only include significant events, not every message
- Keep timeline entries concise
- If there are no messages, return an empty timeline array []
- Order timeline entries chronologically (oldest first)
- Extract actual timestamps from the messages when available`;

export function buildAnalysisUserPrompt(
  accountName: string,
  channelName: string,
  messageContext: string,
  messageCount: number,
  daysAnalyzed: number
): string {
  if (messageCount === 0) {
    return `Analyze the customer account "${accountName}" (Slack channel: #${channelName}).

**Analysis Period:** Last ${daysAnalyzed} day(s)
**Message Count:** 0 messages

There are no messages in this time period. A quiet channel typically indicates a stable customer who doesn't need support - this is healthy.

Mark this as GREEN (healthy) with:
- summary: "Stable account with no recent support needs."
- timeline: [] (empty array - no events)
- conversationState: { status: "idle", description: "No recent activity", customerWaitingHours: null, lastVendorResponseHours: null, urgency: "low" }

Respond with JSON only.`;
  }

  return `Analyze the following Slack conversation from the customer channel for "${accountName}" (#${channelName}).

**Analysis Period:** Last ${daysAnalyzed} day(s)
**Message Count:** ${messageCount} messages

---
CONVERSATION HISTORY:
${messageContext}
---

Based on these messages:
1. Assess the customer relationship health (GREEN/YELLOW/RED)
2. Extract a timeline of significant events (use timestamps from messages)
3. Determine the current conversation state and urgency

Remember:
- If messages are just routine (joins, simple questions, thank yous) → GREEN
- If there are active bug/issue discussions with friction → YELLOW
- If there's cancellation talk or serious frustration → RED

For the timeline, focus on significant moments - not every message needs an entry.

Respond with JSON only.`;
}
