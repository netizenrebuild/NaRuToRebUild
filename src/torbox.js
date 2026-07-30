import { basename, findBestFile } from "./matcher.js";

const API = "https://api.torbox.app/v1/api";
const cache = new Map();

async function request(token, path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Authorization: `Bearer ${token.trim()}`,
      Accept: "application/json"
    }
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || payload?.success === false) {
    throw new Error(
      payload?.detail ||
      payload?.message ||
      `TorBox HTTP ${response.status}`
    );
  }

  return payload?.data ?? payload;
}

export async function validateTorBoxToken(token) {
  if (!token?.trim()) {
    throw new Error("TorBox API token is missing");
  }

  await request(token, "/torrents/mylist?limit=1");
  return true;
}

async function getLibrary(token) {
  const key = token.trim();
  const existing = cache.get(key);

  if (existing && Date.now() < existing.expires) {
    return existing.files;
  }

  const data = await request(
    token,
    "/torrents/mylist?limit=1000"
  );

  const torrents = Array.isArray(data) ? data : [];

  const files = torrents.flatMap((torrent) => {
    if (!Array.isArray(torrent.files)) return [];

    return torrent.files.map((file, index) => ({
      path:
        file.name ||
        file.short_name ||
        file.path ||
        file.filename ||
        "",
      bytes: Number(file.size || file.bytes || 0),
      torrentId: torrent.id,
      fileId: file.id ?? file.file_id ?? index
    }));
  });

  cache.set(key, {
    expires: Date.now() + 10 * 60 * 1000,
    files
  });

  return files;
}

export async function findTorBoxEpisodeStream(
  episode,
  token
) {
  const files = await getLibrary(token);
  const match = findBestFile(files, episode);

  if (!match) return null;

  const params = new URLSearchParams({
    token: token.trim(),
    torrent_id: String(match.torrentId),
    file_id: String(match.fileId),
    redirect: "true",
    append_name: "true"
  });

  return {
    url: `${API}/torrents/requestdl?${params}`,
    filename: basename(match.path),
    bytes: match.bytes || 0
  };
}
