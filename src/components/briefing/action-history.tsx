"use client";

import { useState, useEffect } from "react";
import {
  MessageSquare,
  Mail,
  CheckSquare,
  SkipForward,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface AccountAction {
  id: string;
  action_type: "slack_message" | "email" | "asana_task" | "skip";
  trigger_source: "briefing" | "manual";
  suggested_action: string | null;
  issue_summary: string | null;
  executed_message: string | null;
  status: "suggested" | "executed" | "skipped";
  sentiment_at_action: string | null;
  skip_reason: string | null;
  created_at: string;
  executed_at: string | null;
}

interface ActionHistoryProps {
  accountId: string;
}

const actionTypeConfig = {
  slack_message: { icon: MessageSquare, label: "Slack" },
  email: { icon: Mail, label: "Email" },
  asana_task: { icon: CheckSquare, label: "Asana" },
  skip: { icon: SkipForward, label: "Skipped" },
};

const statusConfig = {
  suggested: { icon: Clock, label: "Pending", className: "text-yellow-500" },
  executed: { icon: CheckCircle, label: "Sent", className: "text-green-500" },
  skipped: { icon: XCircle, label: "Skipped", className: "text-gray-400" },
};

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export function ActionHistory({ accountId }: ActionHistoryProps) {
  const [actions, setActions] = useState<AccountAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActions = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/briefing/actions/${accountId}`);
        if (!response.ok) {
          throw new Error("Failed to fetch action history");
        }
        const data = await response.json();
        setActions(data.actions || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load actions");
      } finally {
        setLoading(false);
      }
    };

    fetchActions();
  }, [accountId]);

  if (loading) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        Loading action history...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-500 py-4">
        {error}
      </div>
    );
  }

  if (actions.length === 0) {
    return (
      <div className="text-sm text-muted-foreground py-4">
        No actions recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {actions.map((action) => {
        const typeConfig = actionTypeConfig[action.action_type];
        const statusConf = statusConfig[action.status];
        const TypeIcon = typeConfig.icon;
        const StatusIcon = statusConf.icon;

        return (
          <div
            key={action.id}
            className="flex gap-3 pb-3 border-b last:border-0"
          >
            <div className="flex flex-col items-center">
              <div className={`
                w-8 h-8 rounded-full flex items-center justify-center
                ${action.status === "executed" ? "bg-green-100 text-green-600" :
                  action.status === "skipped" ? "bg-gray-100 text-gray-500" :
                  "bg-yellow-100 text-yellow-600"}
              `}>
                <TypeIcon className="h-4 w-4" />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium">{typeConfig.label}</span>
                <StatusIcon className={`h-3 w-3 ${statusConf.className}`} />
                <Badge variant="outline" className="text-xs py-0">
                  {action.trigger_source}
                </Badge>
              </div>

              {action.issue_summary && (
                <p className="text-sm text-muted-foreground mb-1 truncate">
                  {action.issue_summary}
                </p>
              )}

              {action.status === "executed" && action.executed_message && (
                <p className="text-sm line-clamp-2">
                  {action.executed_message}
                </p>
              )}

              {action.status === "skipped" && action.skip_reason && (
                <p className="text-sm text-muted-foreground italic">
                  Reason: {action.skip_reason}
                </p>
              )}

              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(action.executed_at || action.created_at)}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
