import { handler as appHandler } from "../src/app.js";
import { decryptConfig } from "../src/config.js";
import {
  getRebuildCatalog,
  getRebuildMeta
} from "../src/rebuild.js";

const manifest = {
  id: "com.community.narutorebuild.debrid",
  version: "2.2.0",
  name: "Naruto Rebuild Debrid Library",
  description:
    "Naruto Rebuild catalog with streams from each user's Real-Debrid or TorBox library.",
  resources: ["catalog", "meta", "stream"],
  types: ["series"],
  catalogs: [
    {
      type: "series",
      id: "narutorebuild",
      name: "Rebuild of Naruto"
    }
  ],
  idPrefixes: ["NR", "narutorebuild"],
  behaviorHints: {
    configurable: false,
    configurationRequired: false
  }
};

function sendJson(res, status, payload, cache = "public, max-age=300") {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", cache);
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  const proto = String(req.headers["x-forwarded-proto"] || "https").split(",")[0];
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0];
  const url = new URL(req.url || "/", `${proto}://${host}`);

  try {
    const manifestMatch = url.pathname.match(/^\/([^/]+)\/manifest\.json$/);

    if (manifestMatch) {
      const config = decryptConfig(manifestMatch[1]);
      if (!config) {
        return sendJson(res, 404, { error: "Invalid addon configuration" }, "no-store");
      }
      return sendJson(res, 200, manifest);
    }

    const catalogMatch = url.pathname.match(
      /^\/([^/]+)\/catalog\/series\/narutorebuild\.json$/i
    );

    if (catalogMatch) {
      const config = decryptConfig(catalogMatch[1]);
      if (!config) return sendJson(res, 200, { metas: [] }, "no-store");

      const metas = await getRebuildCatalog();
      return sendJson(res, 200, { metas }, "public, max-age=3600");
    }

    const metaMatch = url.pathname.match(
      /^\/([^/]+)\/meta\/series\/narutorebuild\.json$/i
    );

    if (metaMatch) {
      const config = decryptConfig(metaMatch[1]);
      if (!config) return sendJson(res, 200, { meta: null }, "no-store");

      const meta = await getRebuildMeta();
      return sendJson(res, 200, { meta }, "public, max-age=3600");
    }

    return appHandler(req, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, { error: error.message }, "no-store");
  }
}
