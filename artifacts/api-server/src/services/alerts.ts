import { logger } from "../lib/logger";

/**
 * Outbound alerting. When ALERT_WEBHOOK_URL is set (e.g. a Slack/Discord/Teams
 * incoming webhook), PentAI posts a message whenever a scan surfaces high-impact
 * findings. Fully optional and non-blocking: a missing URL or a failed POST is
 * logged and swallowed — it never affects scan execution.
 */

const SEVERITY_RANK: Record<string, number> = {
  critical: 4,
  high: 3,
  medium: 2,
  low: 1,
  info: 0,
};

export const alertsEnabled = Boolean(process.env.ALERT_WEBHOOK_URL);

export interface AlertFinding {
  severity: string;
  title: string;
}

/**
 * Fire an alert for the highest-impact findings from a completed scan.
 * Only critical/high findings trigger a notification.
 */
export async function alertOnFindings(context: {
  host: string;
  scanId: number;
  findings: AlertFinding[];
}): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  if (!url) return;

  const notable = context.findings.filter((f) => (SEVERITY_RANK[f.severity] ?? 0) >= 3);
  if (notable.length === 0) return;

  const counts = notable.reduce<Record<string, number>>((acc, f) => {
    acc[f.severity] = (acc[f.severity] ?? 0) + 1;
    return acc;
  }, {});
  const summary = Object.entries(counts)
    .map(([sev, n]) => `${n} ${sev}`)
    .join(", ");

  const text = [
    `:rotating_light: *PentAI* found ${summary} on *${context.host}* (scan #${context.scanId})`,
    ...notable.slice(0, 10).map((f) => `• [${f.severity.toUpperCase()}] ${f.title}`),
  ].join("\n");

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeout));
  } catch (err) {
    logger.warn({ err }, "Alert webhook POST failed");
  }
}
