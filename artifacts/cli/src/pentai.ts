import { createInterface } from "node:readline";
import { writeFile } from "node:fs/promises";
import {
  runAssessment,
  availableTools,
  analyzeFindings,
  renderAnalysisSummary,
  aiEnabled,
  UnsafeTargetError,
  type AssessmentEvent,
  type FindingDraft,
} from "@workspace/engine";

const VERSION = "1.0.0";

// ── tiny ANSI colour helpers (no dependency) ────────────────────────────────
const useColor = process.stdout.isTTY && process.env.NO_COLOR === undefined;
const wrap = (code: string) => (s: string) => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
const c = {
  bold: wrap("1"),
  dim: wrap("2"),
  red: wrap("31"),
  green: wrap("32"),
  yellow: wrap("33"),
  blue: wrap("34"),
  magenta: wrap("35"),
  cyan: wrap("36"),
  gray: wrap("90"),
};

const SEV_ORDER = ["critical", "high", "medium", "low", "info"] as const;
const sevColor: Record<string, (s: string) => string> = {
  critical: c.red,
  high: (s) => wrap("38;5;208")(s),
  medium: c.yellow,
  low: c.blue,
  info: c.gray,
};

function banner() {
  console.log(c.magenta(c.bold("\n  ██████╗ ███████╗███╗   ██╗████████╗ █████╗ ██╗")));
  console.log(c.magenta(c.bold("  ██╔══██╗██╔════╝████╗  ██║╚══██╔══╝██╔══██╗██║")));
  console.log(c.magenta(c.bold("  ██████╔╝█████╗  ██╔██╗ ██║   ██║   ███████║██║")));
  console.log(c.magenta("  ██╔═══╝ ██╔══╝  ██║╚██╗██║   ██║   ██╔══██║██║"));
  console.log(c.magenta("  ██║     ███████╗██║ ╚████║   ██║   ██║  ██║██║"));
  console.log(c.magenta("  ╚═╝     ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝  ╚═╝╚═╝"));
  console.log(c.dim(`  Autonomous, authorization-first web pentesting · v${VERSION}\n`));
}

function help() {
  banner();
  console.log(`${c.bold("USAGE")}
  pentai scan <target> [options]
  pentai list-tools
  pentai --help | --version

${c.bold("EXAMPLES")}
  pentai scan example.com
  pentai scan https://app.example.com --json report.json --md report.md
  pentai scan example.com --tools subfinder,httpx,nuclei --yes

${c.bold("OPTIONS")}
  --tools <a,b,c>   Comma-separated toolchain (default: full non-intrusive chain)
  --active          Enable active-mode tools (off by default; use only when authorized)
  --json <file>     Write a JSON report
  --md <file>       Write a Markdown report
  --no-ai           Skip the AI analysis even if ANTHROPIC_API_KEY is set
  -y, --yes         Skip the authorization confirmation prompt
  -h, --help        Show this help
  -V, --version     Show version

${c.bold("SAFETY")}
  Only scan systems you own or are explicitly authorized to test. Loopback,
  private, and cloud-metadata addresses are refused. Set ANTHROPIC_API_KEY to
  enable AI triage & summaries.

${c.bold("EXIT CODES")}
  0 no high/critical findings · 2 high/critical found · 1 error
`);
}

// ── minimal arg parser ───────────────────────────────────────────────────────
interface Args {
  command?: string;
  target?: string;
  tools?: string[];
  active: boolean;
  json?: string;
  md?: string;
  ai: boolean;
  yes: boolean;
  help: boolean;
  version: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { active: false, ai: true, yes: false, help: false, version: false };
  const rest = [...argv];
  while (rest.length) {
    const t = rest.shift()!;
    switch (t) {
      case "-h": case "--help": a.help = true; break;
      case "-V": case "--version": a.version = true; break;
      case "-y": case "--yes": a.yes = true; break;
      case "--active": a.active = true; break;
      case "--no-ai": a.ai = false; break;
      case "--tools": a.tools = (rest.shift() ?? "").split(",").map((s) => s.trim()).filter(Boolean); break;
      case "--json": a.json = rest.shift(); break;
      case "--md": a.md = rest.shift(); break;
      default:
        if (t.startsWith("--tools=")) a.tools = t.slice(8).split(",").map((s) => s.trim()).filter(Boolean);
        else if (!a.command) a.command = t;
        else if (!a.target) a.target = t;
        break;
    }
  }
  return a;
}

