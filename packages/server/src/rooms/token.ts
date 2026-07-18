import { randomBytes } from "node:crypto";

export const roomTokenPattern =
  /^(?![0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$)[A-Za-z0-9_-]{22,}$/;

export function mintRoomToken(): string {
  return randomBytes(18).toString("base64url");
}
