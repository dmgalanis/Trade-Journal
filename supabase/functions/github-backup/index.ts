// Supabase Edge Function: github-backup
// Deploy with: supabase functions deploy github-backup
// Set your GitHub token first: supabase secrets set GITHUB_PAT=github_pat_...
//
// Lets the (already-authenticated) app list backup releases, trigger a new
// backup, or trigger a restore, without ever exposing a GitHub token to the
// browser. The token never touches the frontend.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GITHUB_TOKEN = Deno.env.get("GITHUB_PAT");

// Update these if you ever rename the repo or move it to another account.
const REPO_OWNER = "dmgalanis";
const REPO_NAME = "Trade-Journal";
const BRANCH = "main";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GITHUB_API = "https://api.github.com";

async function githubFetch(path: string, init: RequestInit = {}) {
  return fetch(`${GITHUB_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers || {}),
    },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { action, backup_tag } = await req.json();

    // ---------- List backups ----------
    if (action === "list") {
      const res = await githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/releases?per_page=30`);
      if (!res.ok) throw new Error(`GitHub releases fetch failed: ${await res.text()}`);
      const releases = await res.json();
      const backups = releases
        .filter((r: any) => typeof r.tag_name === "string" && r.tag_name.startsWith("backup-"))
        .map((r: any) => ({
          tag: r.tag_name,
          created_at: r.created_at,
          size: r.assets?.[0]?.size ?? null,
          html_url: r.html_url,
        }))
        .sort((a: any, b: any) => (a.created_at < b.created_at ? 1 : -1));
      return new Response(JSON.stringify({ backups }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Trigger a new backup ----------
    if (action === "trigger_backup") {
      const res = await githubFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/backup.yml/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ref: BRANCH }),
        }
      );
      if (!res.ok) throw new Error(`Trigger backup failed: ${await res.text()}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Trigger a restore ----------
    if (action === "trigger_restore") {
      if (!backup_tag) throw new Error("backup_tag is required");
      const res = await githubFetch(
        `/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/restore.yml/dispatches`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ref: BRANCH,
            inputs: { backup_tag, confirm: "RESTORE" },
          }),
        }
      );
      if (!res.ok) throw new Error(`Trigger restore failed: ${await res.text()}`);
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ---------- Latest run status (optional, used to show progress) ----------
    if (action === "status") {
      const [backupRes, restoreRes] = await Promise.all([
        githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/backup.yml/runs?per_page=1`),
        githubFetch(`/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/restore.yml/runs?per_page=1`),
      ]);
      const backupJson = backupRes.ok ? await backupRes.json() : { workflow_runs: [] };
      const restoreJson = restoreRes.ok ? await restoreRes.json() : { workflow_runs: [] };
      return new Response(
        JSON.stringify({
          backup: backupJson.workflow_runs?.[0]
            ? {
                status: backupJson.workflow_runs[0].status,
                conclusion: backupJson.workflow_runs[0].conclusion,
                created_at: backupJson.workflow_runs[0].created_at,
                html_url: backupJson.workflow_runs[0].html_url,
              }
            : null,
          restore: restoreJson.workflow_runs?.[0]
            ? {
                status: restoreJson.workflow_runs[0].status,
                conclusion: restoreJson.workflow_runs[0].conclusion,
                created_at: restoreJson.workflow_runs[0].created_at,
                html_url: restoreJson.workflow_runs[0].html_url,
              }
            : null,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
