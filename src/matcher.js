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
  const season = Number(episode?.season);
  const number = Number(
    episode?.episode ?? episode?.episodeNumber
  );

  if (
    !Number.isFinite(season) ||
    !Number.isFinite(number)
  ) {
    return null;
  }

  return `s${paddedNumber(season)}e${paddedNumber(number)}`;
}

function expectedEditCode(episode) {
  /*
   * Example title:
   * Naruto 1a - Academy Days
   *
   * Returns:
   * 1a
   */
  const prefix = normalize(titlePrefix(episode?.title || ""));
  return prefix.match(/\b(\d+[a-z])$/i)?.[1] || null;
}

function descriptiveTitle(episode) {
  const parts = String(episode?.title || "")
    .split(/\s+-\s+/);

  return normalize(parts.slice(1).join(" - "));
}

function compact(value = "") {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function containsEpisodeCode(filename, code) {
  return Boolean(
    code &&
    compact(filename).includes(compact(code))
  );
}

function containsEditCode(filename, editCode) {
  if (!editCode) return false;

  const file = normalize(filename);

  return new RegExp(
    `(?:^|\\s)${editCode}(?:\\s|$)`,
    "i"
  ).test(file);
}

export function scoreFilename(filename, episode) {
  if (!episode?.title) return 0;

  const file = normalize(filename);
  const fullTitle = normalize(episode.title);
  const prefix = normalize(titlePrefix(episode.title));

  if (!file || !fullTitle || !prefix) return 0;

  const code = episodeCode(episode);
  const editCode = expectedEditCode(episode);
  const description = descriptiveTitle(episode);

  const hasSeasonEpisode =
    containsEpisodeCode(filename, code);

  const hasCorrectEditCode =
    containsEditCode(filename, editCode);

  const hasDescription =
    description.length >= 4 &&
    file.includes(description);

  const explicitlySaysRebuild =
    file.includes("rebuild of naruto") ||
    file.includes("naruto rebuild");

  /*
   * Reject ordinary Naruto season files.
   *
   * A file using S01E01 must also have at least one strong
   * Rebuild identifier:
   *
   * - the correct edit code, such as 1a
   * - "Rebuild of Naruto"
   */
  if (
    hasSeasonEpisode &&
    !hasCorrectEditCode &&
    !explicitlySaysRebuild
  ) {
    return 0;
  }

  /*
   * Reject another Rebuild edit with the same title or
   * season number, such as 1b when 1a is expected.
   */
  const anyEditCode =
    file.match(/\b\d{1,2}[a-z]\b/i)?.[0] || null;

  if (
    editCode &&
    anyEditCode &&
    anyEditCode !== editCode
  ) {
    return 0;
  }

  let score = 0;

  /*
   * Supported examples:
   *
   * Rebuild of Naruto - S01E01 - Academy Days
   * Naruto - S01E01 (1a) - Academy Days
   * Naruto 1A S01E01 - Academy Days
   */
  if (
    hasSeasonEpisode &&
    hasCorrectEditCode &&
    hasDescription
  ) {
    score = 130;
  } else if (
    hasSeasonEpisode &&
    explicitlySaysRebuild &&
    hasDescription
  ) {
    score = 125;
  } else if (
    hasSeasonEpisode &&
    hasCorrectEditCode
  ) {
    score = 120;
  } else if (
    hasSeasonEpisode &&
    explicitlySaysRebuild
  ) {
    score = 115;
  }

  /*
   * Original title-based matching.
   */
  if (file === fullTitle) {
    score = Math.max(score, 110);
  } else if (
    file.startsWith(fullTitle + " ") ||
    file.includes(fullTitle)
  ) {
    score = Math.max(score, 105);
  } else if (
    file.startsWith(prefix + " ") ||
    file === prefix
  ) {
    score = Math.max(score, 90);
  }

  if (hasDescription) {
    score += 15;
  }

  const importantWords = fullTitle
    .split(" ")
    .filter((word) => word.length >= 4);

  const overlap = importantWords.filter((word) =>
    file.includes(word)
  ).length;

  score += Math.min(overlap * 2, 10);

  return Math.max(score, 0);
}

export function findMatchingFiles(files, episode) {
  return files
    .filter((entry) =>
      isVideo(entry.path || entry.filename || "")
    )
    .map((entry) => ({
      ...entry,
      matchScore: scoreFilename(
        entry.path || entry.filename || "",
        episode
      )
    }))
    .filter((entry) => entry.matchScore >= 70)
    .sort(
      (a, b) =>
        b.matchScore - a.matchScore ||
        (b.bytes || 0) - (a.bytes || 0)
    );
}

/*
 * Kept for compatibility with any old code still using it.
 */
export function findBestFile(files, episode) {
  return findMatchingFiles(files, episode)[0] || null;
}
