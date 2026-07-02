import { useGetFinding } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ShieldAlert, ArrowLeft, Terminal, FileCode2, Zap, Server, Code } from "lucide-react"
import { Link, useParams } from "wouter"
import { format } from "date-fns"

export default function FindingDetail() {
  const { id } = useParams()
  const findingId = parseInt(id || "0", 10)
  
  const { data: finding } = useGetFinding(findingId, { query: { enabled: !!findingId, queryKey: ['finding', findingId] } })

  if (!finding) return <div className="p-8 text-muted-foreground text-sm animate-pulse">Loading finding…</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 border-b border-border pb-4">
        <Link href="/findings" className="p-2 hover:bg-muted/50 rounded-sm text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div className="flex-1 min-w-0">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <Badge variant={finding.severity as any} className="w-fit text-sm px-3 py-1">
              {finding.severity}
            </Badge>
            <h1 className="text-xl md:text-2xl font-bold font-display text-foreground truncate" title={finding.title}>
              {finding.title}
            </h1>
          </div>
          <div className="flex items-center gap-4 mt-2 text-xs font-mono text-muted-foreground">
            <span className="flex items-center gap-1"><Server className="w-3 h-3" /> {finding.targetHost}</span>
            <span className="flex items-center gap-1"><Terminal className="w-3 h-3" /> {finding.tool}</span>
            <span>{format(new Date(finding.createdAt), "yyyy-MM-dd HH:mm:ss")}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="bg-muted/20 border-b border-border">
              <CardTitle className="text-sm flex items-center gap-2">
                <FileCode2 className="w-4 h-4" />
                Description
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="prose prose-invert max-w-none prose-p:text-foreground prose-p:leading-relaxed prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border prose-pre:rounded-none">
                {finding.description ? (
                  <p className="whitespace-pre-wrap">{finding.description}</p>
                ) : (
                  <p className="text-muted-foreground font-mono text-sm italic">No detailed description provided by the tool.</p>
                )}
              </div>
            </CardContent>
          </Card>

          {finding.evidence && (
            <Card className="border-destructive/30 overflow-hidden">
              <CardHeader className="bg-destructive/10 border-b border-destructive/20">
                <CardTitle className="text-sm flex items-center gap-2 text-destructive">
                  <Zap className="w-4 h-4" />
                  Proof of concept
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <pre className="p-4 text-xs font-mono text-green-400 bg-black overflow-x-auto m-0">
                  {finding.evidence}
                </pre>
              </CardContent>
            </Card>
          )}

          {finding.remediation && (
            <Card>
              <CardHeader className="bg-muted/20 border-b border-border">
                <CardTitle className="text-sm flex items-center gap-2 text-primary">
                  <ShieldAlert className="w-4 h-4" />
                  Remediation
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="prose prose-invert max-w-none">
                  <p className="whitespace-pre-wrap text-sm text-foreground">{finding.remediation}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">METADATA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">CVE References</div>
                {finding.cveRefs && finding.cveRefs.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {finding.cveRefs.map(cve => (
                      <a 
                        key={cve} 
                        href={`https://nvd.nist.gov/vuln/detail/${cve}`}
                        target="_blank"
                        rel="noreferrer"
                        className="bg-muted px-2 py-1 text-xs font-mono border border-border hover:border-primary hover:text-primary transition-colors"
                      >
                        {cve}
                      </a>
                    ))}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs font-mono">No CVE mappings</span>
                )}
              </div>
              
              <div className="pt-4 border-t border-border">
                <div className="text-[10px] uppercase font-mono text-muted-foreground mb-2">Origin Scan Job</div>
                <Link href={`/scans/${finding.scanId}`}>
                  <Button variant="outline" className="w-full font-mono text-xs justify-between">
                    <span>JOB-{finding.scanId.toString().padStart(4, '0')}</span>
                    <ArrowLeft className="w-3 h-3 rotate-180" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          {finding.raw && (
            <Card>
              <CardHeader className="py-3">
                <CardTitle className="text-xs flex items-center gap-2 text-muted-foreground">
                  <Code className="w-3 h-3" />
                  Raw output
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 border-t border-border">
                <div className="max-h-64 overflow-y-auto bg-[#0a0a0a] p-3">
                  <pre className="text-[10px] font-mono text-muted-foreground break-all whitespace-pre-wrap">
                    {finding.raw}
                  </pre>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}
