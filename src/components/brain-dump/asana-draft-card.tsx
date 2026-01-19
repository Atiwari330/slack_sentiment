"use client";

import { CheckSquare, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface AsanaDraftCardProps {
  projectName: string | null;
  taskTitle: string;
  taskDescription: string;
  subtasks: string[];
  assigneeName?: string;
  created?: boolean;
  taskUrl?: string;
}

export function AsanaDraftCard({
  projectName,
  taskTitle,
  taskDescription,
  subtasks,
  assigneeName,
  created,
  taskUrl,
}: AsanaDraftCardProps) {
  return (
    <Card className="flex-1">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckSquare className="h-4 w-4" />
            Asana Task
          </CardTitle>
          {created && (
            <Badge variant="secondary" className="bg-green-100 text-green-800">
              Created
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          {projectName ? `Project: ${projectName}` : "No project selected"}
          {assigneeName && ` • Assignee: ${assigneeName}`}
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Task Title */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Title
          </p>
          <p className="font-medium">{taskTitle}</p>
        </div>

        {/* Task Description */}
        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">
            Description
          </p>
          <div className="bg-muted/50 rounded-lg p-3 text-sm whitespace-pre-wrap">
            {taskDescription}
          </div>
        </div>

        {/* Subtasks */}
        {subtasks.length > 0 && (
          <div>
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
              Subtasks ({subtasks.length})
            </p>
            <ul className="space-y-1">
              {subtasks.map((subtask, index) => (
                <li
                  key={index}
                  className="flex items-start gap-2 text-sm bg-muted/30 rounded px-2 py-1"
                >
                  <span className="text-muted-foreground">
                    {index + 1}.
                  </span>
                  <span>{subtask}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Task URL when created */}
        {created && taskUrl && (
          <a
            href={taskUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open in Asana
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </CardContent>
    </Card>
  );
}
