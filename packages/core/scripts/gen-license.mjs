import { createPrivateKey, sign } from "node:crypto";
import { readFileSync } from "node:fs";

const arg = (name) => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : undefined;
};

const email = arg("email");
if (!email) {
  process.stderr.write("Usage: node gen-license.mjs --email=x@y.com [--name=\"Full Name\"] [--expires=2027-01-01]\n");
  process.exit(1);
}

const keyPath = process.env.TERMCODER_LICENSE_KEY_PATH ?? "pro-private.pem";
const privateKey = createPrivateKey(readFileSync(keyPath, "utf8"));

const payload = { email, tier: "pro", issued: Date.now() };
const name = arg("name");
if (name) payload.name = name;
const expires = arg("expires");
if (expires) {
  const t = Date.parse(expires);
  if (Number.isNaN(t)) {
    process.stderr.write(`Bad --expires date: ${expires}\n`);
    process.exit(1);
  }
  payload.expires = t;
}

const b64url = (buf) => Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const payloadBytes = Buffer.from(JSON.stringify(payload), "utf8");
const signature = sign(null, payloadBytes, privateKey);
const key = `${b64url(payloadBytes)}.${b64url(signature)}`;

process.stdout.write(`termcoder Pro license for ${email}:\n\n${key}\n`);
