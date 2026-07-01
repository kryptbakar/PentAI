import { useListTargets } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Target, Server, AlertTriangle, Shield, Search } from "lucide-react"
import { Link } from "wouter"
import { Input } from "@/components/ui/input"
import { useState } from "react"

export default function Targets() {
  const { data: targets } = useListTargets()
  const [search, setSearch] = useState("")

  if (!targets) return <div className="p-8 text-primary font-mono text-sm animate-pulse">FETCHING_TARGETS()...</div>

  const filteredTargets = targets.filter(t => 
    t.host.toLowerCase().includes(search.toLowerCase()) || 
    (t.ip && t.ip.includes(search)) ||
    (t.scopeName && t.scopeName.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <Target className="w-6 h-6" />
            GLOBAL_TARGETS
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Master list of all authorized targets across scopes</p>
        </div>
        <div className="relative w-full md:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input 
            placeholder="Search host or IP..." 
            className="pl-9 font-mono"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Target Identity</TableHead>
                <TableHead>Scope</TableHead>
                <TableHead>Ports</TableHead>
                <TableHead>Authorization</TableHead>
                <TableHead>Mode</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTargets.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                    NO_TARGETS_FOUND
                  </TableCell>
                </TableRow>
              ) : (
                filteredTargets.map(target => (
                  <TableRow key={target.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-muted/30 border border-border rounded-sm">
                          <Server className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold font-mono text-sm text-foreground">{target.host}</span>
                          {target.ip && <span className="text-[10px] font-mono text-muted-foreground">{target.ip}</span>}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Link href={`/scopes/${target.scopeId}`} className="flex items-center gap-1 hover:text-primary transition-colors text-xs font-mono">
                        <Shield className="w-3 h-3" />
                        {target.scopeName || `SCOPE_${target.scopeId}`}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {target.portRange || "ALL_PORTS"}
                    </TableCell>
                    <TableCell>
                      {target.allowed ? (
                        <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-transparent">AUTHORIZED</Badge>
                      ) : (
                        <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-transparent">BLOCKED</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {target.activeModeEnabled && target.allowed ? (
                        <Badge variant="outline" className="text-destructive border-destructive/30 flex items-center gap-1 max-w-fit">
                          <AlertTriangle className="w-3 h-3" /> ACTIVE
                        </Badge>
                      ) : target.allowed ? (
                        <Badge variant="outline" className="text-muted-foreground border-border max-w-fit">
                          RECON_ONLY
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">-</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/scans?targetId=${target.id}`}>
                        <Button variant="outline" size="sm" className="font-mono text-xs h-8">
                          VIEW_SCANS
                        </Button>
                      </Link>
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
