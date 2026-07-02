import Anthropic from "@anthropic-ai/sdk";

// The engine has no logging framework of its own; keep it dependency-free.
const logger = {
  warn: (...args: unknown[]) => console.warn("[pentai:ai]", ...args),
  error: (...args: unknown[]) => console.error("[pentai:ai]", ...args),
};

/**
 * AI analysis layer.
 *
 * Turns raw tool findings into an analyst-grade report: an executive summary,
 * a business-risk ranking that goes beyond the raw scanner severity, cross-tool
 * deduplication, and concrete remediation. Powered by Claude.
 *
 * Fully optional: when ANTHROPIC_API_KEY is unset the whole layer is a no-op and
 * callers fall back to the deterministic summary. Nothing here ever throws into
 * the request path — every entry point resolves to `null` on failure.
 */

const MODEL = "claude-opus-4-8";

export const aiEnabled = Boolean(process.env.ANTHROPIC_API_KEY);

let client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!client) client = new Anthropic();
  return client;
}

export type BusinessRisk = "critical" | "high" | "medium" | "low" | "info";

export interface FindingInput {
  tool: string;
  severity: string;
  title: string;
  description?: string | null;
  evidence?: string | null;
  cveRefs?: string[] | null;
}

export interface TriagedFinding {
  title: string;
  toolSeverity: string;
  businessRisk: BusinessRisk;
  rationale: string;
  remediation: string;
  mergedFrom?: string[];
}

export interface AiAnalysis {
  executiveSummary: string;
  technicalSummary: string;
  overallRisk: BusinessRisk;
  triaged: TriagedFinding[];
}

const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    executiveSummary: {
      type: "string",
      description: "2-4 sentence non-technical summary for a business stakeholder.",
    },
    technicalSummary: {
      type: "string",
      description: "A concise technical summary for the security engineer.",
    },
    overallRisk: {
      type: "string",
      enum: ["critical", "high", "medium", "low", "info"],
    },
    triaged: {
      type: "array",
      description: "Deduplicated, business-risk-ranked findings, most severe first.",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          toolSeverity: { type: "string" },
          businessRisk: {
            type: "string",
            enum: ["critical", "high", "medium", "low", "info"],
          },
          rationale: {
            type: "string",
            description: "Why this business-risk level, in one sentence.",
          },
          remediation: {
            type: "string",
            description: "Concrete, actionable remediation steps.",
          },
          mergedFrom: {
            type: "array",
            items: { type: "string" },
            description: "Titles of duplicate findings merged into this one, if any.",
          },
        },
        required: ["title", "toolSeverity", "businessRisk", "rationale", "remediation"],
      },
    },
  },
  required: ["executiveSummary", "technicalSummary", "overallRisk", "triaged"],
} as const;

const SYSTEM_PROMPT = `You are a senior penetration-testing analyst writing the analysis section of a client report.
Given the raw findings from automated tools (nmap, subfinder, httpx, nuclei, TLS and header checks), you:
- Deduplicate findings that describe the same underlying issue across different tools into a single entry (list the merged titles in mergedFrom).
- Re-rank each finding by real-world business risk (exploitability + impact), which may differ from the raw scanner severity — e.g. an "info" TLS finding on an admin login page can be higher business risk than a generic "medium".
- Write a crisp executive summary a non-technical stakeholder can act on, and a technical summary for the engineer.
- Give concrete, specific remediation for each finding.
Be accurate and do not invent findings that are not present in the input.`;

/** Cap how many findings we send to keep the request bounded. */
const MAX_FINDINGS = 200;

export async function analyzeFindings(context: {
  host: string;
  tool: string;
  phase: string;
  findings: FindingInput[];
}): Promise<AiAnalysis | null> {
  if (!aiEnabled) return null;

  const findings = context.findings.slice(0, MAX_FINDINGS);
  const userContent = JSON.stringify(
    {
      target: context.host,
      scan: { tool: context.tool, phase: context.phase },
      findingCount: context.findings.length,
      findings,
    },
    null,
    2,
  );

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: {
        effort: "medium",
        format: { type: "json_schema", schema: ANALYSIS_SCHEMA },
      },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze these penetration-test findings and produce the report analysis.\n\n${userContent}`,
        },
      ],
    });

    if (response.stop_reason === "refusal") {
      logger.warn("AI analysis refused by safety classifier");
      return null;
    }

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") return null;

    return JSON.parse(textBlock.text) as AiAnalysis;
  } catch (err) {
    logger.error({ err }, "AI analysis failed; falling back to deterministic summary");
    return null;
  }
}

/** Render an {@link AiAnalysis} into the report's plaintext summary field. */
export function renderAnalysisSummary(analysis: AiAnalysis): string {
  const lines = [
    "═══ AI ANALYSIS ═══",
    "",
    `Overall business risk: ${analysis.overallRisk.toUpperCase()}`,
    "",
    "Executive summary:",
    analysis.executiveSummary,
    "",
    "Technical summary:",
    analysis.technicalSummary,
    "",
    "Prioritized findings:",
    ...analysis.triaged.map(
      (t, i) =>
        `${i + 1}. [${t.businessRisk.toUpperCase()}] ${t.title}` +
        (t.mergedFrom?.length ? ` (merged: ${t.mergedFrom.join(", ")})` : "") +
        `\n   Why: ${t.rationale}\n   Fix: ${t.remediation}`,
    ),
  ];
  return lines.join("\n");
}
