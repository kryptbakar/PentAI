import { useGetScope, useListTargets, useCreateTarget, useListScans } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge, StatusIndicator } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Shield, Target, Plus, ChevronRight, Server, AlertTriangle, ArrowLeft, Radar } from "lucide-react"
import { Link, useParams } from "wouter"
import { format } from "date-fns"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage, FormDescription } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { useQueryClient } from "@tanstack/react-query"
import { getListTargetsQueryKey, getGetScopeQueryKey } from "@workspace/api-client-react"

const targetSchema = z.object({
  host: z.string().min(1, "Hostname or IP is required"),
  ip: z.string().optional(),
  portRange: z.string().optional(),
  allowed: z.boolean().default(true),
  activeModeEnabled: z.boolean().default(false),
  notes: z.string().optional()
})

type TargetFormValues = z.infer<typeof targetSchema>

export default function ScopeDetail() {
  const { id } = useParams()
  const scopeId = parseInt(id || "0", 10)
  
  const { data: scope } = useGetScope(scopeId, { query: { enabled: !!scopeId, queryKey: getGetScopeQueryKey(scopeId) } })
  const { data: targets } = useListTargets({ scopeId }, { query: { enabled: !!scopeId, queryKey: getListTargetsQueryKey({ scopeId }) } })
  const { data: scans } = useListScans({ scopeId }, { query: { enabled: !!scopeId, queryKey: ['scans', { scopeId }] } })
  
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const createTarget = useCreateTarget()
  
  const form = useForm<TargetFormValues>({
    resolver: zodResolver(targetSchema),
    defaultValues: {
      host: "",
      ip: "",
      portRange: "1-65535",
      allowed: true,
      activeModeEnabled: false,
      notes: ""
    }
  })

  function onSubmit(data: TargetFormValues) {
    createTarget.mutate({ data: { ...data, scopeId } }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListTargetsQueryKey({ scopeId }) })
        queryClient.invalidateQueries({ queryKey: getGetScopeQueryKey(scopeId) })
        setOpen(false)
        form.reset()
      }
    })
  }

  if (!scope) return <div className="p-8 text-muted-foreground text-sm animate-pulse">Loading scope…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <Link href="/scopes" className="p-2 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <Shield className="w-6 h-6" />
              {scope.name}
            </h1>
            <Badge variant={scope.roeActive ? "default" : "destructive"}>
              {scope.roeActive ? "RoE active" : "RoE inactive"}
            </Badge>
          </div>
          <p className="text-muted-foreground text-sm mt-1">Scope details and targets</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="md:col-span-1">
          <CardHeader>
            <CardTitle className="text-sm">Scope details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Signed By</div>
              <div className="font-mono text-sm bg-muted/30 p-2 border border-border">{scope.signedBy}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Validity Period</div>
              <div className="font-mono text-sm bg-muted/30 p-2 border border-border">
                {scope.validFrom ? format(new Date(scope.validFrom), "yyyy-MM-dd") : "N/A"} 
                {" TO "} 
                {scope.validUntil ? format(new Date(scope.validUntil), "yyyy-MM-dd") : "NEVER"}
              </div>
            </div>
            <div>
              <div className="text-[10px] uppercase font-mono text-muted-foreground mb-1">Description</div>
              <div className="font-mono text-sm bg-muted/30 p-2 border border-border min-h-[80px] whitespace-pre-wrap">
                {scope.description || "No description."}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm">Authorized targets</CardTitle>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="font-mono h-8">
                  <Plus className="w-3 h-3 mr-2" />
                  Add target
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add target to scope</DialogTitle>
                </DialogHeader>
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="host"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Target Host/Domain</FormLabel>
                          <FormControl>
                            <Input placeholder="e.g. internal.corp.net" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="grid grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="ip"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>IP Address (Optional)</FormLabel>
                            <FormControl>
                              <Input placeholder="e.g. 10.0.0.1" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="portRange"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Port Range</FormLabel>
                            <FormControl>
                              <Input placeholder="1-65535" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                    
                    <div className="space-y-4 border border-border p-4 bg-muted/10">
                      <FormField
                        control={form.control}
                        name="allowed"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Target is IN-SCOPE</FormLabel>
                              <FormDescription className="font-mono text-[10px]">
                                If unchecked, target is explicitly marked as out-of-bounds (do not touch).
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="activeModeEnabled"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel className="text-destructive flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" /> ACTIVE EXPLOITATION ALLOWED
                              </FormLabel>
                              <FormDescription className="font-mono text-[10px]">
                                Authorizes destructive/active attacks against this specific target.
                              </FormDescription>
                            </div>
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Notes / Specific Instructions</FormLabel>
                          <FormControl>
                            <Textarea placeholder="Specific caveats for this target..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <DialogFooter>
                      <Button type="button" variant="outline" onClick={() => setOpen(false)}>CANCEL</Button>
                      <Button type="submit" disabled={createTarget.isPending}>Save target</Button>
                    </DialogFooter>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent className="p-0">
            {targets && targets.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Host / IP</TableHead>
                    <TableHead>Ports</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Permissions</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {targets.map(target => (
                    <TableRow key={target.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Server className="w-4 h-4 text-muted-foreground" />
                          <div className="flex flex-col">
                            <span className="font-bold">{target.host}</span>
                            {target.ip && <span className="text-[10px] text-muted-foreground">{target.ip}</span>}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{target.portRange || "ALL"}</TableCell>
                      <TableCell>
                        {target.allowed ? (
                          <Badge variant="default" className="bg-green-500/10 text-green-500 hover:bg-green-500/20 border-transparent">ALLOWED</Badge>
                        ) : (
                          <Badge variant="destructive" className="bg-red-500/10 text-red-500 hover:bg-red-500/20 border-transparent">BLOCKED</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {target.activeModeEnabled && target.allowed && (
                          <span className="flex items-center gap-1 text-[10px] text-destructive font-bold uppercase">
                            <AlertTriangle className="w-3 h-3" /> ACTIVE EXPLOIT
                          </span>
                        )}
                        {!target.activeModeEnabled && target.allowed && (
                          <span className="text-[10px] text-muted-foreground uppercase">Recon Only</span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/scans?targetId=${target.id}`}>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                            <ChevronRight className="w-4 h-4" />
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center">
                <Target className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-muted-foreground font-mono text-sm">No targets in scope</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="md:col-span-3">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Radar className="w-4 h-4" />
              Scan history
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {scans && scans.length > 0 ? (
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
                  {scans.map(scan => (
                    <TableRow key={scan.id} className="cursor-pointer hover:bg-muted/50" onClick={() => window.location.href = `/scans/${scan.id}`}>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        JOB-{scan.id.toString().padStart(4, '0')}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col">
                          <span className="font-bold font-mono text-sm text-foreground">{scan.targetHost}</span>
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
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="p-8 text-center">
                <Radar className="w-8 h-8 text-muted mx-auto mb-2" />
                <p className="text-muted-foreground font-mono text-sm">No scans for this scope</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
