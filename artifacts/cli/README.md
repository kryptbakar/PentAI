# pentai — CLI

Autonomous, authorization-first web penetration testing from your terminal.

`pentai` runs the same scanning engine as the PentAI dashboard (`lib/engine`),
but standalone — no database, no server. It provisions nothing and stores
nothing; it runs a toolchain against a host and prints (and optionally writes)
the findings.

## Requirements

- **Node.js ≥ 20** — that's it to get started. The `dns`, `headers`, and `tls`
  checks run in-process and produce real findings with **no Docker**.
- **Docker** (optional) — unlocks the container-based tools (`subfinder`,
  `httpx`, `nmap`, `nuclei`). If Docker isn't available they're skipped
  gracefully with a clear message; the pure-Node tools still run.
- **`ANTHROPIC_API_KEY`** (optional) — enables AI triage and summaries.

## Install

From the monorepo:

```bash
pnpm install
pnpm --filter pentai build
npm link ./artifacts/cli     # exposes `pentai` on your PATH
```

Or run the bundle directly without linking:

```bash
alias pentai="node $PWD/artifacts/cli/dist/pentai.mjs"
```

Once published, `npm install -g pentai` / `npx pentai` will work too.

## Usage

```
pentai scan <target> [options]
pentai list-tools
pentai --help | --version
```

### Options

| Option | Description |
| --- | --- |
| `--tools <a,b,c>` | Comma-separated toolchain (default: `dns,headers,tls,subfinder,httpx,nmap,nuclei`) |
| `--active` | Enable active-mode tools (off by default) |
| `--json <file>` | Write a JSON report |
| `--md <file>` | Write a Markdown report |
| `--no-ai` | Skip AI analysis even if `ANTHROPIC_API_KEY` is set |
| `-y, --yes` | Skip the authorization confirmation (for CI) |
| `-h, --help` | Show help |
| `-V, --version` | Show version |

### Examples

```bash
pentai scan example.com
pentai scan https://app.example.com --json report.json --md report.md
pentai scan example.com --tools subfinder,httpx --yes
```

### Tools

| Tool | Needs Docker | What it checks |
| --- | --- | --- |
| `dns` | no | A records, missing SPF / DMARC / CAA (email-spoofing & cert issuance) |
| `headers` | no | HSTS, CSP, X-Frame-Options, cookie flags, … |
| `tls` | no | Certificate expiry, trust chain, legacy TLS versions |
| `subfinder` | yes | Passive subdomain enumeration |
| `httpx` | yes | HTTP probing & fingerprinting |
| `nmap` | yes | Port & service discovery |
| `nuclei` | yes | CVE / template-based vulnerability scan |

`pentai list-tools` prints this at runtime.

### Exit codes

`0` — no high/critical findings · `2` — high/critical found · `1` — error.

Useful in CI: fail the pipeline when new high/critical issues appear.

```yaml
- run: pentai scan "$TARGET" --yes    # non-zero exit fails the job
```

## Safety

Only scan systems you **own** or are **explicitly authorized** to test. `pentai`
refuses loopback, RFC1918, link-local, and cloud-metadata (169.254.169.254)
targets, and prompts for confirmation before scanning. These are technical
safeguards, not legal authorization.

## License

MIT
