import { supabase, Contact } from "@/lib/supabase";

// Get all contacts
export async function getAllContacts(): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .order("name");

  if (error) throw error;
  return data || [];
}

// Get a single contact by ID
export async function getContactById(id: string): Promise<Contact | null> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Search contacts by name, email, or company (fuzzy search)
export async function searchContacts(query: string): Promise<Contact[]> {
  const searchTerm = `%${query.toLowerCase()}%`;

  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .or(`name.ilike.${searchTerm},email.ilike.${searchTerm},company.ilike.${searchTerm}`)
    .order("name")
    .limit(10);

  if (error) throw error;
  return data || [];
}

// Full-text search on contacts (more powerful)
export async function fullTextSearchContacts(query: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .textSearch("name", query, { type: "websearch" })
    .limit(10);

  if (error) {
    // Fall back to simple search if full-text fails
    return searchContacts(query);
  }
  return data || [];
}

// Create a new contact
export async function createContact(contact: {
  name: string;
  email: string;
  company?: string;
  role?: string;
  context?: string;
  tags?: string[];
}): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .insert({
      name: contact.name,
      email: contact.email,
      company: contact.company || null,
      role: contact.role || null,
      context: contact.context || null,
      tags: contact.tags || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Update a contact
export async function updateContact(
  id: string,
  updates: Partial<Pick<Contact, "name" | "email" | "company" | "role" | "context" | "tags">>
): Promise<Contact> {
  const { data, error } = await supabase
    .from("contacts")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete a contact
export async function deleteContact(id: string): Promise<void> {
  const { error } = await supabase
    .from("contacts")
    .delete()
    .eq("id", id);

  if (error) throw error;
}

// Get contacts by tag
export async function getContactsByTag(tag: string): Promise<Contact[]> {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .contains("tags", [tag])
    .order("name");

  if (error) throw error;
  return data || [];
}
