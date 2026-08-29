const DEFAULT_META_URL =
  "https://rebuild-anime-stremio-debrid-theta.vercel.app/meta/series/narutorebuild.json";

let cache = {
  expires: 0,
  meta: null,
  episodes: new Map()
};

async function loadRebuildMeta(fetchImpl = fetch) {
  if (Date.now() < cache.expires && cache.meta) {
    return cache.meta;
  }

  const url = process.env.REBUILD_META_URL || DEFAULT_META_URL;
  const response = await fetchImpl(url, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(
      `Rebuild metadata returned HTTP ${response.status}`
    );
  }

  const payload = await response.json();
  const meta = payload?.meta;
  const videos = meta?.videos;

  if (!meta || !Array.isArray(videos)) {
    throw new Error(
      "Rebuild metadata did not contain meta.videos"
    );
  }

  cache = {
    expires: Date.now() + 60 * 60 * 1000,
    meta,
    episodes: new Map(
      videos.map((video) => [
        String(video.id).toUpperCase(),
        video
      ])
    )
  };

  return meta;
}

export async function getRebuildMeta(fetchImpl = fetch) {
  return await loadRebuildMeta(fetchImpl);
}

export async function getRebuildCatalog(fetchImpl = fetch) {
  const meta = await loadRebuildMeta(fetchImpl);

  // Catalog responses only need a preview of the series. The full
  // episode list is served from the meta endpoint.
  const { videos, ...preview } = meta;

  return [preview];
}

export async function getEpisode(videoId, fetchImpl = fetch) {
  if (!/^NR\d{4}[a-z]$/i.test(videoId)) return null;

  await loadRebuildMeta(fetchImpl);

  return (
    cache.episodes.get(videoId.toUpperCase()) || null
  );
}

export function clearEpisodeCache() {
  cache = {
    expires: 0,
    meta: null,
    episodes: new Map()
  };
}
