import { getEpisode } from "./rebuild.js";
import { findEpisodeStream, validateToken } from "./realdebrid.js";
import { decryptConfig, encryptConfig } from "./config.js";

const baseManifest = {
  id: "com.community.narutorebuild.rd",
  version: "2.0.0",
  name: "Naruto Rebuild RD Library",
  description: "Streams Rebuild of Naruto episodes already stored in each user's Real-Debrid library.",
  resources: ["stream"],
  types: ["series"],
  catalogs: [],
  idPrefixes: ["NR"],
  behaviorHints: { configurable: false, configurationRequired: false }
};

function json(res, status, payload, cache = "no-store") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(payload));
}

function html(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(payload);
}

function formatBytes(bytes) {
  if (!bytes) return "";
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

function publicOrigin(req) {
  const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost:7000").split(",")[0];
  return `${proto}://${host}`;
}

function configurationPage(origin, message = "", token = "") {
  const escapedMessage = message.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const escapedToken = token.replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Naruto Rebuild RD</title><style>
:root{font-family:Inter,system-ui,sans-serif;color-scheme:dark}body{margin:0;background:#111318;color:#f7f7f8;display:grid;place-items:center;min-height:100vh;padding:20px}.card{width:min(520px,100%);background:#1c1f26;border:1px solid #30343d;border-radius:18px;padding:28px;box-sizing:border-box;box-shadow:0 18px 50px #0008}h1{margin:0 0 8px;font-size:26px}p{color:#b8bec9;line-height:1.5}.note{font-size:13px}.msg{background:#47262a;color:#ffdadd;padding:12px;border-radius:10px;margin:16px 0}label{display:block;margin:22px 0 8px;font-weight:650}input{width:100%;box-sizing:border-box;padding:13px;border-radius:10px;border:1px solid #454b57;background:#101217;color:#fff;font-size:15px}button{width:100%;margin-top:16px;padding:13px;border:0;border-radius:10px;background:#7c5cff;color:white;font-size:16px;font-weight:700;cursor:pointer}.links{display:flex;gap:10px;margin-top:12px}.links a{flex:1;text-align:center;padding:11px;border:1px solid #454b57;border-radius:10px;color:#fff;text-decoration:none}.hidden{display:none}code{word-break:break-all;color:#d9d1ff}</style></head>
<body><main class="card"><h1>Naruto Rebuild RD</h1><p>Connect your own Real-Debrid account. The addon only searches files already in your personal library.</p>${escapedMessage ? `<div class="msg">${escapedMessage}</div>` : ""}
<form method="post" action="/configure"><label for="token">Real-Debrid API token</label><input id="token" name="token" type="password" value="${escapedToken}" required autocomplete="off" placeholder="Paste your token"><button type="submit">Create install link</button></form>
<p class="note">Your token is encrypted into the personalized addon URL using this deployment's secret. It is not stored in a database. Keep the generated URL private.</p><p class="note">Host: <code>${origin}</code></p></main></body></html>`;
}

async function readBody(req) {
  return await new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 20_000) reject(new Error("Request is too large"));
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export async function handler(req, res) {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    return res.end();
  }

  const origin = publicOrigin(req);
  const url = new URL(req.url || "/", origin);

  try {
    if (url.pathname === "/" || url.pathname === "/configure") {
      if (req.method === "POST") {
        const params = new URLSearchParams(await readBody(req));
        const rdToken = params.get("token")?.trim() || "";
        if (!rdToken) return html(res, 400, configurationPage(origin, "Enter a Real-Debrid token."));
        try {
          await validateToken(rdToken);
        } catch (error) {
          return html(res, 400, configurationPage(origin, `Real-Debrid rejected that token: ${error.message}`, rdToken));
        }
        const config = encryptConfig({ rdToken });
        const manifestUrl = `${origin}/${config}/manifest.json`;
        const stremioUrl = manifestUrl.replace(/^https?:\/\//, "stremio://");
        return html(res, 200, `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Install addon</title><style>:root{font-family:Inter,system-ui,sans-serif;color-scheme:dark}body{margin:0;background:#111318;color:#fff;display:grid;place-items:center;min-height:100vh;padding:20px}.card{width:min(580px,100%);background:#1c1f26;border:1px solid #30343d;border-radius:18px;padding:28px;box-sizing:border-box}p{color:#bbc1cc;line-height:1.5}a{display:block;text-align:center;padding:13px;margin-top:14px;border-radius:10px;text-decoration:none;color:#fff;background:#7c5cff;font-weight:700}.secondary{background:transparent;border:1px solid #454b57}code{display:block;background:#101217;padding:12px;border-radius:10px;word-break:break-all}</style></head><body><main class="card"><h1>Ready to install</h1><p>Your Real-Debrid token was accepted.</p><a href="${stremioUrl}">Install in Stremio</a><a class="secondary" href="${manifestUrl}">Open manifest</a><p>Personalized manifest URL:</p><code>${manifestUrl}</code><p>Keep this URL private. Anyone with it can use your Real-Debrid account through this addon.</p></main></body></html>`);
      }
      return html(res, 200, configurationPage(origin));
    }

    if (url.pathname === "/health") {
      return json(res, 200, { ok: true, addon: baseManifest.name, multiUser: true, configSecretConfigured: Boolean(process.env.CONFIG_SECRET) });
    }

    const manifestMatch = url.pathname.match(/^\/([^/]+)\/manifest\.json$/);
    if (manifestMatch) {
      const config = decryptConfig(manifestMatch[1]);
      if (!config) return json(res, 404, { error: "Invalid addon configuration" });
      return json(res, 200, baseManifest, "public, max-age=300");
    }

    const streamMatch = url.pathname.match(/^\/([^/]+)\/stream\/series\/([^/]+)\.json$/i);
    if (!streamMatch) return json(res, 404, { error: "Not found" });

    const config = decryptConfig(streamMatch[1]);
    if (!config) return json(res, 200, { streams: [] });

    const videoId = decodeURIComponent(streamMatch[2]);
    const episode = await getEpisode(videoId);
    if (!episode) return json(res, 200, { streams: [] });

    const stream = await findEpisodeStream(episode, config.rdToken);
    if (!stream) return json(res, 200, { streams: [] });

    return json(res, 200, {
      streams: [{
        name: "Real-Debrid Library",
        title: `${episode.title}\n${stream.filename}${stream.bytes ? ` • ${formatBytes(stream.bytes)}` : ""}`,
        url: stream.url,
        behaviorHints: { bingeGroup: "naruto-rebuild-rd", notWebReady: false }
      }]
    });
  } catch (error) {
    console.error(error);
    if (/\/stream\//.test(url.pathname)) return json(res, 200, { streams: [] });
    return json(res, 500, { ok: false, error: error.message });
  }
}
