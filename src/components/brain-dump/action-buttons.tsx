"use client";

import { Loader2, Send, CheckSquare, Zap, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ActionButtonsProps {
  onSendSlack: () => void;
  onCreateAsana: () => void;
  onDoBoth: () => void;
  onRevise: () => void;
  onCancel: () => void;
  slackSent: boolean;
  asanaCreated: boolean;
  hasAsanaProject: boolean;
  isSendingSlack: boolean;
  isCreatingAsana: boolean;
  isProcessing: boolean;
}

export function ActionButtons({
  onSendSlack,
  onCreateAsana,
  onDoBoth,
  onRevise,
  onCancel,
  slackSent,
  asanaCreated,
  hasAsanaProject,
  isSendingSlack,
  isCreatingAsana,
  isProcessing,
}: ActionButtonsProps) {
  const bothDone = slackSent && asanaCreated;
  const anyInProgress = isSendingSlack || isCreatingAsana || isProcessing;

  // Show completion state when both are done
  if (bothDone) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="flex items-center gap-2 text-green-600">
          <CheckSquare className="h-5 w-5" />
          <span className="font-medium">All done!</span>
        </div>
        <Button variant="outline" onClick={onCancel}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Start New Brain Dump
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Main action buttons */}
      <div className="flex flex-wrap justify-center gap-2">
        {/* Send Slack */}
        <Button
          onClick={onSendSlack}
          disabled={slackSent || anyInProgress}
          variant={slackSent ? "secondary" : "default"}
        >
          {isSendingSlack ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Sending...
            </>
          ) : slackSent ? (
            <>
              <CheckSquare className="mr-2 h-4 w-4" />
              Slack Sent
            </>
          ) : (
            <>
              <Send className="mr-2 h-4 w-4" />
              Send Slack
            </>
          )}
        </Button>

        {/* Create Asana */}
        <Button
          onClick={onCreateAsana}
          disabled={asanaCreated || !hasAsanaProject || anyInProgress}
          variant={asanaCreated ? "secondary" : "default"}
          title={!hasAsanaProject ? "No Asana project configured for this contact" : undefined}
        >
          {isCreatingAsana ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Creating...
            </>
          ) : asanaCreated ? (
            <>
              <CheckSquare className="mr-2 h-4 w-4" />
              Asana Created
            </>
          ) : (
            <>
              <CheckSquare className="mr-2 h-4 w-4" />
              Create Asana
            </>
          )}
        </Button>

        {/* Do Both */}
        {!slackSent && !asanaCreated && hasAsanaProject && (
          <Button
            onClick={onDoBoth}
            disabled={anyInProgress}
            variant="default"
            className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            {anyInProgress ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <Zap className="mr-2 h-4 w-4" />
                Do Both
              </>
            )}
          </Button>
        )}
      </div>

      {/* Secondary actions */}
      <div className="flex justify-center gap-2">
        <Button
          variant="outline"
          onClick={onRevise}
          disabled={anyInProgress}
        >
          <RefreshCw className="mr-2 h-4 w-4" />
          Revise
        </Button>
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={anyInProgress}
        >
          <X className="mr-2 h-4 w-4" />
          Cancel
        </Button>
      </div>

      {/* Warning for missing Asana project */}
      {!hasAsanaProject && (
        <p className="text-xs text-center text-amber-600">
          No Asana project configured for this contact. Update contact settings to enable task creation.
        </p>
      )}
    </div>
  );
}
