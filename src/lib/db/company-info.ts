import { supabase, CompanyInfo } from "@/lib/supabase";

// Get all company info
export async function getAllCompanyInfo(): Promise<CompanyInfo[]> {
  const { data, error } = await supabase
    .from("company_info")
    .select("*")
    .order("category")
    .order("key");

  if (error) throw error;
  return data || [];
}

// Get company info by key
export async function getCompanyInfoByKey(key: string): Promise<CompanyInfo | null> {
  const { data, error } = await supabase
    .from("company_info")
    .select("*")
    .eq("key", key)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // Not found
    throw error;
  }

  return data;
}

// Get company info by category
export async function getCompanyInfoByCategory(category: string): Promise<CompanyInfo[]> {
  const { data, error } = await supabase
    .from("company_info")
    .select("*")
    .eq("category", category)
    .order("key");

  if (error) throw error;
  return data || [];
}

// Get multiple company info values as a map
export async function getCompanyInfoMap(keys: string[]): Promise<Record<string, string>> {
  const { data, error } = await supabase
    .from("company_info")
    .select("key, value")
    .in("key", keys);

  if (error) throw error;

  const map: Record<string, string> = {};
  for (const item of data || []) {
    map[item.key] = item.value;
  }
  return map;
}

// Create or update company info (upsert)
export async function upsertCompanyInfo(info: {
  key: string;
  value: string;
  category?: string;
}): Promise<CompanyInfo> {
  const { data, error } = await supabase
    .from("company_info")
    .upsert({
      key: info.key,
      value: info.value,
      category: info.category || null,
    }, {
      onConflict: "key",
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// Delete company info by key
export async function deleteCompanyInfo(key: string): Promise<void> {
  const { error } = await supabase
    .from("company_info")
    .delete()
    .eq("key", key);

  if (error) throw error;
}

// Get all unique categories
export async function getCompanyInfoCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from("company_info")
    .select("category")
    .not("category", "is", null);

  if (error) throw error;

  const categories = new Set<string>();
  for (const item of data || []) {
    if (item.category) {
      categories.add(item.category);
    }
  }
  return Array.from(categories).sort();
}
