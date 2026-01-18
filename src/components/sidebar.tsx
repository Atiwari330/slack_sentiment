"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, MessageSquare, Mic, Contact } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/accounts",
    label: "Accounts",
    icon: Users,
  },
  {
    href: "/voice",
    label: "Voice Email",
    icon: Mic,
  },
  {
    href: "/contacts",
    label: "Contacts",
    icon: Contact,
  },
  {
    href: "/",
    label: "Chat",
    icon: MessageSquare,
  },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-56 border-r bg-card h-screen sticky top-0 flex flex-col">
      {/* Logo / Title */}
      <div className="p-4 border-b">
        <h1 className="font-bold text-lg">Sentiment Tracker</h1>
        <p className="text-xs text-muted-foreground">Customer Health Monitor</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-2">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t text-xs text-muted-foreground">
        Slack Sentiment Analysis
      </div>
    </aside>
  );
}
