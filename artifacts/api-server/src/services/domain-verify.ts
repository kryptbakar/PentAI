import { randomUUID } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

/**
 * Domain-ownership verification via a DNS TXT record.
 *
 * Turns the authorization allow-list from "trust me" into a proof: the operator
 * must publish `pentai-verify=<token>` as a TXT record on the target domain
 * before it can be treated as verified. Pure helpers are separated from the DNS
 * lookup so they can be unit-tested.
 */

const PREFIX = "pentai-verify=";

export function newVerificationToken(): string {
  return randomUUID().replace(/-/g, "");
}

/** The exact TXT record value the domain owner must publish. */
export function expectedTxtValue(token: string): string {
  return `${PREFIX}${token}`;
}

/** True if any resolved TXT record contains the expected proof value. */
export function txtRecordsContain(records: string[][], token: string): boolean {
  const expected = expectedTxtValue(token);
  return records.some((chunks) => chunks.join("").trim() === expected);
}

/** Performs the live DNS lookup and checks for the proof. Returns false on any DNS error. */
export async function checkDomainOwnership(host: string, token: string): Promise<boolean> {
  try {
    const records = await resolveTxt(host);
    return txtRecordsContain(records, token);
  } catch {
    return false;
  }
}
