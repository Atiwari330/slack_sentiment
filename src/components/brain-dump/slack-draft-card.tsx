"use client";

import { Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface SlackDraftCardProps {
  channelName: string;
  message: string;
  sent?: boolean;
}

export function SlackDraftCard({ channelName, message, sent }: SlackDraftCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Hash className="h-4 w-4" />
            Slack Message
          </CardTitle>
          {sent && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Sent
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          To: #{channelName}
        </p>
      </CardHeader>
      <CardContent>
        <div className="bg-muted/50 rounded-lg p-4 text-sm whitespace-pre-wrap">
          {message}
        </div>
      </CardContent>
    </Card>
  );
}
