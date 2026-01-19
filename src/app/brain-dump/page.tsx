"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { BrainDumpAssistant } from "@/components/brain-dump/brain-dump-assistant";

export default function BrainDumpPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
            <div>
              <h1 className="font-semibold">Brain Dump</h1>
              <p className="text-xs text-muted-foreground">
                Turn thoughts into Slack messages + Asana tasks
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <BrainDumpAssistant />
      </main>
    </div>
  );
}
