import { generateKeyPairSync } from "node:crypto";
import { writeFileSync } from "node:fs";

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const privPem = privateKey.export({ type: "pkcs8", format: "pem" });
const pubPem = publicKey.export({ type: "spki", format: "pem" });

writeFileSync("pro-private.pem", privPem, "utf8");

process.stdout.write("Wrote pro-private.pem (KEEP THIS SECRET, never commit it).\n\n");
process.stdout.write("Paste this public key into PRO_PUBLIC_KEY in packages/core/src/license/license.ts:\n\n");
process.stdout.write(pubPem + "\n");
