import test from "node:test";
import assert from "node:assert/strict";
import { findBestFile, scoreFilename } from "../src/matcher.js";

test("matches screenshot-style release filename", () => {
  const episode = { id: "NR0104a", title: "Naruto 4a - Squad Missions" };
  const filename = "Naruto 4a - Squad Missions [4.3] (1080p).mkv";
  assert.ok(scoreFilename(filename, episode) >= 90);
});

test("does not confuse neighboring lettered edits", () => {
  const episode = { id: "NR0105a", title: "Naruto 5a - Entrance Exam" };
  const files = [
    { path: "Naruto 5b - Forest of Death [4.3] (1080p).mkv", bytes: 12 },
    { path: "Naruto 5a - Entrance Exam [4.3] (1080p).mkv", bytes: 10 }
  ];
  assert.equal(findBestFile(files, episode).path, files[1].path);
});

test("ignores non-video files", () => {
  const episode = { title: "Naruto 4a - Squad Missions" };
  assert.equal(findBestFile([{ path: "Naruto 4a - Squad Missions.txt" }], episode), null);
});
