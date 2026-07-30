const VIDEO_EXTENSIONS = new Set(["mkv", "mp4", "avi", "mov", "m4v", "webm", "ts"]);

export function basename(path = "") {
  return path.replaceAll("\\", "/").split("/").pop() || path;
}

export function withoutExtension(value = "") {
  return value.replace(/\.[a-z0-9]{2,5}$/i, "");
}

export function normalize(value = "") {
  return withoutExtension(basename(value))
    .normalize("NFKD")
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isVideo(path = "") {
  const match = path.match(/\.([a-z0-9]+)$/i);
  return Boolean(match && VIDEO_EXTENSIONS.has(match[1].toLowerCase()));
}

function titlePrefix(title = "") {
  return title.split(/\s+-\s+/, 1)[0]?.trim() || title;
}

export function scoreFilename(filename, episode) {
  if (!episode?.title) return 0;

  const file = normalize(filename);
  const fullTitle = normalize(episode.title);
  const prefix = normalize(titlePrefix(episode.title));
  if (!file || !fullTitle || !prefix) return 0;

  let score = 0;
  if (file === fullTitle) score = 100;
  else if (file.startsWith(fullTitle + " ") || file.includes(fullTitle)) score = 95;
  else if (file.startsWith(prefix + " ") || file === prefix) score = 80;

  // A title-word overlap helps when punctuation or release tags differ.
  const importantWords = fullTitle.split(" ").filter((word) => word.length >= 4);
  const overlap = importantWords.filter((word) => file.includes(word)).length;
  score += Math.min(overlap * 2, 10);

  // Avoid picking a neighboring edit such as Naruto 5b for Naruto 5a.
  const expectedCode = prefix.match(/\b(\d+[a-z])$/i)?.[1];
  if (expectedCode && !new RegExp(`\\b${expectedCode}\\b`, "i").test(file)) {
    score -= 60;
  }

  return Math.max(score, 0);
}

export function findBestFile(files, episode) {
  return files
    .filter((entry) => isVideo(entry.path || entry.filename || ""))
    .map((entry) => ({ ...entry, matchScore: scoreFilename(entry.path || entry.filename, episode) }))
    .filter((entry) => entry.matchScore >= 70)
    .sort((a, b) => b.matchScore - a.matchScore || (b.bytes || 0) - (a.bytes || 0))[0] || null;
}
