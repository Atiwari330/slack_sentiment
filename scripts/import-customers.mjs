// Import customer channels (500-599) into the Accounts database
// Run with: node scripts/import-customers.mjs

import { WebClient } from "@slack/web-api";
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, "..", ".env") });

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Channels to exclude (internal/operational)
const EXCLUDE = new Set([
  "500-onboarding",
  "502-breeze-migration",
  "504-ways-to-use-opus",
  "505-ai-migration-test",
  "500-nbh",
  "506-gpass",
  "501-nasr-consulting-group", // consulting, not customer
  "551-resiliencebilling", // billing internal
]);

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
    if (response.channels) channels.push(...response.channels);
    cursor = response.response_metadata?.next_cursor;
  } while (cursor);
  return channels;
}

async function main() {
  console.log("Fetching Slack channels...");
  const allChannels = await getAllChannels();

  // Filter to 500-599 range customer channels
  const customerChannels = allChannels
    .filter(c => /^5\d{2}-/.test(c.name))
    .filter(c => !EXCLUDE.has(c.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  console.log(`Found ${customerChannels.length} customer channels to import.\n`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const channel of customerChannels) {
    const accountName = channel.name; // Use Slack name directly

    // Check if already exists
    const { data: existing } = await supabase
      .from("accounts")
      .select("id")
      .eq("slack_channel_id", channel.id)
      .single();

    if (existing) {
      console.log(`SKIP: ${accountName} (already exists)`);
      skipped++;
      continue;
    }

    // Insert new account
    const { error } = await supabase.from("accounts").insert({
      name: accountName,
      slack_channel_id: channel.id,
      slack_channel_name: channel.name,
    });

    if (error) {
      console.log(`ERROR: ${accountName} - ${error.message}`);
      errors++;
    } else {
      console.log(`ADDED: ${accountName}`);
      imported++;
    }
  }

  console.log(`\n--- DONE ---`);
  console.log(`Imported: ${imported}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
}

main().catch(console.error);
