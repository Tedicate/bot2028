import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { rows, clear } = await req.json();

    // If clear flag, delete all existing data first
    if (clear) {
      await supabase.from("university_courses").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    }

    // rows is array of arrays: [region, area, university, college, department, core_subjects, recommended_subjects, notes]
    if (!rows || !Array.isArray(rows)) {
      return new Response(JSON.stringify({ error: "rows array required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const records = rows.map((r: string[]) => ({
      region: r[0] || "",
      area: r[1] || "",
      university: r[2] || "",
      college: r[3] || "",
      department: r[4] || "",
      core_subjects: r[5] || "",
      recommended_subjects: r[6] || "",
      notes: r[7] || "",
    }));

    // Batch insert in chunks of 100
    let inserted = 0;
    for (let i = 0; i < records.length; i += 100) {
      const chunk = records.slice(i, i + 100);
      const { error } = await supabase.from("university_courses").insert(chunk);
      if (error) {
        console.error("Insert error:", error);
        return new Response(JSON.stringify({ error: error.message, inserted }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      inserted += chunk.length;
    }

    return new Response(JSON.stringify({ success: true, inserted }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Seed error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