function normalizeHost(raw: string): string | null {
  let v = raw.trim();
  if (!v) return null;
  if (!/^https?:\/\//i.test(v)) v = `https://${v}`;
  try {
    const host = new URL(v).hostname.replace(/^www\./, "");
    return host.includes(".") ? host : null;
  } catch {
    return null;
  }
}

async function confirm(question: string): Promise<boolean> {
  if (!process.stdin.isTTY) return false;
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise<string>((resolve) => rl.question(question, resolve));
  rl.close();
  return /^y(es)?$/i.test(answer.trim());
}

function severityCounts(findings: FindingDraft[]): Record<string, number> {
  const counts: Record<string, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  for (const f of findings) counts[f.severity] = (counts[f.severity] ?? 0) + 1;
  return counts;
}

function markdownReport(host: string, findings: FindingDraft[], aiSummary: string | null): string {
  const counts = severityCounts(findings);
  const lines = [
    `# PentAI assessment — ${host}`,
    "",
    `Generated ${new Date().toISOString()}`,
    "",
    "## Summary",
    "",
    "| Severity | Count |",
    "| --- | --- |",
    ...SEV_ORDER.map((s) => `| ${s} | ${counts[s]} |`),
    "",
  ];
  if (aiSummary) lines.push("## AI analysis", "", "```", aiSummary, "```", "");
  lines.push("## Findings", "");
  for (const f of findings) {
    lines.push(`### [${f.severity.toUpperCase()}] ${f.title}`);
    if (f.description) lines.push("", f.description);
    if (f.evidence) lines.push("", `Evidence: \`${f.evidence}\``);
    if (f.remediation) lines.push("", `Remediation: ${f.remediation}`);
    lines.push("");
  }
  return lines.join("\n");
}

async function runScan(args: Args): Promise<number> {
  const host = normalizeHost(args.target ?? "");
  if (!host) {
    console.error(c.red("✗ Invalid target. Provide a domain, e.g. `pentai scan example.com`."));
    return 1;
  }

  banner();
  console.log(`${c.bold("Target:")}  ${c.cyan(host)}`);
  console.log(`${c.bold("Tools:")}   ${(args.tools ?? ["default chain"]).join(", ")}`);
  console.log(`${c.bold("Mode:")}    ${args.active ? c.yellow("ACTIVE") : "passive (safe)"}\n`);

  console.log(c.yellow("⚠  Only scan systems you own or are explicitly authorized to test."));
  if (!args.yes) {
    const ok = await confirm(`${c.bold("Proceed?")} [y/N] `);
    if (!ok) {
      console.error(c.red("\nAborted. Re-run with --yes for non-interactive use once authorized."));
      return 1;
    }
  }
  console.log("");

  const onEvent = (e: AssessmentEvent) => {
    switch (e.type) {
      case "start": process.stdout.write(`${c.blue("▶")} ${c.bold(e.tool)} ${c.dim("running…")}\n`); break;
      case "skip": console.log(`${c.gray("∙")} ${e.tool} ${c.dim(`skipped (${e.reason})`)}`); break;
      case "error": console.log(`${c.red("✗")} ${e.tool} ${c.dim(e.message)}`); break;
      case "done": console.log(`${c.green("✓")} ${e.tool} ${c.dim(`— ${e.count} finding(s)`)}`); break;
      case "finding": {
        const sev = (sevColor[e.finding.severity] ?? c.gray)(`[${e.finding.severity}]`);
        console.log(`  ${sev} ${e.finding.title}`);
        break;
      }
    }
  };

  let findings: FindingDraft[];
  try {
    const result = await runAssessment(host, { tools: args.tools, activeMode: args.active, onEvent });
    findings = result.findings;
  } catch (err) {
    if (err instanceof UnsafeTargetError) {
      console.error(c.red(`\n✗ ${err.message}`));
      return 1;
    }
    console.error(c.red(`\n✗ Assessment failed: ${err instanceof Error ? err.message : String(err)}`));
    return 1;
  }

  const counts = severityCounts(findings);
  console.log(`\n${c.bold("═══ Summary ═══")}`);
  for (const s of SEV_ORDER) {
    const n = counts[s];
    if (n > 0) console.log(`  ${(sevColor[s] ?? c.gray)(s.padEnd(9))} ${n}`);
  }
  console.log(`  ${c.dim("total".padEnd(9))} ${findings.length}`);

  let aiSummary: string | null = null;
  if (args.ai && aiEnabled && findings.length > 0) {
    console.log(`\n${c.magenta("✦")} ${c.bold("AI analysis")} ${c.dim("(Claude)…")}`);
    const analysis = await analyzeFindings({ host, tool: "pentai", phase: "scan", findings });
    if (analysis) {
      aiSummary = renderAnalysisSummary(analysis);
      console.log(`\n${c.bold("Executive summary")}\n${analysis.executiveSummary}`);
      console.log(`\n${c.bold("Overall business risk:")} ${(sevColor[analysis.overallRisk] ?? c.gray)(analysis.overallRisk)}`);
    }
  } else if (args.ai && !aiEnabled) {
    console.log(c.dim("\n(Set ANTHROPIC_API_KEY to enable AI triage & summaries.)"));
  }

  if (args.json) {
    await writeFile(args.json, JSON.stringify({ host, generatedAt: new Date().toISOString(), findings }, null, 2));
    console.log(c.dim(`\nJSON report → ${args.json}`));
  }
  if (args.md) {
    await writeFile(args.md, markdownReport(host, findings, aiSummary));
    console.log(c.dim(`Markdown report → ${args.md}`));
  }

  console.log("");
  return counts.critical + counts.high > 0 ? 2 : 0;
}

function listTools(): number {
  banner();
  console.log(c.bold("Available tools:\n"));
  for (const t of availableTools()) {
    const mode = t.requiresActiveMode ? c.yellow("active-only") : c.green("passive");
    const dep = t.requiresDocker ? c.dim("needs Docker") : c.green("no Docker");
    console.log(`  ${c.cyan(t.name.padEnd(12))} ${c.dim(t.phase.padEnd(8))} ${mode.padEnd(20)} ${dep}`);
  }
  console.log(c.dim("\n  dns, headers, tls run anywhere. The rest run in Docker containers."));
  console.log("");
  return 0;
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  if (args.version) { console.log(VERSION); return 0; }
  if (args.help || !args.command) { help(); return args.command ? 0 : 1; }

  switch (args.command) {
    case "scan": return runScan(args);
    case "list-tools": return listTools();
    default:
      console.error(c.red(`Unknown command: ${args.command}`));
      help();
      return 1;
  }
}

main().then((code) => process.exit(code)).catch((err) => {
  console.error(err);
  process.exit(1);
});
