import test from "node:test";
import assert from "node:assert/strict";
import { clearLibraryCache, findEpisodeStream, validateToken } from "../src/realdebrid.js";

function response(body, status = 200) {
  return new Response(body == null ? null : JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });
}

test("validates token with /user", async () => {
  const fetchImpl = async (url, options) => {
    assert.match(url, /\/user$/);
    assert.equal(options.headers.Authorization, "Bearer token");
    return response({ username: "alex" });
  };
  assert.deepEqual(await validateToken("token", fetchImpl), { username: "alex" });
});

test("finds a matching selected file and unrestricts it", async () => {
  clearLibraryCache();
  const calls = [];
  const fetchImpl = async (url, options = {}) => {
    calls.push(url);
    if (url.includes("/torrents?")) return response([{ id: "1", filename: "Naruto Rebuild", status: "downloaded" }]);
    if (url.endsWith("/torrents/info/1")) return response({
      id: "1",
      filename: "Naruto Rebuild",
      files: [{ id: 10, path: "/Naruto 4a - Squad Missions [4.3] (1080p).mkv", bytes: 1234, selected: 1 }],
      links: ["https://restricted.example/file"]
    });
    if (url.endsWith("/unrestrict/link")) {
      assert.equal(options.method, "POST");
      assert.match(String(options.body), /link=https%3A%2F%2Frestricted\.example%2Ffile/);
      return response({ download: "https://cdn.example/file.mkv", filename: "episode.mkv", filesize: 1234 });
    }
    throw new Error(`Unexpected URL ${url}`);
  };

  const result = await findEpisodeStream({ title: "Naruto 4a - Squad Missions" }, "token", fetchImpl);
  assert.equal(result.url, "https://cdn.example/file.mkv");
  assert.equal(result.filename, "episode.mkv");
  assert.equal(calls.length, 3);
});
