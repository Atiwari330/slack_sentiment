// Script to fetch and list all Slack channels
// Run with: node scripts/list-channels.mjs

import { WebClient } from "@slack/web-api";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

async function getAllChannels() {
  const channels = [];
  let cursor;

  do {
    const response = await slack.conversations.list({
      types: "public_channel,private_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });

    if (response.channels) {
      channels.push(...response.channels);
    }

    cursor = response.response_metadata?.next_cursor;
  } while (cursor);

  return channels;
}

async function main() {
  console.log("Fetching all Slack channels...\n");

  const channels = await getAllChannels();

  console.log(`Found ${channels.length} channels:\n`);
  console.log("=".repeat(80));

  // Sort alphabetically
  channels.sort((a, b) => a.name.localeCompare(b.name));

  // Output each channel
  for (const channel of channels) {
    const memberCount = channel.num_members || 0;
    const isPrivate = channel.is_private ? "[PRIVATE]" : "";
    const purpose = channel.purpose?.value ? ` - ${channel.purpose.value.slice(0, 60)}` : "";

    console.log(`${channel.name} (${memberCount} members) ${isPrivate}${purpose}`);
  }

  console.log("\n" + "=".repeat(80));
  console.log(`\nTotal: ${channels.length} channels`);

  // Output as JSON for analysis
  console.log("\n\n--- JSON OUTPUT FOR ANALYSIS ---\n");
  const simplified = channels.map((c) => ({
    name: c.name,
    id: c.id,
    members: c.num_members || 0,
    purpose: c.purpose?.value || "",
    isPrivate: c.is_private,
  }));
  console.log(JSON.stringify(simplified, null, 2));
}

main().catch(console.error);
