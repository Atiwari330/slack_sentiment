import { NextResponse } from "next/server";
import { getChangedAccounts } from "@/lib/db/sentiment";

export async function GET() {
  try {
    const changes = await getChangedAccounts();
    return NextResponse.json({ changes });
  } catch (error) {
    console.error("Error fetching changed accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch changed accounts" },
      { status: 500 }
    );
  }
}
