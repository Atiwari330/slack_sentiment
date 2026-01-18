"use client";

import { useState, useEffect } from "react";
import { Mail, Building, Loader2, Trash2, Pencil, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ContactForm } from "@/components/contact-form";

interface Contact {
  id: string;
  name: string;
  email: string;
  company: string | null;
  role: string | null;
  context: string | null;
  tags: string[] | null;
  created_at: string;
}

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingContact, setEditingContact] = useState<Contact | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchContacts();
  }, []);

  async function fetchContacts() {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch("/api/contacts");
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to fetch contacts");
      }

      setContacts(data.contacts);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load contacts");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    setDeletingId(id);
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        throw new Error("Failed to delete contact");
      }

      setContacts((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete contact");
    } finally {
      setDeletingId(null);
    }
  }

  const filteredContacts = contacts.filter((contact) => {
    const query = searchQuery.toLowerCase();
    return (
      contact.name.toLowerCase().includes(query) ||
      contact.email.toLowerCase().includes(query) ||
      contact.company?.toLowerCase().includes(query) ||
      contact.tags?.some((tag) => tag.toLowerCase().includes(query))
    );
  });

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold">Contacts</h1>
              <p className="text-sm text-muted-foreground">
                Manage your email contacts for voice assistant
              </p>
            </div>
            <ContactForm onContactCreated={fetchContacts} />
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="container mx-auto px-4 py-4">
        <Input
          placeholder="Search contacts..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Content */}
      <main className="container mx-auto px-4 pb-6">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <Card className="p-6 text-center">
            <p className="text-destructive mb-4">{error}</p>
            <Button onClick={fetchContacts}>Retry</Button>
          </Card>
        ) : contacts.length === 0 ? (
          <Card className="p-12 text-center">
            <h2 className="text-lg font-medium mb-2">No contacts yet</h2>
            <p className="text-muted-foreground mb-4">
              Add your first contact to start using the voice email assistant.
            </p>
            <ContactForm onContactCreated={fetchContacts} />
          </Card>
        ) : filteredContacts.length === 0 ? (
          <Card className="p-12 text-center">
            <h2 className="text-lg font-medium mb-2">No matching contacts</h2>
            <p className="text-muted-foreground">
              Try a different search term.
            </p>
          </Card>
        ) : (
          <div className="space-y-2">
            {filteredContacts.map((contact) => (
              <Card
                key={contact.id}
                className="p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{contact.name}</h3>
                      {contact.role && (
                        <span className="text-sm text-muted-foreground">
                          · {contact.role}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        <span>{contact.email}</span>
                      </div>
                      {contact.company && (
                        <div className="flex items-center gap-1">
                          <Building className="h-3 w-3" />
                          <span>{contact.company}</span>
                        </div>
                      )}
                    </div>
                    {contact.context && (
                      <p className="text-sm text-muted-foreground mt-2 italic">
                        {contact.context}
                      </p>
                    )}
                    {contact.tags && contact.tags.length > 0 && (
                      <div className="flex items-center gap-1 mt-2">
                        <Tag className="h-3 w-3 text-muted-foreground" />
                        <div className="flex gap-1">
                          {contact.tags.map((tag) => (
                            <Badge key={tag} variant="secondary" className="text-xs">
                              {tag}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-foreground"
                      onClick={() => setEditingContact(contact)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-muted-foreground hover:text-destructive"
                      onClick={() => handleDelete(contact.id)}
                      disabled={deletingId === contact.id}
                    >
                      {deletingId === contact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            <p className="text-sm text-muted-foreground text-center pt-4">
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}
              {searchQuery && ` matching "${searchQuery}"`}
            </p>
          </div>
        )}
      </main>

      {/* Edit Dialog */}
      {editingContact && (
        <ContactForm
          editContact={editingContact}
          onContactCreated={fetchContacts}
          onClose={() => setEditingContact(null)}
        />
      )}
    </div>
  );
}
