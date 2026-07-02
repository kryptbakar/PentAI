import { useGetScan, useGetScanFindings, useCancelScan } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Radar, ArrowLeft, StopCircle, Terminal, AlertTriangle, Bug, FileText, Shield, Activity } from "lucide-react"
import { Link, useParams } from "wouter"
import { format } from "date-fns"
import { useEffect, useState } from "react"
import { useQueryClient } from "@tanstack/react-query"
import { getGetScanQueryKey } from "@workspace/api-client-react"

type LiveEvent =
  | { type: "status"; status: string; at: string }
  | { type: "finding"; severity: string; title: string; tool: string; at: string }
  | { type: "log"; message: string; at: string }

export default function ScanDetail() {
  const { id } = useParams()
  const scanId = parseInt(id || "0", 10)

  const queryClient = useQueryClient()
  const { data: scan } = useGetScan(scanId, { query: { enabled: !!scanId, queryKey: getGetScanQueryKey(scanId) } })
  const { data: findings } = useGetScanFindings(scanId, { query: { enabled: !!scanId, queryKey: ['scan-findings', scanId] } })
  const cancelScan = useCancelScan()

  const [liveEvents, setLiveEvents] = useState<LiveEvent[]>([])
  const status = scan?.status

  // Subscribe to the live scan stream while the scan is in flight.
  useEffect(() => {
    if (!scanId || (status !== "running" && status !== "queued")) return
    const es = new EventSource(`/api/scans/${scanId}/stream`)
    es.onmessage = (e) => {
      try {
        const ev = JSON.parse(e.data) as LiveEvent
        setLiveEvents((prev) => [ev, ...prev].slice(0, 60))
        if (ev.type === "finding") {
          queryClient.invalidateQueries({ queryKey: ["scan-findings", scanId] })
        }
        if (ev.type === "status" && (ev.status === "completed" || ev.status === "failed")) {
          queryClient.invalidateQueries({ queryKey: getGetScanQueryKey(scanId) })
          queryClient.invalidateQueries({ queryKey: ["scan-findings", scanId] })
          es.close()
        }
      } catch {
        /* ignore malformed frames */
      }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [scanId, status, queryClient])

  if (!scan) return <div className="p-8 text-muted-foreground text-sm animate-pulse">Loading scan…</div>

  const isRunning = scan.status === 'running' || scan.status === 'queued'

  function handleCancel() {
    if (confirm("ABORT SCAN COMMAND ISSUED. Confirm?")) {
      cancelScan.mutate({ id: scanId }, {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: getGetScanQueryKey(scanId) })
        }
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href="/scans" className="p-2 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
                <Terminal className="w-6 h-6" />
                JOB-{scan.id.toString().padStart(4, '0')}
              </h1>
              <StatusIndicator status={scan.status} />
              <Badge variant={scan.phase}>{scan.phase}</Badge>
            </div>
            <p className="text-muted-foreground text-sm mt-1">Target: {scan.targetHost} | Scope: {scan.scopeName}</p>
          </div>
        </div>
        
        {isRunning && (
          <Button variant="destructive" onClick={handleCancel} disabled={cancelScan.isPending} className="font-mono rounded-none">
            <StopCircle className="w-4 h-4 mr-2" />
            Abort
          </Button>
        )}
      </div>

      {(isRunning || liveEvents.length > 0) && (
        <Card className="border-primary/30">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Activity className="h-4 w-4 text-primary" />
              Live activity
            </CardTitle>
            {isRunning && (
              <span className="flex items-center gap-2 text-xs text-primary">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
                </span>
                streaming
              </span>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-56 overflow-y-auto divide-y divide-border/60">
              {liveEvents.length === 0 ? (
                <p className="p-4 text-xs text-muted-foreground">Waiting for the engine to report…</p>
              ) : (
                liveEvents.map((ev, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-2 text-xs">
                    <span className="font-mono text-[10px] text-muted-foreground">
                      {format(new Date(ev.at), "HH:mm:ss")}
                    </span>
                    {ev.type === "finding" ? (
                      <span className="flex items-center gap-2">
                        <Badge variant={ev.severity as any} className="justify-center">{ev.severity}</Badge>
                        <span className="text-foreground">{ev.title}</span>
                        <span className="text-muted-foreground">· {ev.tool}</span>
                      </span>
                    ) : ev.type === "status" ? (
                      <span className="text-foreground">Scan {ev.status}</span>
                    ) : (
                      <span className="text-muted-foreground">{ev.message}</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Execution parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Tool</div>
                <div className="font-mono text-sm bg-muted/30 p-2 border border-border uppercase">{scan.tool}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Phase</div>
                <div className="font-mono text-sm bg-muted/30 p-2 border border-border uppercase">{scan.phase}</div>
              </div>
            </div>
            
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Timeline</div>
              <div className="font-mono text-xs bg-muted/30 p-2 border border-border space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Queued:</span>
                  <span>{format(new Date(scan.createdAt), "MM/dd HH:mm:ss")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Started:</span>
                  <span>{scan.startedAt ? format(new Date(scan.startedAt), "MM/dd HH:mm:ss") : "-"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Finished:</span>
                  <span>{scan.completedAt ? format(new Date(scan.completedAt), "MM/dd HH:mm:ss") : "-"}</span>
                </div>
              </div>
            </div>

            {scan.errorMessage && (
              <div>
                <div className="text-[10px] uppercase font-mono text-destructive mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" /> Error Output
                </div>
                <div className="font-mono text-[10px] bg-destructive/10 text-destructive p-3 border border-destructive/20 whitespace-pre-wrap">
                  {scan.errorMessage}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Bug className="w-4 h-4" />
              Identified findings
            </CardTitle>
            <Badge variant="outline" className="font-mono border-border">
              {scan.findingCount || 0} TOTAL
            </Badge>
          </CardHeader>
          <CardContent className="p-0">
            {findings && findings.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Severity</TableHead>
                    <TableHead>Title</TableHead>
                    <TableHead>CVEs</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {findings.map(finding => (
                    <TableRow key={finding.id}>
                      <TableCell>
                        <Badge variant={finding.severity as any} className="w-20 justify-center">
                          {finding.severity}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm max-w-[250px] truncate" title={finding.title}>
                        {finding.title}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1 flex-wrap">
                          {finding.cveRefs?.slice(0,2).map(cve => (
                            <span key={cve} className="text-[10px] font-mono bg-muted px-1 border border-border">
                              {cve}
                            </span>
                          ))}
                          {(finding.cveRefs?.length || 0) > 2 && (
                            <span className="text-[10px] font-mono text-muted-foreground">+{finding.cveRefs!.length - 2}</span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/findings/${finding.id}`}>
                          <Button variant="ghost" size="sm" className="font-mono text-xs hover:text-primary">
                            <FileText className="w-4 h-4 mr-1" />
                            VIEW
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-12 text-center">
                {isRunning ? (
                  <div className="space-y-4">
                    <div className="relative w-16 h-16 mx-auto">
                      <div className="absolute inset-0 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
                      <Radar className="w-8 h-8 text-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                    </div>
                    <p className="text-muted-foreground text-sm animate-pulse">Analyzing target responses…</p>
                  </div>
                ) : (
                  <div>
                    <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">No vulnerabilities detected</p>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
