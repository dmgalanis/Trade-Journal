// Supabase Edge Function: ai-summary
// Deploy with: supabase functions deploy ai-summary
// Set your OpenAI key first: supabase secrets set OPENAI_API_KEY=sk-...
//
// This function receives the day's journal data (+ optional screenshot image URLs)
// and returns a short AI-generated summary. The OpenAI key never touches the browser.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const {
      entry_date,
      followed_rules,
      violations = [],
      emotions = [],
      market_condition,
      volatility,
      notes,
      improvements,
      screenshot_urls = [],
    } = await req.json();

    const promptText = `You are a trading psychology coach. Summarize this trading journal entry in 3-5 concise sentences. 
Focus on: whether rules were followed, any patterns in rule violations or emotions, and one actionable takeaway for improvement.
Be direct and specific, not generic.

Date: ${entry_date}
Followed rules: ${followed_rules === null ? "not specified" : followed_rules ? "Yes" : "No"}
Rule violations: ${violations.length ? violations.join(", ") : "none"}
Emotions felt: ${emotions.length ? emotions.join(", ") : "none noted"}
Market condition: ${market_condition || "not specified"}
Volatility: ${volatility || "not specified"}
Notes: ${notes || "none"}
Areas for improvement (self-noted): ${improvements || "none"}`;

    const content: any[] = [{ type: "text", text: promptText }];
    for (const url of screenshot_urls.slice(0, 4)) {
      content.push({ type: "image_url", image_url: { url } });
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content }],
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return new Response(JSON.stringify({ error: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const summary = data.choices?.[0]?.message?.content ?? "No summary generated.";

    return new Response(JSON.stringify({ summary }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
