# pentai — CLI

Autonomous, authorization-first web penetration testing from your terminal.

`pentai` runs the same scanning engine as the PentAI dashboard (`lib/engine`),
but standalone — no database, no server. It provisions nothing and stores
nothing; it runs a toolchain against a host and prints (and optionally writes)
the findings.

## Requirements

- **Node.js ≥ 20**
- **Docker** running locally — the recon/scan adapters (`nmap`, `subfinder`,
  `httpx`, `nuclei`) each run in a throwaway container and pull their image on
  first use. The `headers` adapter runs in-process and needs no Docker.
- Optional: `ANTHROPIC_API_KEY` to enable AI triage and summaries.

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
| `--tools <a,b,c>` | Comma-separated toolchain (default: `subfinder,httpx,nmap,headers,nuclei`) |
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
