import { randomBytes } from "crypto";

export function newId(prefix: string = ""): string {
  const hex = randomBytes(8).toString("hex");
  return prefix ? `${prefix}_${hex}` : hex;
}
