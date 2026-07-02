import { execFile } from "node:child_process";

const HOSTNAME_OR_IP = /^[A-Za-z0-9.-]+$/;

/**
 * Rejects anything that isn't a bare hostname/IP character set. Run before
 * any user/DB-derived value is placed into a docker/tool argument list, so a
 * target host can't be crafted as a flag (e.g. "-oN=/etc/passwd") or contain
 * shell metacharacters — even though execFile never invokes a shell.
 */
export function assertSafeHost(host: string): string {
  if (!HOSTNAME_OR_IP.test(host)) {
    throw new Error(`Refusing to use unsafe host value: "${host}"`);
  }
  return host;
}

export interface RunDockerToolOptions {
  image: string;
  args: string[];
  timeoutMs: number;
  volumes?: string[];
  memoryLimit?: string;
  cpus?: string;
}

export interface ToolExecResult {
  stdout: string;
  stderr: string;
}

/**
 * Runs a security tool inside a throwaway Docker container. Args are always
 * passed as an array to execFile — never through a shell — so there is no
 * shell-injection surface regardless of what a caller puts in `args`.
 *
 * Isolation for Phase 1 is: --rm (no leftover state), memory/cpu caps, a
 * hard timeout, and the authorization gate + arg allow-listing upstream.
 * Network-level egress restriction to only the authorized target is NOT
 * implemented yet (containers get normal outbound network access) — that is
 * a follow-up, not solved by this dispatcher.
 */
export function runDockerTool(options: RunDockerToolOptions): Promise<ToolExecResult> {
  const volumeArgs = (options.volumes ?? []).flatMap((v) => ["-v", v]);
  const dockerArgs = [
    "run",
    "--rm",
    "--memory",
    options.memoryLimit ?? "512m",
    "--cpus",
    options.cpus ?? "1",
    ...volumeArgs,
    options.image,
    ...options.args,
  ];

  return new Promise((resolve, reject) => {
    execFile(
      "docker",
      dockerArgs,
      { timeout: options.timeoutMs, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`docker run ${options.image} failed: ${error.message}\n${stderr}`));
          return;
        }
        resolve({ stdout, stderr });
      }
    );
  });
}
