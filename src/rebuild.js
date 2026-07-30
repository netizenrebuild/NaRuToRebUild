const DEFAULT_META_URL =
  "https://rebuild-anime-stremio-debrid-theta.vercel.app/meta/series/narutorebuild.json";

let cache = { expires: 0, episodes: new Map() };

export async function getEpisode(videoId, fetchImpl = fetch) {
  if (!/^NR\d{4}[a-z]$/i.test(videoId)) return null;

  if (Date.now() >= cache.expires) {
    const url = process.env.REBUILD_META_URL || DEFAULT_META_URL;
    const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`Rebuild metadata returned HTTP ${response.status}`);

    const payload = await response.json();
    const videos = payload?.meta?.videos;
    if (!Array.isArray(videos)) throw new Error("Rebuild metadata did not contain meta.videos");

    cache = {
      expires: Date.now() + 60 * 60 * 1000,
      episodes: new Map(videos.map((video) => [String(video.id).toUpperCase(), video]))
    };
  }

  return cache.episodes.get(videoId.toUpperCase()) || null;
}

export function clearEpisodeCache() {
  cache = { expires: 0, episodes: new Map() };
}
