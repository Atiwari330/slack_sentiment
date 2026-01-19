"use client";

import { useState, useEffect } from "react";
import { RefreshCw, ChevronDown, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

interface AsanaProject {
  gid: string;
  name: string;
}

interface AsanaProjectSelectProps {
  value: { id: string | null; name: string | null };
  onChange: (project: { id: string | null; name: string | null }) => void;
  disabled?: boolean;
}

export function AsanaProjectSelect({
  value,
  onChange,
  disabled = false,
}: AsanaProjectSelectProps) {
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<AsanaProject[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchProjects() {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/asana/projects");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch projects");
      }

      setProjects(data.projects || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchProjects();
  }, []);

  function handleSelect(project: AsanaProject | null) {
    if (project) {
      onChange({ id: project.gid, name: project.name });
    } else {
      onChange({ id: null, name: null });
    }
    setOpen(false);
  }

  return (
    <div className="flex gap-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="flex-1 justify-between font-normal"
            disabled={disabled || loading}
          >
            {loading ? (
              <span className="text-muted-foreground">Loading projects...</span>
            ) : value.name ? (
              <span className="truncate">{value.name}</span>
            ) : (
              <span className="text-muted-foreground">Select Asana project...</span>
            )}
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[300px] p-0" align="start">
          <Command>
            <CommandInput placeholder="Search projects..." />
            <CommandList>
              <CommandEmpty>
                {error ? (
                  <span className="text-destructive">{error}</span>
                ) : (
                  "No projects found."
                )}
              </CommandEmpty>
              <CommandGroup>
                <CommandItem
                  value="__none__"
                  onSelect={() => handleSelect(null)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      !value.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="text-muted-foreground">None</span>
                </CommandItem>
                {projects.map((project) => (
                  <CommandItem
                    key={project.gid}
                    value={project.name}
                    onSelect={() => handleSelect(project)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        value.id === project.gid ? "opacity-100" : "opacity-0"
                      )}
                    />
                    {project.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={fetchProjects}
        disabled={disabled || loading}
        title="Refresh projects"
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
      </Button>
    </div>
  );
}
