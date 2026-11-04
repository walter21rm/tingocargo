/**
 * Cifrado en reposo de datos sensibles (teléfono, documento, dirección).
 * AES-256-GCM. Los valores ya cifrados y el texto legado se pueden leer.
 */
import crypto from "crypto";

const PREFIX = "enc:v1:";
let cachedKey;

const getKey = () => {
  if (cachedKey) return cachedKey;
  const secret =
    process.env.DATA_ENCRYPTION_KEY || "tingocargo-field-key-v1";
  cachedKey = crypto.scryptSync(secret, "tingocargo-field-salt", 32);
  return cachedKey;
};

export const encryptField = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (!text || text.startsWith(PREFIX)) return text;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(text, "utf8"),
    cipher.final()
  ]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, encrypted]).toString("base64");
};

export const decryptField = (value) => {
  if (value === null || value === undefined) return value;
  const text = String(value);
  if (!text.startsWith(PREFIX)) return text;
  try {
    const buf = Buffer.from(text.slice(PREFIX.length), "base64");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", getKey(), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString(
      "utf8"
    );
  } catch {
    return text;
  }
};
