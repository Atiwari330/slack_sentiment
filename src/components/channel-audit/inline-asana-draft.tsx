"use client";

import { useState } from "react";
import { CheckSquare, Check, Edit2, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

interface AsanaDraft {
  taskTitle: string;
  taskDescription: string;
  subtasks: string[];
  assigneeEmail: string | null;
  context: string | null;
}

interface InlineAsanaDraftProps {
  draft: AsanaDraft;
  projectId: string | null;
  projectName: string | null;
  onApprove: (result: { success: boolean; taskUrl?: string }) => void;
  onRevise: (feedback: string) => void;
}

export function InlineAsanaDraft({
  draft,
  projectId,
  projectName,
  onApprove,
  onRevise,
}: InlineAsanaDraftProps) {
  const [isApproving, setIsApproving] = useState(false);
  const [isRevising, setIsRevising] = useState(false);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const [status, setStatus] = useState<"pending" | "approved" | "error">("pending");
  const [taskUrl, setTaskUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleApprove = async () => {
    if (!projectId) {
      setErrorMessage("Please select an Asana project first");
      return;
    }

    setIsApproving(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/channel-audit/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "asana",
          projectId,
          taskTitle: draft.taskTitle,
          taskDescription: draft.taskDescription,
          subtasks: draft.subtasks,
          assigneeEmail: draft.assigneeEmail,
        }),
      });

      const result = await response.json();

      if (result.success) {
        setStatus("approved");
        setTaskUrl(result.taskUrl);
        onApprove({ success: true, taskUrl: result.taskUrl });
      } else {
        setStatus("error");
        setErrorMessage(result.error || "Failed to create task");
        onApprove({ success: false });
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage(error instanceof Error ? error.message : "Failed to create task");
      onApprove({ success: false });
    } finally {
      setIsApproving(false);
    }
  };

  const handleRevise = () => {
    if (revisionFeedback.trim()) {
      onRevise(revisionFeedback);
      setRevisionFeedback("");
      setIsRevising(false);
    }
  };

  if (status === "approved") {
    return (
      <Card className="p-4 bg-green-50 dark:bg-green-950 border-green-200 dark:border-green-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
            <Check className="h-4 w-4" />
            <span className="font-medium">Task created in {projectName}</span>
          </div>
          {taskUrl && (
            <a
              href={taskUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-green-600 hover:underline"
            >
              Open in Asana
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/50">
      <div className="space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-purple-600" />
            <span className="font-medium text-sm">Asana Task Draft</span>
          </div>
          {projectName ? (
            <Badge variant="outline" className="text-xs">
              {projectName}
            </Badge>
          ) : (
            <Badge variant="destructive" className="text-xs">
              No project selected
            </Badge>
          )}
        </div>

        {/* Context */}
        {draft.context && (
          <p className="text-xs text-muted-foreground">{draft.context}</p>
        )}

        {/* Task Preview */}
        <div className="bg-white dark:bg-gray-900 rounded-md p-3 border space-y-2">
          {/* Title */}
          <div className="font-medium text-sm">{draft.taskTitle}</div>

          {/* Description */}
          {draft.taskDescription && (
            <div className="text-sm text-muted-foreground whitespace-pre-wrap">
              {draft.taskDescription}
            </div>
          )}

          {/* Subtasks */}
          {draft.subtasks.length > 0 && (
            <div className="pt-2 border-t space-y-1">
              <div className="text-xs font-medium text-muted-foreground">Subtasks:</div>
              <ul className="space-y-1">
                {draft.subtasks.map((subtask, index) => (
                  <li key={index} className="flex items-center gap-2 text-sm">
                    <div className="h-3 w-3 rounded border border-gray-300" />
                    {subtask}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Assignee */}
          {draft.assigneeEmail && (
            <div className="pt-2 border-t text-xs text-muted-foreground">
              Assignee: <span className="font-medium">{draft.assigneeEmail}</span>
            </div>
          )}
        </div>

        {/* Error Message */}
        {errorMessage && (
          <div className="text-xs text-destructive bg-destructive/10 p-2 rounded">
            {errorMessage}
          </div>
        )}

        {/* Revision Input */}
        {isRevising && (
          <div className="space-y-2">
            <Textarea
              value={revisionFeedback}
              onChange={(e) => setRevisionFeedback(e.target.value)}
              placeholder="What would you like to change?"
              className="text-sm"
              rows={2}
            />
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => setIsRevising(false)}>
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleRevise}
                disabled={!revisionFeedback.trim()}
              >
                Submit Revision
              </Button>
            </div>
          </div>
        )}

        {/* Actions */}
        {!isRevising && (
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={handleApprove}
              disabled={isApproving || !projectId}
              className="flex-1"
            >
              {isApproving ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Check className="h-3 w-3 mr-1" />
                  Approve & Create
                </>
              )}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsRevising(true)}
              disabled={isApproving}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Revise
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
}
