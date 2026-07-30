const VIDEO_EXTENSIONS = new Set([
  "mkv",
  "mp4",
  "avi",
  "mov",
  "m4v",
  "webm",
  "ts"
]);

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

  return Boolean(
    match &&
    VIDEO_EXTENSIONS.has(match[1].toLowerCase())
  );
}

function titlePrefix(title = "") {
  return title.split(/\s+-\s+/, 1)[0]?.trim() || title;
}

function paddedNumber(value) {
  return String(Number(value)).padStart(2, "0");
}

function episodeCode(episode) {
  /*
   * Rebuild metadata normally includes season and episode.
   * Example:
   * season: 1
   * episode: 2
   * becomes S01E02.
   */
  if (
    Number.isFinite(Number(episode?.season)) &&
    Number.isFinite(Number(episode?.episode))
  ) {
    return `s${paddedNumber(episode.season)}e${paddedNumber(
      episode.episode
    )}`;
  }

  /*
   * Some Stremio metadata uses episodeNumber instead.
   */
  if (
    Number.isFinite(Number(episode?.season)) &&
    Number.isFinite(Number(episode?.episodeNumber))
  ) {
    return `s${paddedNumber(episode.season)}e${paddedNumber(
      episode.episodeNumber
    )}`;
  }

  return null;
}

function containsEpisodeCode(filename, code) {
  if (!code) return false;

  const compactFilename = filename
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

  return compactFilename.includes(code);
}

export function scoreFilename(filename, episode) {
  if (!episode?.title) return 0;

  const file = normalize(filename);
  const fullTitle = normalize(episode.title);
  const prefix = normalize(titlePrefix(episode.title));

  if (!file || !fullTitle || !prefix) return 0;

  let score = 0;

  /*
   * Strongest match: TorBox-style S01E01 numbering.
   */
  const code = episodeCode(episode);

  if (containsEpisodeCode(filename, code)) {
    score += 100;
  }

  /*
   * Original Real-Debrid title matching.
   */
  if (file === fullTitle) {
    score = Math.max(score, 100);
  } else if (
    file.startsWith(fullTitle + " ") ||
    file.includes(fullTitle)
  ) {
    score = Math.max(score, 95);
  } else if (
    file.startsWith(prefix + " ") ||
    file === prefix
  ) {
    score = Math.max(score, 80);
  }

  /*
   * Match the descriptive episode title.
   * For example:
   * "Naruto 1a - Academy Days"
   * can match:
   * "Rebuild of Naruto - S01E01 - Academy Days"
   */
  const titleParts = episode.title.split(/\s+-\s+/);
  const descriptiveTitle = normalize(
    titleParts.slice(1).join(" - ")
  );

  if (
    descriptiveTitle &&
    descriptiveTitle.length >= 4 &&
    file.includes(descriptiveTitle)
  ) {
    score += 25;
  }

  /*
   * General word overlap.
   */
  const importantWords = fullTitle
    .split(" ")
    .filter((word) => word.length >= 4);

  const overlap = importantWords.filter((word) =>
    file.includes(word)
  ).length;

  score += Math.min(overlap * 2, 10);

  /*
   * Avoid matching Naruto 5b when 5a is expected.
   * Only apply this penalty when the filename itself uses
   * the old lettered naming format. Do not penalize S01E01
   * style filenames.
   */
  const expectedLetterCode =
    prefix.match(/\b(\d+[a-z])$/i)?.[1];

  const filenameHasLetterCode =
    /\b\d+[a-z]\b/i.test(file);

  if (
    expectedLetterCode &&
    filenameHasLetterCode &&
    !new RegExp(
      `\\b${expectedLetterCode}\\b`,
      "i"
    ).test(file)
  ) {
    score -= 60;
  }

  return Math.max(score, 0);
}

export function findBestFile(files, episode) {
  return (
    files
      .filter((entry) =>
        isVideo(entry.path || entry.filename || "")
      )
      .map((entry) => ({
        ...entry,
        matchScore: scoreFilename(
          entry.path || entry.filename,
          episode
        )
      }))
      .filter((entry) => entry.matchScore >= 70)
      .sort(
        (a, b) =>
          b.matchScore - a.matchScore ||
          (b.bytes || 0) - (a.bytes || 0)
      )[0] || null
  );
}
