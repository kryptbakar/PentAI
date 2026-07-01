import { useListReports, useGenerateReport, useListScans } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { FileText, Plus, Download, FileJson, FileCode, Check, AlertTriangle } from "lucide-react"
import { Link } from "wouter"
import { format } from "date-fns"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useQueryClient } from "@tanstack/react-query"
import { getListReportsQueryKey } from "@workspace/api-client-react"

const reportSchema = z.object({
  scanId: z.coerce.number().min(1, "Scan job is required"),
  format: z.enum(['json', 'html']),
})

type ReportFormValues = z.infer<typeof reportSchema>

function GenerateReportDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const generateReport = useGenerateReport()
  
  // Only get completed scans
  const { data: scans } = useListScans({ status: 'completed' })
  
  const form = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: {
      format: "html",
    }
  })

  function onSubmit(data: ReportFormValues) {
    generateReport.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListReportsQueryKey() })
        setOpen(false)
        form.reset()
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="gap-2 font-mono">
          <Plus className="w-4 h-4" />
          GENERATE_REPORT
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>COMPILE_SCAN_REPORT</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="scanId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Source Scan Job</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value?.toString()}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select completed scan..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {scans?.map(s => (
                        <SelectItem key={s.id} value={s.id.toString()}>
                          JOB-{s.id.toString().padStart(4,'0')} - {s.targetHost} ({format(new Date(s.completedAt!), "MM/dd HH:mm")})
                        </SelectItem>
                      ))}
                      {(!scans || scans.length === 0) && (
                        <SelectItem value="0" disabled>No completed scans available</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="format"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Output Format</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select format..." />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="html">HTML Executive Summary</SelectItem>
                      <SelectItem value="json">JSON Machine-Readable</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>CANCEL</Button>
              <Button type="submit" disabled={generateReport.isPending}>COMPILE</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function Reports() {
  const { data: reports } = useListReports()

  if (!reports) return <div className="p-8 text-primary font-mono text-sm animate-pulse">FETCHING_REPORTS()...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <FileText className="w-6 h-6" />
            ENGAGEMENT_REPORTS
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Generated artifacts and summaries</p>
        </div>
        <GenerateReportDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {reports.length === 0 ? (
          <div className="col-span-full p-12 text-center border border-dashed border-border">
            <FileText className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted-foreground font-mono text-sm mb-4">NO_REPORTS_GENERATED</p>
            <GenerateReportDialog />
          </div>
        ) : (
          reports.map(report => (
            <Card key={report.id} className="flex flex-col relative group">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="flex items-center justify-between text-base">
                  <span className="truncate pr-2">RPT-{report.id.toString().padStart(4, '0')}</span>
                  {report.format === 'json' ? (
                    <Badge variant="outline" className="font-mono text-[10px] bg-yellow-500/10 text-yellow-500 border-yellow-500/20">JSON</Badge>
                  ) : (
                    <Badge variant="outline" className="font-mono text-[10px] bg-blue-500/10 text-blue-500 border-blue-500/20">HTML</Badge>
                  )}
                </CardTitle>
                <div className="text-xs font-mono text-muted-foreground mt-1">
                  Target: {report.targetHost}
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col pt-4">
                <div className="text-xs text-foreground mb-4 line-clamp-3">
                  {report.summary || "Automated scan output compilation."}
                </div>
                
                <div className="mt-auto space-y-4">
                  <div className="flex items-center justify-between text-[10px] font-mono text-muted-foreground">
                    <span>Generated: {format(new Date(report.generatedAt), "yyyy-MM-dd HH:mm")}</span>
                    <span className="flex items-center gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3" />
                      {report.findingCount} Findings
                    </span>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 font-mono text-xs h-8" disabled>
                      <Download className="w-3 h-3 mr-2" />
                      DOWNLOAD
                    </Button>
                    <Link href={`/reports/${report.id}`} className="flex-1">
                      <Button className="w-full font-mono text-xs h-8">
                        VIEW
                      </Button>
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
