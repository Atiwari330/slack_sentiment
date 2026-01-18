import { NextRequest, NextResponse } from "next/server";
import { exchangeCodeForTokens, saveGmailTokens } from "@/lib/gmail";

// GET /api/gmail/callback - Handle OAuth callback
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get("code");
    const error = searchParams.get("error");

    if (error) {
      // User denied access or other error
      return NextResponse.redirect(new URL("/voice?gmail_error=access_denied", request.url));
    }

    if (!code) {
      return NextResponse.redirect(new URL("/voice?gmail_error=no_code", request.url));
    }

    // Exchange code for tokens
    const { accessToken, refreshToken, expiresAt, email } = await exchangeCodeForTokens(code);

    // Save tokens to database
    await saveGmailTokens(email, accessToken, refreshToken, expiresAt);

    // Redirect back to voice page with success
    return NextResponse.redirect(new URL("/voice?gmail_connected=true", request.url));
  } catch (error) {
    console.error("Error handling Gmail callback:", error);
    return NextResponse.redirect(new URL("/voice?gmail_error=token_exchange_failed", request.url));
  }
}
