import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async () => {
  try {
    // Fetch all rows from tvl_data
    const { data, error } = await supabase
      .from("tvl_data")
      .select("*"); // get all columns

    if (error) {
      console.error("Error fetching tvl_data:", error);
      return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }

    console.log("tvl_data:", data); // print in local console

    // Example: manipulate data here
    // e.g., add a new property to each snapshot
    const manipulated = data?.map((row: any) => ({
      ...row,
      totalProtocols: row.data ? Object.keys(row.data).length : 0,
    }));

    return new Response(JSON.stringify({ raw: data, manipulated }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 });
  }
});
