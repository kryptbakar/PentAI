import { useGetReport, useShareReport } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ArrowLeft, Printer, Share2, Copy } from "lucide-react"
import { Link, useParams } from "wouter"
import { format } from "date-fns"
import { useState } from "react"

export default function ReportDetail() {
  const { id } = useParams()
  const reportId = parseInt(id || "0", 10)

  const { data: report } = useGetReport(reportId, { query: { enabled: !!reportId, queryKey: ['report', reportId] } })
  const share = useShareReport()
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  if (!report) return <div className="p-8 text-muted-foreground text-sm animate-pulse">Loading report…</div>

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div className="flex items-center gap-4">
          <Link href="/reports" className="p-2 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
              <FileText className="w-6 h-6" />
              REPORT ARTIFACT: RPT-{report.id.toString().padStart(4, '0')}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">Generated {format(new Date(report.generatedAt), "yyyy-MM-dd HH:mm:ss")} UTC</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={share.isPending}
            onClick={() =>
              share.mutate(
                { id: reportId },
                { onSuccess: (r) => setShareUrl(`${window.location.origin}${r.url}`) },
              )
            }
          >
            <Share2 className="w-4 h-4 mr-2" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="w-4 h-4 mr-2" /> Print
          </Button>
        </div>
      </div>

      {shareUrl && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/25 bg-primary/5 px-4 py-3">
          <span className="text-xs text-muted-foreground">Public link:</span>
          <code className="flex-1 truncate font-mono text-xs text-foreground">{shareUrl}</code>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => navigator.clipboard?.writeText(shareUrl)}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card className="bg-card print:shadow-none print:border-none">
        <CardHeader className="text-center border-b border-border pb-8 pt-8">
          <div className="font-mono text-xs text-destructive tracking-widest uppercase mb-4">
            CONFIDENTIAL / AUTHORIZED PERSONNEL ONLY
          </div>
          <CardTitle className="text-3xl font-serif tracking-tight mb-2 text-foreground">
            Security Assessment Report
          </CardTitle>
          <div className="text-xl font-mono text-muted-foreground">
            Target: {report.targetHost}
          </div>
        </CardHeader>
        <CardContent className="p-8 md:p-12 space-y-8">
          
          <section>
            <h3 className="text-lg font-bold font-display text-foreground border-b border-border/50 pb-2 mb-4 uppercase tracking-wider">
              1. Executive Summary
            </h3>
            <div className="prose prose-invert max-w-none text-foreground leading-relaxed">
              <p className="whitespace-pre-wrap">{report.summary || "No executive summary provided."}</p>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold font-display text-foreground border-b border-border/50 pb-2 mb-4 uppercase tracking-wider">
              2. Assessment Parameters
            </h3>
            <div className="grid grid-cols-2 gap-4 font-mono text-sm">
              <div className="border border-border p-4 bg-muted/10">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">Format</div>
                <div className="uppercase">{report.format}</div>
              </div>
              <div className="border border-border p-4 bg-muted/10">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">Source Job ID</div>
                <div>JOB-{report.scanId.toString().padStart(4, '0')}</div>
              </div>
              <div className="border border-border p-4 bg-muted/10">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">Vulnerabilities Detected</div>
                <div className="text-destructive font-bold">{report.findingCount} FINDINGS</div>
              </div>
              <div className="border border-border p-4 bg-muted/10">
                <div className="text-muted-foreground mb-1 text-[10px] uppercase">Timestamp</div>
                <div>{format(new Date(report.generatedAt), "yyyy-MM-dd HH:mm:ss")}</div>
              </div>
            </div>
          </section>

          <section>
            <h3 className="text-lg font-bold font-display text-foreground border-b border-border/50 pb-2 mb-4 uppercase tracking-wider">
              3. Raw Output Artifact
            </h3>
            <div className="bg-black border border-border p-4 rounded-none overflow-x-auto">
              <pre className="text-[10px] font-mono text-green-400">
{report.format === 'json' ? 
`{
  "reportId": ${report.id},
  "scanId": ${report.scanId},
  "target": "${report.targetHost}",
  "findingsTotal": ${report.findingCount},
  "timestamp": "${report.generatedAt}",
  "summary": ${JSON.stringify(report.summary)}
}` : 
`<!-- HTML Artifact Stub -->
<div class="report-data">
  <h1>Scan Data Extract</h1>
  <p>Refer to system DB for full payload mapping.</p>
  <p>Findings Count: ${report.findingCount}</p>
</div>`
}
              </pre>
            </div>
          </section>

        </CardContent>
      </Card>
    </div>
  )
}
