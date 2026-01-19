import { NextResponse } from "next/server";
import { getProjects } from "@/lib/asana";

// GET /api/asana/projects - List Asana projects for dropdown
export async function GET() {
  try {
    if (!process.env.ASANA_ACCESS_TOKEN) {
      return NextResponse.json(
        { error: "Asana not configured" },
        { status: 500 }
      );
    }

    const projects = await getProjects();

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("Error fetching Asana projects:", error);
    return NextResponse.json(
      { error: "Failed to fetch Asana projects" },
      { status: 500 }
    );
  }
}
