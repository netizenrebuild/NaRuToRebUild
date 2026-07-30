import crypto from "node:crypto";

function secret() {
  const value = process.env.CONFIG_SECRET?.trim();

  if (!value) {
    throw new Error("CONFIG_SECRET is not configured");
  }

  return crypto
    .createHash("sha256")
    .update(value)
    .digest();
}

export function encryptConfig(config) {
  const iv = crypto.randomBytes(12);

  const cipher = crypto.createCipheriv(
    "aes-256-gcm",
    secret(),
    iv
  );

  const plaintext = Buffer.from(
    JSON.stringify(config),
    "utf8"
  );

  const encrypted = Buffer.concat([
    cipher.update(plaintext),
    cipher.final()
  ]);

  const tag = cipher.getAuthTag();

  return Buffer.concat([
    iv,
    tag,
    encrypted
  ]).toString("base64url");
}

export function decryptConfig(value) {
  try {
    const data = Buffer.from(value, "base64url");

    if (data.length < 29) return null;

    const iv = data.subarray(0, 12);
    const tag = data.subarray(12, 28);
    const encrypted = data.subarray(28);

    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      secret(),
      iv
    );

    decipher.setAuthTag(tag);

    const plaintext = Buffer.concat([
      decipher.update(encrypted),
      decipher.final()
    ]);

    const parsed = JSON.parse(
      plaintext.toString("utf8")
    );

    // Keeps old Real-Debrid install URLs working.
    if (typeof parsed?.rdToken === "string") {
      return {
        provider: "realdebrid",
        token: parsed.rdToken.trim()
      };
    }

    if (
      !["realdebrid", "torbox"].includes(parsed?.provider) ||
      typeof parsed?.token !== "string" ||
      !parsed.token.trim()
    ) {
      return null;
    }

    return {
      provider: parsed.provider,
      token: parsed.token.trim()
    };
  } catch {
    return null;
  }
}
