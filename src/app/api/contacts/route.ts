import { NextRequest, NextResponse } from "next/server";
import {
  getAllContacts,
  searchContacts,
  createContact,
} from "@/lib/db/contacts";

// GET /api/contacts - List all contacts or search
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q");

    if (query) {
      const contacts = await searchContacts(query);
      return NextResponse.json({ contacts });
    } else {
      const contacts = await getAllContacts();
      return NextResponse.json({ contacts });
    }
  } catch (error) {
    console.error("Error fetching contacts:", error);
    return NextResponse.json(
      { error: "Failed to fetch contacts" },
      { status: 500 }
    );
  }
}

// POST /api/contacts - Create a new contact
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { name, email, company, role, context, tags } = body;

    if (!name || !email) {
      return NextResponse.json(
        { error: "name and email are required" },
        { status: 400 }
      );
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    const contact = await createContact({
      name,
      email,
      company,
      role,
      context,
      tags,
    });

    return NextResponse.json({ contact }, { status: 201 });
  } catch (error) {
    console.error("Error creating contact:", error);
    return NextResponse.json(
      { error: "Failed to create contact" },
      { status: 500 }
    );
  }
}
