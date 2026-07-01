import { useListFindings, useGetFindingsBySeverity } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertTriangle, Filter, Search, ChevronRight, ShieldAlert } from "lucide-react"
import { Link, useLocation } from "wouter"
import { Input } from "@/components/ui/input"
import { useState } from "react"
import { format } from "date-fns"

export default function Findings() {
  const [location] = useLocation()
  const searchParams = new URLSearchParams(location.split('?')[1] || '')
  const severityParam = searchParams.get('severity') || undefined
  
  const { data: findings } = useListFindings({ severity: severityParam })
  const { data: severityStats } = useGetFindingsBySeverity()
  const [search, setSearch] = useState("")

  if (!findings || !severityStats) return <div className="p-8 text-primary font-mono text-sm animate-pulse">LOADING_VULNERABILITY_DB()...</div>

  const filteredFindings = findings.filter(f => 
    f.title.toLowerCase().includes(search.toLowerCase()) || 
    (f.targetHost && f.targetHost.toLowerCase().includes(search.toLowerCase())) ||
    (f.cveRefs && f.cveRefs.some(c => c.toLowerCase().includes(search.toLowerCase())))
  )

  const sevOrder: Record<string, number> = { critical: 5, high: 4, medium: 3, low: 2, info: 1 }
  filteredFindings.sort((a, b) => (sevOrder[b.severity] || 0) - (sevOrder[a.severity] || 0))

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <ShieldAlert className="w-6 h-6" />
            VULNERABILITY_FINDINGS
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Aggregated security issues across all scopes</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative w-full md:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input 
              placeholder="Search title or CVE..." 
              className="pl-9 font-mono"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Button variant="outline" size="icon" className="border-dashed">
            <Filter className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-6 flex-1 min-h-0">
        <div className="md:col-span-1 space-y-4 flex-shrink-0">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">SEVERITY_INDEX</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/findings?severity=critical">
                <div className={`flex justify-between items-center p-2 border cursor-pointer hover:bg-muted/50 transition-colors ${severityParam === 'critical' ? 'border-destructive bg-destructive/10' : 'border-border bg-muted/20'}`}>
                  <Badge variant="critical">CRITICAL</Badge>
                  <span className="font-mono font-bold text-destructive">{severityStats.critical}</span>
                </div>
              </Link>
              <Link href="/findings?severity=high">
                <div className={`flex justify-between items-center p-2 border cursor-pointer hover:bg-muted/50 transition-colors ${severityParam === 'high' ? 'border-orange-500/50 bg-orange-500/10' : 'border-border bg-muted/20'}`}>
                  <Badge variant="high">HIGH</Badge>
                  <span className="font-mono font-bold text-orange-500">{severityStats.high}</span>
                </div>
              </Link>
              <Link href="/findings?severity=medium">
                <div className={`flex justify-between items-center p-2 border cursor-pointer hover:bg-muted/50 transition-colors ${severityParam === 'medium' ? 'border-yellow-500/50 bg-yellow-500/10' : 'border-border bg-muted/20'}`}>
                  <Badge variant="medium">MEDIUM</Badge>
                  <span className="font-mono font-bold text-yellow-500">{severityStats.medium}</span>
                </div>
              </Link>
              <Link href="/findings?severity=low">
                <div className={`flex justify-between items-center p-2 border cursor-pointer hover:bg-muted/50 transition-colors ${severityParam === 'low' ? 'border-blue-500/50 bg-blue-500/10' : 'border-border bg-muted/20'}`}>
                  <Badge variant="low">LOW</Badge>
                  <span className="font-mono font-bold text-blue-500">{severityStats.low}</span>
                </div>
              </Link>
              <Link href="/findings?severity=info">
                <div className={`flex justify-between items-center p-2 border cursor-pointer hover:bg-muted/50 transition-colors ${severityParam === 'info' ? 'border-gray-500/50 bg-gray-500/10' : 'border-border bg-muted/20'}`}>
                  <Badge variant="info">INFO</Badge>
                  <span className="font-mono font-bold text-gray-400">{severityStats.info}</span>
                </div>
              </Link>
              
              {severityParam && (
                <Link href="/findings" className="block text-center text-xs font-mono text-muted-foreground hover:text-primary pt-2">
                  [CLEAR_FILTERS]
                </Link>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="md:col-span-4 flex flex-col min-h-0 h-full overflow-hidden">
          <CardContent className="p-0 overflow-auto flex-1">
            <Table>
              <TableHeader className="sticky top-0 z-10 shadow-sm bg-card border-b border-border">
                <TableRow>
                  <TableHead className="w-[100px]">Severity</TableHead>
                  <TableHead>Vulnerability</TableHead>
                  <TableHead>Target</TableHead>
                  <TableHead>CVEs</TableHead>
                  <TableHead>Discovered</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredFindings.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-64 text-center">
                      <ShieldAlert className="w-12 h-12 text-muted mx-auto mb-4 opacity-50" />
                      <span className="text-muted-foreground font-mono">NO_FINDINGS_MATCH_CRITERIA</span>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredFindings.map(finding => (
                    <TableRow key={finding.id} className="cursor-pointer hover:bg-muted/50 group" onClick={() => window.location.href = `/findings/${finding.id}`}>
                      <TableCell>
                        <Badge variant={finding.severity as any} className="w-full justify-center">
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <span className="font-bold text-foreground group-hover:text-primary transition-colors line-clamp-1">{finding.title}</span>
                          <span className="text-[10px] font-mono text-muted-foreground uppercase">Via {finding.tool}</span>
                        </div>
                      </TableCell>
                      <TableCell className="font-mono text-sm">{finding.targetHost}</TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {finding.cveRefs?.length ? (
                            finding.cveRefs.slice(0,2).map(cve => (
                              <span key={cve} className="text-[10px] font-mono bg-muted px-1 border border-border text-foreground">
                                {cve}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">-</span>
                          )}
                          {(finding.cveRefs?.length || 0) > 2 && (
                            <span className="text-[10px] font-mono text-muted-foreground">+{finding.cveRefs!.length - 2}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs font-mono flex items-center justify-between">
                        {format(new Date(finding.createdAt), "MM/dd/yy")}
                        <ChevronRight className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity text-primary" />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
