import test from "node:test";
import assert from "node:assert/strict";
import { decryptConfig, encryptConfig } from "../src/config.js";

test("configuration encrypts and decrypts", () => {
  process.env.CONFIG_SECRET = "test-secret-that-is-long-enough";
  const encrypted = encryptConfig({ rdToken: "abc123" });
  assert.notEqual(encrypted, "abc123");
  assert.deepEqual(decryptConfig(encrypted), { rdToken: "abc123" });
});

test("tampered configuration is rejected", () => {
  process.env.CONFIG_SECRET = "test-secret-that-is-long-enough";
  const encrypted = encryptConfig({ rdToken: "abc123" });
  const tampered = encrypted.slice(0, -1) + (encrypted.endsWith("A") ? "B" : "A");
  assert.equal(decryptConfig(tampered), null);
});
