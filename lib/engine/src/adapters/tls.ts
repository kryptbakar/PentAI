import tls from "node:tls";
import { assertSafeHost } from "../dispatcher";
import { assertPublicHost } from "../net-guard";
import type { ToolAdapter, FindingDraft, ScanTarget } from "./types";

/**
 * TLS / certificate analyzer. Pure Node — no Docker required. Connects to
 * :443, inspects the negotiated protocol and the leaf certificate, and flags
 * expired/expiring certs, hostname mismatches, and weak/legacy TLS versions.
 */

interface TlsInfo {
  protocol: string | null;
  cert: tls.PeerCertificate;
  authorized: boolean;
  authorizationError?: string;
}

function connect(host: string, timeoutMs: number): Promise<TlsInfo> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      { host, port: 443, servername: host, timeout: timeoutMs, rejectUnauthorized: false },
      () => {
        const info: TlsInfo = {
          protocol: socket.getProtocol(),
          cert: socket.getPeerCertificate(),
          authorized: socket.authorized,
          authorizationError: socket.authorizationError ? String(socket.authorizationError) : undefined,
        };
        socket.end();
        resolve(info);
      },
    );
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
    socket.on("error", (err) => reject(err));
  });
}

const WEAK_PROTOCOLS = new Set(["TLSv1", "TLSv1.1", "SSLv3", "SSLv2"]);

export const tlsAdapter: ToolAdapter = {
  name: "tls",
  phase: "scan",
  requiresActiveMode: false,
  requiresDocker: false,

  async run(target: ScanTarget): Promise<FindingDraft[]> {
    const host = assertSafeHost(target.host);
    await assertPublicHost(host);

    let info: TlsInfo;
    try {
      info = await connect(host, 12_000);
    } catch (err) {
      return [
        {
          tool: "tls",
          severity: "medium",
          title: `Could not establish TLS on ${host}:443`,
          description: `TLS handshake failed: ${err instanceof Error ? err.message : String(err)}. The host may not serve HTTPS.`,
          evidence: `${host}:443`,
          cveRefs: [],
          remediation: "Ensure the service serves HTTPS on port 443 with a valid certificate.",
          raw: null,
        },
      ];
    }

    const findings: FindingDraft[] = [];
    const { cert, protocol } = info;

    if (protocol && WEAK_PROTOCOLS.has(protocol)) {
      findings.push({
        tool: "tls",
        severity: "medium",
        title: `Legacy TLS protocol negotiated: ${protocol}`,
        description: `The server negotiated ${protocol}, which is deprecated and vulnerable to known downgrade/crypto attacks.`,
        evidence: `Protocol: ${protocol}`,
        cveRefs: [],
        remediation: "Disable TLS 1.1 and below; require TLS 1.2+ (preferably 1.3).",
        raw: null,
      });
    }

    if (cert && cert.valid_to) {
      const expiry = new Date(cert.valid_to).getTime();
      const daysLeft = Math.floor((expiry - Date.now()) / 86_400_000);
      if (daysLeft < 0) {
        findings.push({
          tool: "tls",
          severity: "critical",
          title: `Certificate for ${host} is expired`,
          description: `The certificate expired ${Math.abs(daysLeft)} day(s) ago (valid_to ${cert.valid_to}). Clients will show security warnings.`,
          evidence: `valid_to=${cert.valid_to}`,
          cveRefs: [],
          remediation: "Renew and deploy a valid certificate immediately.",
          raw: null,
        });
      } else if (daysLeft <= 15) {
        findings.push({
          tool: "tls",
          severity: "high",
          title: `Certificate for ${host} expires in ${daysLeft} day(s)`,
          description: `The certificate expires on ${cert.valid_to}. Renew before it lapses to avoid an outage.`,
          evidence: `valid_to=${cert.valid_to}`,
          cveRefs: [],
          remediation: "Renew the certificate and automate renewal (e.g. ACME/Let's Encrypt).",
          raw: null,
        });
      }
    }

    if (!info.authorized) {
      findings.push({
        tool: "tls",
        severity: "medium",
        title: `Certificate chain not trusted for ${host}`,
        description: `The presented certificate did not validate against the system trust store${info.authorizationError ? ` (${info.authorizationError})` : ""}. This can indicate a self-signed cert, a missing intermediate, or a hostname mismatch.`,
        evidence: info.authorizationError ?? "untrusted chain",
        cveRefs: [],
        remediation: "Serve a certificate from a trusted CA with the full chain and a matching hostname.",
        raw: null,
      });
    }

    findings.push({
      tool: "tls",
      severity: "info",
      title: `TLS certificate for ${host}`,
      description: `Protocol ${protocol ?? "unknown"}; issued by ${cert?.issuer?.O ?? cert?.issuer?.CN ?? "unknown"}; valid ${cert?.valid_from ?? "?"} → ${cert?.valid_to ?? "?"}.`,
      evidence: `subject=${cert?.subject?.CN ?? host}`,
      cveRefs: [],
      remediation: null,
      raw: null,
    });

    return findings;
  },
};
