import { Resolver } from "node:dns/promises";
import { assertSafeHost } from "../dispatcher";
import { assertPublicHost } from "../net-guard";
import type { ToolAdapter, FindingDraft, ScanTarget } from "./types";

/**
 * DNS / email-security analyzer. Pure Node — no Docker required. Resolves core
 * records and flags missing email-spoofing protections (SPF, DMARC) and missing
 * CAA. These are common, real findings that need no active probing.
 */

async function safeResolve<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn();
  } catch {
    return null;
  }
}

function flatten(records: string[][] | null): string[] {
  return (records ?? []).map((chunks) => chunks.join(""));
}

export const dnsAdapter: ToolAdapter = {
  name: "dns",
  phase: "recon",
  requiresActiveMode: false,
  requiresDocker: false,

  async run(target: ScanTarget): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);
    await assertPublicHost(host);

    const resolver = new Resolver({ timeout: 5000, tries: 2 });
    const findings: FindingDraft[] = [];

    const a = await safeResolve(() => resolver.resolve4(host));
    const mx = await safeResolve(() => resolver.resolveMx(host));
    const txt = flatten(await safeResolve(() => resolver.resolveTxt(host)));
    const dmarc = flatten(await safeResolve(() => resolver.resolveTxt(`_dmarc.${host}`)));
    const caa = await safeResolve(() => resolver.resolveCaa(host));

    if (a && a.length > 0) {
      findings.push({
        tool: "dns",
        severity: "info",
        title: `A records for ${host}`,
        description: `Resolves to: ${a.join(", ")}`,
        evidence: a.join(", "),
        cveRefs: [],
        remediation: null,
        raw: null,
      });
    }

    // SPF — only meaningful if the domain sends/handles mail (has MX), but a
    // missing SPF anywhere still enables spoofing, so we flag it generally.
    const hasSpf = txt.some((r) => /^v=spf1/i.test(r));
    if (!hasSpf) {
      findings.push({
        tool: "dns",
        severity: "medium",
        title: `Missing SPF record on ${host}`,
        description: "No `v=spf1` TXT record was found. Without SPF, attackers can more easily spoof email from this domain.",
        evidence: mx && mx.length > 0 ? `MX present: ${mx.map((m) => m.exchange).join(", ")}` : "no SPF TXT record",
        cveRefs: [],
        remediation: "Publish an SPF record, e.g. `v=spf1 include:_spf.yourprovider.com -all`.",
        raw: null,
      });
    }

    const hasDmarc = dmarc.some((r) => /^v=DMARC1/i.test(r));
    if (!hasDmarc) {
      findings.push({
        tool: "dns",
        severity: "medium",
        title: `Missing DMARC record on ${host}`,
        description: "No `_dmarc` TXT record with `v=DMARC1` was found. DMARC lets you enforce and monitor SPF/DKIM alignment against spoofing.",
        evidence: "_dmarc TXT absent",
        cveRefs: [],
        remediation: "Publish a DMARC record at `_dmarc.<domain>`, starting with `v=DMARC1; p=none; rua=mailto:...` and tightening to `p=reject`.",
        raw: null,
      });
    }

    if (!caa || caa.length === 0) {
      findings.push({
        tool: "dns",
        severity: "low",
        title: `No CAA record on ${host}`,
        description: "No Certification Authority Authorization (CAA) record was found. CAA restricts which CAs may issue certificates for the domain.",
        evidence: "CAA absent",
        cveRefs: [],
        remediation: "Publish a CAA record, e.g. `0 issue \"letsencrypt.org\"`.",
        raw: null,
      });
    }

    return findings;
  },
};
