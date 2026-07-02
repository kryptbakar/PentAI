import { useListScans, useCreateScan, useListScopes, useListTargets } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Radar, Play, AlertTriangle, Terminal, Search, Filter } from "lucide-react"
import { Link, useLocation } from "wouter"
import { useState, useMemo } from "react"
import { format } from "date-fns"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useQueryClient } from "@tanstack/react-query"
import { getListScansQueryKey } from "@workspace/api-client-react"

const scanSchema = z.object({
  targetId: z.coerce.number().min(1, "Target is required"),
  tool: z.string().min(1, "Tool selection is required"),
  phase: z.enum(['recon', 'scan', 'exploit', 'intel']),
})

type ScanFormValues = z.infer<typeof scanSchema>

function StartScanDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const createScan = useCreateScan()
  
  const { data: scopes } = useListScopes()
  const { data: targets } = useListTargets()
  
  const form = useForm<ScanFormValues>({
    resolver: zodResolver(scanSchema),
    defaultValues: {
      tool: "",
      phase: "recon",
    }
  })

  const selectedTargetId = form.watch("targetId")
  
  const selectedTarget = useMemo(() => {
    return targets?.find(t => t.id === selectedTargetId)
  }, [targets, selectedTargetId])

  const selectedScope = useMemo(() => {
    if (!selectedTarget || !scopes) return null
    return scopes.find(s => s.id === selectedTarget.scopeId)
  }, [selectedTarget, scopes])

  const isAuthorized = selectedTarget?.allowed && selectedScope?.roeActive
  const isActiveAllowed = selectedTarget?.activeModeEnabled
  const selectedPhase = form.watch("phase")
  
  const isExploitBlocked = selectedPhase === 'exploit' && !isActiveAllowed

  function onSubmit(data: ScanFormValues) {
    if (!isAuthorized) return; // Guard
    if (isExploitBlocked) return;
    
    createScan.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListScansQueryKey() })
        setOpen(false)
        form.reset()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-mono bg-primary text-black hover:bg-primary/90">
          <Play className="w-4 h-4" />
          START_SCAN
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="w-5 h-5" />
            INITIALIZE_SCAN_JOB
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            
            <FormField
              control={form.control}
              name="targetId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Target Selection</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select target..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {targets?.map(t => (
                        <SelectItem key={t.id} value={t.id.toString()}>
                          {t.host} {t.ip ? `(${t.ip})` : ''} - Scope: {t.scopeName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* AUTHORIZATION GATE */}
            {selectedTarget && (
              <div className={`p-4 border border-l-4 ${isAuthorized ? 'bg-green-500/10 border-border border-l-green-500' : 'bg-red-500/10 border-destructive/20 border-l-destructive'} mb-4`}>
                <h4 className={`text-xs font-mono font-bold uppercase mb-2 ${isAuthorized ? 'text-green-500' : 'text-destructive flex items-center gap-1'}`}>
                  {!isAuthorized && <AlertTriangle className="w-3 h-3" />}
                  Authorization Gate
                </h4>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">RoE Active:</span>
                    <span className={selectedScope?.roeActive ? "text-green-400" : "text-destructive"}>
                      {selectedScope?.roeActive ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Target Allowed:</span>
                    <span className={selectedTarget?.allowed ? "text-green-400" : "text-destructive"}>
                      {selectedTarget?.allowed ? "YES" : "NO"}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Active Mode (Exploit):</span>
                    <span className={isActiveAllowed ? "text-primary" : "text-muted-foreground"}>
                      {isActiveAllowed ? "ENABLED" : "DISABLED"}
                    </span>
                  </div>
                </div>
                {!isAuthorized && (
                  <p className="mt-2 text-xs text-destructive font-bold uppercase">
                    SCAN CANNOT PROCEED. TARGET IS NOT AUTHORIZED.
                  </p>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="phase"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Attack Phase</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select phase..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="recon">Reconnaissance</SelectItem>
                        <SelectItem value="scan">Vulnerability Scan</SelectItem>
                        <SelectItem value="exploit">Exploitation</SelectItem>
                        <SelectItem value="intel">Intelligence Gathering</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="tool"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Tool Selection</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select tool..." />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="nmap">Nmap</SelectItem>
                        <SelectItem value="subfinder">Subfinder</SelectItem>
                        <SelectItem value="httpx">httpx</SelectItem>
                        <SelectItem value="masscan">Masscan</SelectItem>
                        <SelectItem value="nuclei">Nuclei</SelectItem>
                        <SelectItem value="metasploit">Metasploit</SelectItem>
                        <SelectItem value="sqlmap">SQLMap</SelectItem>
                        <SelectItem value="nikto">Nikto</SelectItem>
                        <SelectItem value="ffuf">FFuF</SelectItem>
                        <SelectItem value="custom">Custom Module</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {isExploitBlocked && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>EXPLOIT phase selected but target does not have Active Mode enabled. Request denied by policy engine.</span>
              </div>
            )}

            <DialogFooter className="mt-6 pt-4 border-t border-border">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>ABORT</Button>
              <Button type="submit" disabled={!isAuthorized || isExploitBlocked || createScan.isPending}>
                EXECUTE_JOB
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function Scans() {
  const [location] = useLocation()
  const searchParams = new URLSearchParams(location.split('?')[1] || '')
  
  const statusParam = searchParams.get('status') || undefined
  const targetIdParam = searchParams.get('targetId') ? parseInt(searchParams.get('targetId')!) : undefined
  
  const { data: scans } = useListScans({ status: statusParam, targetId: targetIdParam })

  if (!scans) return <div className="p-8 text-primary font-mono text-sm animate-pulse">FETCHING_SCAN_LOGS()...</div>

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <Radar className="w-6 h-6" />
            SCAN_JOBS
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Monitor and manage active scanning operations</p>
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" className="font-mono h-10 border-dashed">
            <Filter className="w-4 h-4 mr-2" />
            FILTER
          </Button>
          <StartScanDialog />
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">ID</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Tool</TableHead>
                <TableHead>Phase</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Findings</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scans.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    NO_SCANS_LOGGED
                  </TableCell>
                </TableRow>
              ) : (
                scans.map(scan => (
                  <TableRow key={scan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/scans/${scan.id}`}>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      JOB-{scan.id.toString().padStart(4, '0')}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col">
                        <span className="font-bold font-mono text-sm text-foreground">{scan.targetHost}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">{scan.scopeName}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="bg-muted/50 px-2 py-1 border border-border text-xs font-mono uppercase">
                        {scan.tool}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Badge variant={scan.phase}>{scan.phase}</Badge>
                    </TableCell>
                    <TableCell>
                      <StatusIndicator status={scan.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs font-mono">
                      {scan.startedAt ? format(new Date(scan.startedAt), "MM/dd HH:mm") : "-"}
                      {scan.completedAt ? " - " + format(new Date(scan.completedAt), "HH:mm") : ""}
                    </TableCell>
                    <TableCell className="text-right">
                      {scan.findingCount !== undefined && scan.findingCount > 0 ? (
                        <Badge variant="outline" className="text-destructive border-destructive/30">
                          {scan.findingCount}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">-</span>
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
