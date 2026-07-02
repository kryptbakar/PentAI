import { useListAuditEntries } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { ScrollText, Shield, XCircle, CheckCircle2 } from "lucide-react"
import { format } from "date-fns"

export default function AuditLog() {
  const { data: auditLogs } = useListAuditEntries({ limit: 100 })

  if (!auditLogs) return <div className="p-8 text-muted-foreground text-sm animate-pulse">Loading audit log…</div>

  return (
    <div className="space-y-6 flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex items-center justify-between border-b border-border pb-4 flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <ScrollText className="w-6 h-6" />
            Immutable audit log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Verifiable record of all operator actions and authorization checks</p>
        </div>
        <div className="flex items-center gap-2 text-xs font-mono text-green-500 bg-green-500/10 px-3 py-1 border border-green-500/20">
          <Shield className="w-3 h-3" />
          Cryptographically sealed
        </div>
      </div>

      <Card className="flex-1 min-h-0 flex flex-col overflow-hidden border-destructive/20">
        <CardHeader className="bg-muted/10 py-3 border-b border-border flex-shrink-0">
          <CardTitle className="text-xs font-mono flex items-center gap-2 text-muted-foreground">
            <div className="w-2 h-2 rounded-full bg-destructive animate-pulse"></div>
            Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-auto flex-1">
          <Table>
            <TableHeader className="sticky top-0 bg-card z-10 border-b border-border">
              <TableRow>
                <TableHead className="w-[180px]">Timestamp (UTC)</TableHead>
                <TableHead>Operator</TableHead>
                <TableHead>Action / Tool</TableHead>
                <TableHead>Target / Scope</TableHead>
                <TableHead>Auth Context</TableHead>
                <TableHead className="text-right">Outcome</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="font-mono text-xs">
              {auditLogs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-64 text-center text-muted-foreground">
                    No audit records
                  </TableCell>
                </TableRow>
              ) : (
                auditLogs.map(log => (
                  <TableRow key={log.id} className="hover:bg-muted/30">
                    <TableCell className="text-muted-foreground">
                      {format(new Date(log.createdAt), "yyyy-MM-dd HH:mm:ss")}
                    </TableCell>
                    <TableCell className="text-primary">{log.operator}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="uppercase text-foreground">{log.tool}</span>
                        {log.flags && <span className="text-[9px] text-muted-foreground truncate max-w-[200px]">{log.flags}</span>}
                      </div>
                    </TableCell>
                    <TableCell>{log.targetHost || `TARGET_${log.targetId}`}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.authorizedBy ? `Auth by: ${log.authorizedBy}` : "System Check"}
                    </TableCell>
                    <TableCell className="text-right">
                      {log.outcome === 'allowed' ? (
                        <div className="inline-flex items-center gap-1 text-green-500 bg-green-500/10 px-2 py-0.5 border border-green-500/20">
                          <CheckCircle2 className="w-3 h-3" /> ALLOWED
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-1 text-destructive bg-destructive/10 px-2 py-0.5 border border-destructive/20">
                          <XCircle className="w-3 h-3" /> DENIED
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
