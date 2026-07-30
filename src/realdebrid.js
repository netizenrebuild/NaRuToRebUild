import {
  basename,
  findMatchingFiles
} from "./matcher.js";

const API = "https://api.real-debrid.com/rest/1.0";
const indexCaches = new Map();
const pendingIndexes = new Map();

async function request(rdToken, path, options = {}, fetchImpl = fetch) {
  if (!rdToken?.trim()) throw new Error("Real-Debrid token is missing");
  const response = await fetchImpl(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${rdToken.trim()}`,
      Accept: "application/json",
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let detail = "";
    try {
      const payload = await response.json();
      detail = payload?.error || payload?.error_code || JSON.stringify(payload);
    } catch {
      detail = await response.text().catch(() => "");
    }
    throw new Error(`Real-Debrid HTTP ${response.status}${detail ? `: ${detail}` : ""}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

async function listDownloadedTorrents(rdToken, fetchImpl) {
  const torrents = [];
  const maxPages = Math.max(1, Math.min(100, Number(process.env.RD_MAX_PAGES || 25)));
  for (let page = 1; page <= maxPages; page++) {
    const batch = await request(rdToken, `/torrents?page=${page}&limit=100`, {}, fetchImpl);
    if (!Array.isArray(batch) || batch.length === 0) break;
    torrents.push(...batch.filter((torrent) => torrent.status === "downloaded"));
    if (batch.length < 100) break;
  }
  return torrents;
}

function filesWithLinks(info) {
  const selected = (info.files || []).filter((file) => file.selected === 1 || file.selected === true);
  return selected.map((file, index) => ({
    ...file,
    torrentId: info.id,
    torrentFilename: info.filename,
    restrictedLink: info.links?.[index] || null
  })).filter((file) => file.restrictedLink);
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const output = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const index = next++;
      output[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return output;
}

async function buildLibraryIndexUncached(rdToken, fetchImpl) {
  const torrents = await listDownloadedTorrents(rdToken, fetchImpl);
  const likely = torrents.filter((torrent) => /naruto|rebuild|chjk/i.test(torrent.filename || ""));
  const candidates = likely.length ? likely : torrents;
  const concurrency = Math.max(1, Math.min(10, Number(process.env.RD_CONCURRENCY || 5)));

  const groups = await mapWithConcurrency(candidates, concurrency, async (torrent) => {
    const info = await request(rdToken, `/torrents/info/${encodeURIComponent(torrent.id)}`, {}, fetchImpl);
    return filesWithLinks(info);
  });
  return groups.flat();
}

async function buildLibraryIndex(rdToken, fetchImpl) {
  const cacheKey = rdToken.trim();
  const minutes = Math.max(1, Number(process.env.CACHE_MINUTES || 10));
  const cached = indexCaches.get(cacheKey);
  if (cached && Date.now() < cached.expires) return cached.files;
  if (pendingIndexes.has(cacheKey)) return pendingIndexes.get(cacheKey);

  const pending = buildLibraryIndexUncached(rdToken, fetchImpl)
    .then((files) => {
      indexCaches.set(cacheKey, { expires: Date.now() + minutes * 60 * 1000, files });
      return files;
    })
    .finally(() => pendingIndexes.delete(cacheKey));
  pendingIndexes.set(cacheKey, pending);
  return pending;
}

export async function validateToken(rdToken, fetchImpl = fetch) {
  const user = await request(rdToken, "/user", {}, fetchImpl);
  return { username: user?.username || "Real-Debrid user" };
}

export async function findEpisodeStreams(
  episode,
  rdToken,
  fetchImpl = fetch
) {
  const files = await buildLibraryIndex(
    rdToken,
    fetchImpl
  );

  const matches = findMatchingFiles(
    files,
    episode
  ).slice(0, 10);

  const streams = [];

  for (const match of matches) {
    try {
      const body = new URLSearchParams({
        link: match.restrictedLink
      });

      const unrestricted = await request(
        rdToken,
        "/unrestrict/link",
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded"
          },
          body
        },
        fetchImpl
      );

      if (!unrestricted?.download) {
        continue;
      }

      streams.push({
        url: unrestricted.download,
        filename:
          unrestricted.filename ||
          basename(match.path),
        bytes:
          match.bytes ||
          unrestricted.filesize ||
          0,
        score: match.matchScore
      });
    } catch (error) {
      console.error(
        "Could not unrestrict matching RD file:",
        error
      );
    }
  }

  return streams;
}

export function clearLibraryCache() {
  indexCaches.clear();
  pendingIndexes.clear();
}
