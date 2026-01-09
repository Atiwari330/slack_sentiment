import { NextRequest, NextResponse } from "next/server";
import {
  getAccountsWithSentiment,
  createAccount,
  getAllAccounts,
} from "@/lib/db/accounts";

// GET /api/accounts - List all accounts with sentiment
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const withSentiment = searchParams.get("withSentiment") !== "false";

    if (withSentiment) {
      const accounts = await getAccountsWithSentiment();
      return NextResponse.json({ accounts });
    } else {
      const accounts = await getAllAccounts();
      return NextResponse.json({ accounts });
    }
  } catch (error) {
    console.error("Error fetching accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch accounts" },
      { status: 500 }
    );
  }
}

// POST /api/accounts - Create a new account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, slackChannelId, slackChannelName } = body;

    if (!name || !slackChannelId) {
      return NextResponse.json(
        { error: "name and slackChannelId are required" },
        { status: 400 }
      );
    }

    const account = await createAccount(name, slackChannelId, slackChannelName);
    return NextResponse.json({ account }, { status: 201 });
  } catch (error: unknown) {
    console.error("Error creating account:", error);

    // Check for unique constraint violation (duplicate channel)
    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
      return NextResponse.json(
        { error: "This Slack channel is already linked to another account" },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}
