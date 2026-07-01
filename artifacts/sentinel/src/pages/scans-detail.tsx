import { useGetScan, useGetScanFindings, useCancelScan } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Radar, ArrowLeft, StopCircle, Terminal, AlertTriangle, Bug, FileText, Shield } from "lucide-react"
import { Link, useParams } from "wouter"
import { format } from "date-fns"
import { useQueryClient } from "@tanstack/react-query"
import { getGetScanQueryKey } from "@workspace/api-client-react"

export default function ScanDetail() {
  const { id } = useParams()
  const scanId = parseInt(id || "0", 10)
  
  const queryClient = useQueryClient()
  const { data: scan } = useGetScan(scanId, { query: { enabled: !!scanId, queryKey: getGetScanQueryKey(scanId) } })
  const { data: findings } = useGetScanFindings(scanId, { query: { enabled: !!scanId, queryKey: ['scan-findings', scanId] } })
  const cancelScan = useCancelScan()

  if (!scan) return <div className="p-8 text-primary font-mono text-sm animate-pulse">FETCHING_SCAN_TELEMETRY()...</div>

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
              <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
                <Terminal className="w-6 h-6" />
                JOB-{scan.id.toString().padStart(4, '0')}
              </h1>
              <StatusIndicator status={scan.status} />
              <Badge variant={scan.phase}>{scan.phase}</Badge>
            </div>
            <p className="text-muted-foreground text-sm font-mono mt-1">Target: {scan.targetHost} | Scope: {scan.scopeName}</p>
          </div>
        </div>
        
        {isRunning && (
          <Button variant="destructive" onClick={handleCancel} disabled={cancelScan.isPending} className="font-mono rounded-none">
            <StopCircle className="w-4 h-4 mr-2" />
            ABORT_SCAN
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">EXECUTION_PARAMS</CardTitle>
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
              IDENTIFIED_FINDINGS
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
                    <p className="text-primary font-mono text-sm animate-pulse">ANALYZING_TARGET_RESPONSES...</p>
                  </div>
                ) : (
                  <div>
                    <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
                    <p className="text-muted-foreground font-mono text-sm">NO_VULNERABILITIES_DETECTED</p>
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
