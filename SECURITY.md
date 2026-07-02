# Security Policy

## Responsible use

PentAI drives real offensive security tooling. Only scan systems you **own** or
are **explicitly authorized** to test. The built-in authorization gate (scope +
rules-of-engagement + allow-list + validity window) and the SSRF / internal-IP
guard are technical safeguards — they are **not** a substitute for written legal
authorization. You are responsible for operating within a signed engagement and
applicable law.

## Built-in safeguards

- **Authorization gate** — every scan trigger passes through a single
  chokepoint (`authorizeTarget`) that verifies the target is allow-listed, the
  scope's rules-of-engagement are active and inside their validity window, and
  that exploit-phase tooling is only used when active mode is explicitly enabled.
- **SSRF / internal-target guard** — scans against loopback, RFC1918, link-local,
  CGNAT, and cloud-metadata (169.254.169.254) addresses are refused, including
  hostnames that resolve to those ranges. Override only in a trusted lab with
  `PENTAI_ALLOW_PRIVATE_TARGETS=1`.
- **Arg/shell-injection defense** — tool arguments are passed to `execFile` as an
  array (never a shell), and hosts are validated against a strict character set.
- **Append-only audit log** — every allowed and denied scan attempt is recorded
  immutably.

## Reporting a vulnerability

Please report security issues privately via GitHub Security Advisories
("Report a vulnerability") on this repository, or by email to the address on the
maintainer's GitHub profile. Do not open a public issue for undisclosed
vulnerabilities. We aim to acknowledge reports within a few days.
