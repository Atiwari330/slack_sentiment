"use client";

import { SlackDraftCard } from "./slack-draft-card";
import { AsanaDraftCard } from "./asana-draft-card";

interface DraftCardsProps {
  slackChannel: {
    name: string;
  };
  slackDraft: {
    message: string;
  } | null;
  asanaDraft: {
    taskTitle: string;
    taskDescription: string;
    subtasks: string[];
  } | null;
  asanaProject: {
    id: string | null;
    name: string | null;
  };
  contact: {
    name: string;
    email: string;
  };
  slackSent?: boolean;
  asanaCreated?: boolean;
  asanaTaskUrl?: string;
}

export function DraftCards({
  slackChannel,
  slackDraft,
  asanaDraft,
  asanaProject,
  contact,
  slackSent,
  asanaCreated,
  asanaTaskUrl,
}: DraftCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {/* Slack Draft */}
      {slackDraft && (
        <SlackDraftCard
          channelName={slackChannel.name}
          message={slackDraft.message}
          sent={slackSent}
        />
      )}

      {/* Asana Draft */}
      {asanaDraft && (
        <AsanaDraftCard
          projectName={asanaProject.name}
          taskTitle={asanaDraft.taskTitle}
          taskDescription={asanaDraft.taskDescription}
          subtasks={asanaDraft.subtasks}
          assigneeName={contact.name}
          created={asanaCreated}
          taskUrl={asanaTaskUrl}
        />
      )}
    </div>
  );
}
