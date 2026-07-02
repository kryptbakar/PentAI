import {
  useGetDashboardSummary,
  useGetRecentActivity,
  useGetActiveScans,
  useGetFindingsBySeverity,
} from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import {
  ShieldCheck,
  Crosshair,
  Radar,
  AlertTriangle,
  AlertCircle,
  Clock,
  Activity,
  ArrowUpRight,
} from "lucide-react"
import { Link } from "wouter"
import { format } from "date-fns"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts"
import { QuickAssess } from "@/components/quick-assess"

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary()
  const { data: activity } = useGetRecentActivity({ limit: 10 })
  const { data: activeScans } = useGetActiveScans()
  const { data: severity } = useGetFindingsBySeverity()

  const statCards = [
    { label: "Active Scopes", value: summary?.totalScopes ?? 0, icon: ShieldCheck, href: "/scopes" },
    { label: "Targets", value: summary?.totalTargets ?? 0, icon: Crosshair, href: "/targets" },
    { label: "Active Scans", value: summary?.activeScans ?? 0, icon: Radar, href: "/scans?status=running" },
    { label: "Critical Findings", value: summary?.criticalFindings ?? 0, icon: AlertTriangle, href: "/findings?severity=critical", highlight: true },
  ]

  const chartData = [
    { name: "Critical", value: severity?.critical ?? 0, color: "hsl(352 82% 60%)" },
    { name: "High", value: severity?.high ?? 0, color: "hsl(24 94% 58%)" },
    { name: "Medium", value: severity?.medium ?? 0, color: "hsl(41 92% 58%)" },
    { name: "Low", value: severity?.low ?? 0, color: "hsl(217 91% 60%)" },
    { name: "Info", value: severity?.info ?? 0, color: "hsl(255 12% 55%)" },
  ]

  return (
    <div className="space-y-8">
      {/* Hero — one-click assessment */}
      <section className="card-premium grid-faint overflow-hidden">
        <div className="relative p-6 md:p-10">
          <div className="mx-auto max-w-2xl text-center">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
              </span>
              Autonomous security assessment
            </div>
            <h1 className="font-display text-3xl font-bold leading-tight tracking-tight md:text-5xl">
              Pentest any website in <span className="text-gradient whitespace-nowrap">one click</span>
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
              Enter a domain. PentAI provisions an authorized scope and runs the full
              reconnaissance and vulnerability toolchain — subdomains, ports, services and CVEs —
              then streams findings back here.
            </p>
            <div className="mx-auto mt-7 max-w-xl text-left">
              <QuickAssess />
            </div>
          </div>
        </div>
      </section>

      {/* Stat cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat, i) => {
          const danger = stat.highlight && stat.value > 0
          return (
            <Link key={i} href={stat.href}>
              <Card className="group cursor-pointer transition-transform duration-200 hover:-translate-y-1">
                <CardContent className="flex items-start justify-between p-5">
                  <div className="space-y-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {stat.label}
                    </p>
                    <p
                      className={`font-display text-4xl font-bold ${danger ? "text-destructive" : "text-foreground"}`}
                    >
                      {stat.value}
                    </p>
                  </div>
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                      danger
                        ? "bg-destructive/15 text-destructive"
                        : "bg-primary/10 text-primary group-hover:bg-primary/20"
                    }`}
                  >
                    <stat.icon className="h-5 w-5" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Severity chart */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertCircle className="h-5 w-5 text-primary" />
              Findings by severity
            </CardTitle>
            <Link
              href="/findings"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-primary"
            >
              View all <ArrowUpRight className="h-3 w-3" />
            </Link>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip
                    cursor={{ fill: "hsl(var(--muted) / 0.4)" }}
                    contentStyle={{
                      backgroundColor: "hsl(var(--popover))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "0.75rem",
                    }}
                    itemStyle={{ color: "hsl(var(--foreground))" }}
                    labelStyle={{ color: "hsl(var(--muted-foreground))" }}
                  />
                  <Bar dataKey="value" radius={[6, 6, 0, 0]} maxBarSize={72}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Activity feed */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Clock className="h-5 w-5 text-primary" />
              Recent activity
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="h-[300px] divide-y divide-border/60 overflow-y-auto">
              {!activity || activity.length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No activity yet.
                </div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="px-5 py-3.5 transition-colors hover:bg-secondary/40">
                    <div className="mb-1 flex items-center justify-between">
                      <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-primary">
                        {item.type}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {format(new Date(item.createdAt), "HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Active scans */}
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Radar className="h-5 w-5 text-primary" />
              Active scans
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeScans && activeScans.length > 0 ? (
              <div className="divide-y divide-border/60">
                {activeScans.map((scan) => (
                  <div key={scan.id} className="flex items-center justify-between px-5 py-4 transition-colors hover:bg-secondary/40">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-semibold text-foreground">{scan.targetHost}</span>
                        <Badge variant={scan.phase}>{scan.phase}</Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {scan.tool} · {scan.scopeName}
                      </span>
                    </div>
                    <div className="flex items-center gap-4">
                      {scan.findingCount !== undefined && scan.findingCount > 0 && (
                        <span className="flex items-center gap-1 text-xs font-medium text-destructive">
                          <AlertTriangle className="h-3 w-3" />
                          {scan.findingCount}
                        </span>
                      )}
                      <StatusIndicator status={scan.status} />
                      <Link href={`/scans/${scan.id}`} className="text-xs font-medium text-primary hover:underline">
                        Details
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-center">
                <Activity className="h-8 w-8 text-muted-foreground/50" />
                <p className="text-sm text-muted-foreground">No active scans right now.</p>
                <p className="text-xs text-muted-foreground">
                  Launch one from the console above to see it here live.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
