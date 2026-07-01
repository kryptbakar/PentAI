import { useGetDashboardSummary, useGetRecentActivity, useGetActiveScans, useGetFindingsBySeverity } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import { Shield, Target, Crosshair, AlertTriangle, AlertCircle, Info, Activity, Clock, TerminalSquare, Radar } from "lucide-react"
import { Link } from "wouter"
import { format } from "date-fns"
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts"

export default function Dashboard() {
  const { data: summary } = useGetDashboardSummary()
  const { data: activity } = useGetRecentActivity({ limit: 10 })
  const { data: activeScans } = useGetActiveScans()
  const { data: severity } = useGetFindingsBySeverity()

  if (!summary || !activity || !severity) {
    return <div className="p-8 text-primary font-mono text-sm animate-pulse">INIT_SYSTEM()...</div>
  }

  const statCards = [
    { label: "Active Scopes", value: summary.totalScopes, icon: Shield, href: "/scopes" },
    { label: "Total Targets", value: summary.totalTargets, icon: Target, href: "/targets" },
    { label: "Active Scans", value: summary.activeScans, icon: Crosshair, href: "/scans?status=running" },
    { label: "Critical Findings", value: summary.criticalFindings, icon: AlertTriangle, href: "/findings?severity=critical", highlight: true },
  ]

  const chartData = [
    { name: "CRITICAL", value: severity.critical, color: "hsl(var(--destructive))" },
    { name: "HIGH", value: severity.high, color: "#f97316" }, // orange-500
    { name: "MEDIUM", value: severity.medium, color: "#eab308" }, // yellow-500
    { name: "LOW", value: severity.low, color: "#3b82f6" }, // blue-500
    { name: "INFO", value: severity.info, color: "#6b7280" }, // gray-500
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <Activity className="w-6 h-6" />
            OPERATIONS_DASHBOARD
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">System status overview and active engagement metrics</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat, i) => (
          <Link key={i} href={stat.href}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer group border-l-4 border-l-primary/50 hover:border-l-primary">
              <CardContent className="p-6">
                <div className="flex justify-between items-start">
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                    <p className={`text-3xl font-mono ${stat.highlight && stat.value > 0 ? 'text-destructive' : 'text-foreground'}`}>
                      {stat.value}
                    </p>
                  </div>
                  <div className="p-2 bg-muted/50 rounded-none group-hover:bg-primary/20 transition-colors">
                    <stat.icon className={`w-5 h-5 ${stat.highlight && stat.value > 0 ? 'text-destructive' : 'text-primary'}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              FINDINGS_BY_SEVERITY
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                  <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip 
                    cursor={{ fill: 'hsl(var(--muted))' }}
                    contentStyle={{ backgroundColor: 'hsl(var(--card))', borderColor: 'hsl(var(--border))', borderRadius: '0' }}
                    itemStyle={{ color: 'hsl(var(--foreground))' }}
                  />
                  <Bar dataKey="value" radius={[0, 0, 0, 0]}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5" />
              RECENT_ACTIVITY
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border h-[300px] overflow-y-auto">
              {activity.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground font-mono text-sm">NO_ACTIVITY_DETECTED</div>
              ) : (
                activity.map((item) => (
                  <div key={item.id} className="p-4 hover:bg-muted/30 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-mono text-xs text-primary">{item.type}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {format(new Date(item.createdAt), "HH:mm:ss")}
                      </span>
                    </div>
                    <p className="text-sm text-foreground">{item.title}</p>
                    <p className="text-xs text-muted-foreground mt-1 truncate">{item.description}</p>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Radar className="w-5 h-5" />
              ACTIVE_SCANS
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {activeScans && activeScans.length > 0 ? (
              <div className="divide-y divide-border">
                {activeScans.map(scan => (
                  <div key={scan.id} className="p-4 flex items-center justify-between hover:bg-muted/30">
                    <div className="flex flex-col gap-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-foreground">{scan.targetHost}</span>
                        <Badge variant={scan.phase}>{scan.phase}</Badge>
                      </div>
                      <span className="text-xs font-mono text-muted-foreground">{scan.tool} | {scan.scopeName}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      {scan.findingCount !== undefined && scan.findingCount > 0 && (
                        <span className="text-xs font-mono text-destructive flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {scan.findingCount} FINDINGS
                        </span>
                      )}
                      <StatusIndicator status={scan.status} />
                      <Link href={`/scans/${scan.id}`} className="text-primary hover:underline text-xs font-mono">
                        [DETAILS]
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-8 text-center border-t border-border">
                <TerminalSquare className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-muted-foreground font-mono text-sm">NO_ACTIVE_SCANS</p>
                <Link href="/scans" className="text-primary hover:underline font-mono text-xs mt-2 inline-block">
                  [INITIALIZE_SCAN]
                </Link>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
