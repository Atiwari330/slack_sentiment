"use client";

import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export interface ClarificationOption {
  id: string;
  label: string;
  description?: string;
}

interface ClarificationCardProps {
  question: string;
  options: ClarificationOption[];
  context?: string;
  onSelect: (option: ClarificationOption) => void;
  onCancel: () => void;
  isProcessing?: boolean;
  className?: string;
}

export function ClarificationCard({
  question,
  options,
  context,
  onSelect,
  onCancel,
  isProcessing,
  className,
}: ClarificationCardProps) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      {/* Header */}
      <div className="flex items-center gap-2 p-4 border-b bg-yellow-50 dark:bg-yellow-950/20">
        <HelpCircle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
        <span className="font-medium text-yellow-900 dark:text-yellow-200">
          Clarification Needed
        </span>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <p className="text-sm font-medium">{question}</p>

        {context && (
          <p className="text-sm text-muted-foreground">{context}</p>
        )}

        {/* Options */}
        <div className="space-y-2">
          {options.map((option) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              disabled={isProcessing}
              className={cn(
                "w-full text-left p-3 rounded-lg border bg-background",
                "hover:bg-muted hover:border-primary/50 transition-colors",
                "disabled:opacity-50 disabled:cursor-not-allowed"
              )}
            >
              <div className="font-medium text-sm">{option.label}</div>
              {option.description && (
                <div className="text-xs text-muted-foreground mt-1">
                  {option.description}
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="flex justify-end p-4 border-t bg-muted/30">
        <Button
          variant="ghost"
          onClick={onCancel}
          disabled={isProcessing}
        >
          Cancel
        </Button>
      </div>
    </Card>
  );
}
