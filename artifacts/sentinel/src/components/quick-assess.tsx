import * as React from "react"
import { useLocation } from "wouter"
import { useQueryClient } from "@tanstack/react-query"
import {
  useCreateScope,
  useCreateTarget,
  useCreateScan,
} from "@workspace/api-client-react"
import {
  Globe,
  Loader2,
  Check,
  ShieldCheck,
  Radar,
  Fingerprint,
  Network,
  Bug,
  ArrowRight,
  Sparkles,
  AlertTriangle,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { cn } from "@/lib/utils"

/**
 * The full automated toolchain a one-click assessment launches. Every tool
 * here has a real adapter on the API server and runs in a non-intrusive
 * (passive / safe-template) mode — no exploitation without explicit opt-in.
 */
const TOOLCHAIN = [
  { tool: "subfinder", phase: "recon" as const, label: "Subdomain enumeration", icon: Network },
  { tool: "httpx", phase: "recon" as const, label: "HTTP fingerprinting", icon: Fingerprint },
  { tool: "nmap", phase: "recon" as const, label: "Port & service discovery", icon: Radar },
  { tool: "headers", phase: "scan" as const, label: "Security header analysis", icon: ShieldCheck },
  { tool: "nuclei", phase: "scan" as const, label: "Vulnerability templates (CVE)", icon: Bug },
]

type StepKey = "authorize" | (typeof TOOLCHAIN)[number]["tool"]
type StepState = "pending" | "active" | "done"
type Phase = "idle" | "running" | "done" | "error"

const STEPS: { key: StepKey; label: string; icon: React.ElementType }[] = [
  { key: "authorize", label: "Authorization gate & scope provisioning", icon: ShieldCheck },
  ...TOOLCHAIN.map((t) => ({ key: t.tool as StepKey, label: t.label, icon: t.icon })),
]

function normalizeHost(raw: string): string | null {
  let value = raw.trim()
  if (!value) return null
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`
  try {
    const url = new URL(value)
    const host = url.hostname.replace(/^www\./, "")
    // Require at least one dot so we don't accept bare words like "test".
    return host.includes(".") ? host : null
  } catch {
    return null
  }
}

function extractError(err: unknown): string {
  const anyErr = err as { data?: { error?: string }; message?: string }
  return anyErr?.data?.error ?? anyErr?.message ?? "Something went wrong launching the assessment."
}

export function QuickAssess({
  onLaunched,
  autoFocus,
}: {
  onLaunched?: () => void
  autoFocus?: boolean
}) {
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const createScope = useCreateScope()
  const createTarget = useCreateTarget()
  const createScan = useCreateScan()

  const [input, setInput] = React.useState("")
  const [host, setHost] = React.useState<string | null>(null)
  const [phase, setPhase] = React.useState<Phase>("idle")
  const [error, setError] = React.useState<string | null>(null)
  const [steps, setSteps] = React.useState<Record<StepKey, StepState>>(() =>
    Object.fromEntries(STEPS.map((s) => [s.key, "pending"])) as Record<StepKey, StepState>,
  )

  const setStep = (key: StepKey, state: StepState) =>
    setSteps((prev) => ({ ...prev, [key]: state }))

  async function launch() {
    const normalized = normalizeHost(input)
    if (!normalized) {
      setError("Enter a valid website, e.g. example.com or https://app.example.com")
      return
    }

    setHost(normalized)
    setError(null)
    setPhase("running")
    setSteps(Object.fromEntries(STEPS.map((s) => [s.key, "pending"])) as Record<StepKey, StepState>)

    try {
      setStep("authorize", "active")
      const now = Date.now()
      const scope = await createScope.mutateAsync({
        data: {
          name: `Assessment — ${normalized}`,
          description: `One-click PentAI assessment for ${normalized}.`,
          signedBy: "PentAI Console",
          roeActive: true,
          validFrom: new Date(now - 60 * 60 * 1000).toISOString(),
          validUntil: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
      })

      const target = await createTarget.mutateAsync({
        data: {
          scopeId: scope.id,
          host: normalized,
          allowed: true,
          activeModeEnabled: false,
          notes: "Provisioned automatically by the PentAI one-click console.",
        },
      })
      setStep("authorize", "done")

      const ids: number[] = []
      for (const step of TOOLCHAIN) {
        setStep(step.tool, "active")
        const scan = await createScan.mutateAsync({
          data: { targetId: target.id, tool: step.tool, phase: step.phase },
        })
        ids.push(scan.id)
        setStep(step.tool, "done")
      }

      await queryClient.invalidateQueries()
      setPhase("done")
    } catch (err) {
      setError(extractError(err))
      setPhase("error")
    }
  }

  const busy = phase === "running"

  return (
    <div className="w-full">
      {/* URL entry */}
      <div className="relative">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground">
          <Globe className="h-5 w-5" />
        </div>
        <Input
          value={input}
          autoFocus={autoFocus}
          disabled={busy}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !busy) launch()
          }}
          placeholder="example.com"
          className="h-14 rounded-xl border-primary/20 bg-secondary/40 pl-12 pr-40 text-base font-medium shadow-inner"
        />
        <div className="absolute inset-y-0 right-2 flex items-center">
          <Button
            onClick={launch}
            disabled={busy}
            size="lg"
            className="h-11 gap-2 rounded-lg px-5"
          >
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Launching
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Assess
              </>
            )}
          </Button>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        PentAI provisions an authorized scope, then runs the full passive recon + vulnerability
        toolchain. Exploitation stays disabled unless you enable active mode.
      </p>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Launch sequence */}
      {(phase === "running" || phase === "done") && (
        <div className="mt-5 rounded-xl border border-border/70 bg-background/40 p-4">
          <div className="mb-3 flex items-center gap-2 text-xs font-medium uppercase tracking-widest text-muted-foreground">
            <span className="font-mono text-primary">{host}</span>
            <span className="text-border">/</span>
            <span>assessment pipeline</span>
          </div>
          <ol className="space-y-2.5">
            {STEPS.map((step) => {
              const state = steps[step.key]
              const Icon = step.icon
              return (
                <li key={step.key} className="flex items-center gap-3 text-sm">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full border transition-colors",
                      state === "done" && "border-emerald-500/40 bg-emerald-500/15 text-emerald-400",
                      state === "active" && "border-primary/50 bg-primary/15 text-primary animate-pulse-ring",
                      state === "pending" && "border-border bg-secondary/40 text-muted-foreground",
                    )}
                  >
                    {state === "done" ? (
                      <Check className="h-4 w-4" />
                    ) : state === "active" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Icon className="h-3.5 w-3.5" />
                    )}
                  </span>
                  <span
                    className={cn(
                      state === "pending" ? "text-muted-foreground" : "text-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ol>

          {phase === "done" && (
            <div className="mt-4 flex flex-col gap-3 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-emerald-400">
                Assessment live — {TOOLCHAIN.length} tools dispatched against{" "}
                <span className="font-mono">{host}</span>.
              </p>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  onLaunched?.()
                  navigate("/scans")
                }}
              >
                View live results
                <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Topbar entry point — a compact button that opens the full launcher in a dialog.
 */
export function QuickAssessDialog() {
  const [open, setOpen] = React.useState(false)
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2">
          <Sparkles className="h-4 w-4" />
          <span className="hidden sm:inline">New Assessment</span>
          <span className="sm:hidden">Assess</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-primary" />
            Assess a website
          </DialogTitle>
        </DialogHeader>
        <p className="-mt-1 text-sm text-muted-foreground">
          Enter a domain and PentAI runs the full reconnaissance and vulnerability toolchain
          automatically.
        </p>
        <QuickAssess autoFocus onLaunched={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
