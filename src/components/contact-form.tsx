"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  context: string | null;
  tags: string[] | null;
}

interface ContactFormProps {
  onContactCreated: () => void;
  editContact?: Contact | null;
  onClose?: () => void;
}

export function ContactForm({ onContactCreated, editContact, onClose }: ContactFormProps) {
  const [open, setOpen] = useState(!!editContact);
  const [name, setName] = useState(editContact?.name || "");
  const [email, setEmail] = useState(editContact?.email || "");
  const [company, setCompany] = useState(editContact?.company || "");
  const [role, setRole] = useState(editContact?.role || "");
  const [context, setContext] = useState(editContact?.context || "");
  const [tags, setTags] = useState(editContact?.tags?.join(", ") || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEditing = !!editContact;

  function handleOpenChange(newOpen: boolean) {
    setOpen(newOpen);
    if (!newOpen) {
      resetForm();
      onClose?.();
    }
  }

  function resetForm() {
    setName("");
    setEmail("");
    setCompany("");
    setRole("");
    setContext("");
    setTags("");
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const tagsArray = tags
        .split(",")
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const body = {
        name: name.trim(),
        email: email.trim(),
        company: company.trim() || null,
        role: role.trim() || null,
        context: context.trim() || null,
        tags: tagsArray.length > 0 ? tagsArray : null,
      };

      const url = isEditing ? `/api/contacts/${editContact.id}` : "/api/contacts";
      const method = isEditing ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Failed to ${isEditing ? "update" : "create"} contact`);
      }

      resetForm();
      setOpen(false);
      onContactCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEditing ? "update" : "create"} contact`);
    } finally {
      setSubmitting(false);
    }
  }

  const dialogContent = (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>{isEditing ? "Edit Contact" : "Add New Contact"}</DialogTitle>
      </DialogHeader>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="name" className="text-sm font-medium">
              Name *
            </label>
            <Input
              id="name"
              placeholder="John Smith"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">
              Email *
            </label>
            <Input
              id="email"
              type="email"
              placeholder="john@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <label htmlFor="company" className="text-sm font-medium">
              Company
            </label>
            <Input
              id="company"
              placeholder="Acme Corp"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              disabled={submitting}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="role" className="text-sm font-medium">
              Role
            </label>
            <Input
              id="role"
              placeholder="CEO"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              disabled={submitting}
            />
          </div>
        </div>

        <div className="space-y-2">
          <label htmlFor="context" className="text-sm font-medium">
            Context
          </label>
          <Input
            id="context"
            placeholder="e.g., Prefers formal tone, met at conference"
            value={context}
            onChange={(e) => setContext(e.target.value)}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            Add notes to help the AI compose better emails
          </p>
        </div>

        <div className="space-y-2">
          <label htmlFor="tags" className="text-sm font-medium">
            Tags
          </label>
          <Input
            id="tags"
            placeholder="client, priority, investor"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            disabled={submitting}
          />
          <p className="text-xs text-muted-foreground">
            Comma-separated tags for organization
          </p>
        </div>

        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-3 rounded-md">
            {error}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={!name.trim() || !email.trim() || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {isEditing ? "Saving..." : "Creating..."}
              </>
            ) : isEditing ? (
              "Save Changes"
            ) : (
              "Create Contact"
            )}
          </Button>
        </div>
      </form>
    </DialogContent>
  );

  // If editing, don't show trigger button
  if (isEditing) {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        {dialogContent}
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Add Contact
        </Button>
      </DialogTrigger>
      {dialogContent}
    </Dialog>
  );
}
