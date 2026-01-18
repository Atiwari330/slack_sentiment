"use client";

import { useState, useEffect } from "react";
import { Mail, Check, Loader2, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface GmailConnectProps {
  onStatusChange?: (connected: boolean, email?: string) => void;
  className?: string;
}

export function GmailConnect({ onStatusChange, className }: GmailConnectProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [email, setEmail] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  useEffect(() => {
    checkGmailStatus();
  }, []);

  async function checkGmailStatus() {
    try {
      setIsLoading(true);
      const response = await fetch("/api/gmail/status");

      if (response.ok) {
        const data = await response.json();
        setIsConnected(data.connected);
        setEmail(data.email || null);
        onStatusChange?.(data.connected, data.email);
      } else {
        setIsConnected(false);
        onStatusChange?.(false);
      }
    } catch {
      setIsConnected(false);
      onStatusChange?.(false);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConnect() {
    setIsConnecting(true);
    try {
      const response = await fetch("/api/gmail/auth");
      const data = await response.json();

      if (data.authUrl) {
        // Open OAuth in a popup or redirect
        window.location.href = data.authUrl;
      }
    } catch (error) {
      console.error("Failed to start Gmail OAuth:", error);
    } finally {
      setIsConnecting(false);
    }
  }

  async function handleDisconnect() {
    try {
      await fetch("/api/gmail/disconnect", { method: "POST" });
      setIsConnected(false);
      setEmail(null);
      onStatusChange?.(false);
    } catch (error) {
      console.error("Failed to disconnect Gmail:", error);
    }
  }

  if (isLoading) {
    return (
      <Card className={cn("p-4", className)}>
        <div className="flex items-center gap-3">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Checking Gmail connection...</span>
        </div>
      </Card>
    );
  }

  return (
    <Card className={cn("p-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "h-10 w-10 rounded-full flex items-center justify-center",
              isConnected ? "bg-green-100 dark:bg-green-950" : "bg-muted"
            )}
          >
            <Mail
              className={cn(
                "h-5 w-5",
                isConnected ? "text-green-600 dark:text-green-400" : "text-muted-foreground"
              )}
            />
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              Gmail
              {isConnected && <Check className="h-4 w-4 text-green-600" />}
            </div>
            <div className="text-sm text-muted-foreground">
              {isConnected ? email : "Not connected"}
            </div>
          </div>
        </div>

        {isConnected ? (
          <Button variant="outline" size="sm" onClick={handleDisconnect}>
            Disconnect
          </Button>
        ) : (
          <Button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ExternalLink className="mr-2 h-4 w-4" />
            )}
            Connect Gmail
          </Button>
        )}
      </div>
    </Card>
  );
}
