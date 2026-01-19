import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Missing Supabase environment variables");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

interface ContactSeed {
  name: string;
  email: string;
  company: string;
  role: string;
  context: string;
  tags: string[];
}

const contacts: ContactSeed[] = [
  {
    name: "Humberto Buniotto",
    email: "hbuniotto@opusbehavioral.com",
    company: "Opus",
    role: "CEO",
    context: "Chief Executive Officer at Opus Behavioral Health. Adi's boss.",
    tags: ["internal", "leadership", "executive"],
  },
  {
    name: "Christopher Garraffa",
    email: "cgarraffa@opusbehavioral.com",
    company: "Opus",
    role: "Account Executive",
    context: "Account Executive that works under Adi. Adi directly manages him.",
    tags: ["internal", "sales", "direct-report"],
  },
  {
    name: "Eric Brandman",
    email: "eric@opusbehavioral.com",
    company: "Opus",
    role: "CMO",
    context: "Chief Marketing Officer at Opus. Also a board member. One of Adi's superiors.",
    tags: ["internal", "leadership", "executive", "board"],
  },
  {
    name: "Jack Rice",
    email: "jrice@opusbehavioral.com",
    company: "Opus",
    role: "Account Executive",
    context: "Account Executive at Opus, similar role to Christopher and Amos.",
    tags: ["internal", "sales"],
  },
  {
    name: "Janelle Hall",
    email: "jhall@opusbehavioral.com",
    company: "Opus",
    role: "Onboarding/Implementation",
    context: "Onboarding and implementation team member. Part of the customer success team.",
    tags: ["internal", "customer-success", "onboarding"],
  },
  {
    name: "Amos Boyd",
    email: "aboyd@opusbehavioral.com",
    company: "Opus",
    role: "Account Executive",
    context: "Account Executive at Opus, similar role to Christopher and Jack.",
    tags: ["internal", "sales"],
  },
  {
    name: "Hector Fraginals",
    email: "hfraginals@opusbehavioral.com",
    company: "Opus",
    role: "CTO",
    context: "Chief Technology Officer at Opus. Counterpart to Adi - they are at the same level in the organization.",
    tags: ["internal", "leadership", "executive", "tech"],
  },
  {
    name: "Saagar Sachdev",
    email: "saagar@opusbehavioral.com",
    company: "Opus",
    role: "Head of Customer Success",
    context: "Leads the onboarding/implementation team and the customer support team at Opus.",
    tags: ["internal", "leadership", "customer-success"],
  },
  {
    name: "Ben Todys",
    email: "btodys@imagineteam.com",
    company: "Imagine",
    role: "Sr Developer Account Manager",
    context: "Senior Developer Account Manager and all-things expert for Opus RCM. Opus RCM is a white-labeled product developed by Imagine behind the scenes.",
    tags: ["external", "partner", "opus-rcm", "imagine"],
  },
  {
    name: "Laura Gil",
    email: "lgil@opusbehavioral.com",
    company: "Opus",
    role: "Onboarding/Implementation",
    context: "Onboarding and implementation team member. Part of the customer success team, similar role to Janelle.",
    tags: ["internal", "customer-success", "onboarding"],
  },
  {
    name: "John Catipon",
    email: "jcatipon@opusbehavioral.com",
    company: "Opus",
    role: "Customer Support Lead",
    context: "Lead of the customer support team. Reports to Saagar.",
    tags: ["internal", "customer-success", "support"],
  },
  {
    name: "Alyssa Putman",
    email: "aputman@bhrev.com",
    company: "BH Rev / Opus",
    role: "Director of RCM",
    context: "Director of Revenue Cycle Management at Opus. Previously held the same role at BH Rev, which is an internal sister company to Opus.",
    tags: ["internal", "leadership", "rcm", "bhrev"],
  },
  {
    name: "Rey Calunia",
    email: "rcalunia@opusbehavioral.com",
    company: "Opus",
    role: "Data Migration Coordinator",
    context: "Data migration coordinator who works with the support team on the customer success side. Specialty is data migration scoping and implementation.",
    tags: ["internal", "customer-success", "data-migration"],
  },
  {
    name: "Daniel Steven",
    email: "dsteven@imagineteam.com",
    company: "Imagine",
    role: "Account Executive",
    context: "Sales/Account Executive for Imagine (Opus RCM). Works with Ben Todys on the Imagine side.",
    tags: ["external", "partner", "opus-rcm", "imagine", "sales"],
  },
  {
    name: "Nikhil Parwal",
    email: "nikhil.parwal@leadsquared.com",
    company: "LeadSquared",
    role: "Account Executive",
    context: "Also known as 'Nick'. Account Executive for LeadSquared, a CRM company. They produce Opus CRM, which is a white-labeled CRM product connected to the base EHR product. External partner but works closely with the team.",
    tags: ["external", "partner", "opus-crm", "leadsquared", "sales"],
  },
];

async function seedContacts() {
  console.log("Starting contact seed...\n");

  let added = 0;
  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const contact of contacts) {
    try {
      // Check if contact already exists by email
      const { data: existing } = await supabase
        .from("contacts")
        .select("id, name")
        .eq("email", contact.email)
        .single();

      if (existing) {
        // Update existing contact
        const { error } = await supabase
          .from("contacts")
          .update({
            name: contact.name,
            company: contact.company,
            role: contact.role,
            context: contact.context,
            tags: contact.tags,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
        console.log(`✓ Updated: ${contact.name} (${contact.email})`);
        updated++;
      } else {
        // Insert new contact
        const { error } = await supabase.from("contacts").insert({
          name: contact.name,
          email: contact.email,
          company: contact.company,
          role: contact.role,
          context: contact.context,
          tags: contact.tags,
        });

        if (error) throw error;
        console.log(`+ Added: ${contact.name} (${contact.email})`);
        added++;
      }
    } catch (err) {
      console.error(`✗ Error with ${contact.name}:`, err);
      errors++;
    }
  }

  console.log("\n--- Summary ---");
  console.log(`Added: ${added}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped: ${skipped}`);
  console.log(`Errors: ${errors}`);
  console.log(`Total: ${contacts.length}`);
}

seedContacts()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  });
