import { useListScopes, useCreateScope } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, Plus, Lock } from "lucide-react"
import { Link } from "wouter"
import { format } from "date-fns"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Checkbox } from "@/components/ui/checkbox"
import { useQueryClient } from "@tanstack/react-query"
import { getListScopesQueryKey } from "@workspace/api-client-react"

const scopeSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  signedBy: z.string().min(1, "Signatory is required"),
  roeActive: z.boolean().default(true),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
})

type ScopeFormValues = z.infer<typeof scopeSchema>

function CreateScopeDialog() {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const createScope = useCreateScope()
  
  const form = useForm<ScopeFormValues>({
    resolver: zodResolver(scopeSchema),
    defaultValues: {
      name: "",
      description: "",
      signedBy: "",
      roeActive: true,
      validFrom: new Date().toISOString().slice(0,10),
      validUntil: "",
    }
  })

  function onSubmit(data: ScopeFormValues) {
    createScope.mutate({ data }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListScopesQueryKey() })
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
          NEW_SCOPE
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>DEFINE_AUTHORIZATION_SCOPE</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Scope Name / Code Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. OP_BLACKOUT" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="signedBy"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Authorized By (Signatory)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. CISO Jane Doe" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rules of Engagement Summary</FormLabel>
                  <FormControl>
                    <Textarea placeholder="Scope limitations, off-limit targets, etc..." {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="validFrom"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid From</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="validUntil"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valid Until</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="roeActive"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-none border p-4">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel>RoE Active</FormLabel>
                    <p className="text-xs text-muted-foreground font-mono">
                      Activate Rules of Engagement authorization
                    </p>
                  </div>
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>CANCEL</Button>
              <Button type="submit" disabled={createScope.isPending}>AUTHORIZE_SCOPE</Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}

export default function Scopes() {
  const { data: scopes } = useListScopes()

  if (!scopes) return <div className="p-8 text-primary font-mono text-sm animate-pulse">FETCHING_SCOPES()...</div>

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between border-b border-border pb-4">
        <div>
          <h1 className="text-2xl font-bold font-mono text-primary flex items-center gap-2">
            <Shield className="w-6 h-6" />
            AUTHORIZATION_SCOPES
          </h1>
          <p className="text-muted-foreground text-sm font-mono mt-1">Manage Rules of Engagement (RoE) and scan boundaries</p>
        </div>
        <CreateScopeDialog />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {scopes.map(scope => (
          <Link key={scope.id} href={`/scopes/${scope.id}`}>
            <Card className="hover:bg-accent/20 transition-colors cursor-pointer group h-full flex flex-col relative overflow-hidden">
              {!scope.roeActive && (
                <div className="absolute top-0 right-0 p-1 bg-destructive/20 text-destructive text-[10px] font-mono font-bold border-l border-b border-destructive/20 uppercase">
                  Inactive
                </div>
              )}
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <span className="truncate pr-2">{scope.name}</span>
                  <Lock className={`w-4 h-4 flex-shrink-0 ${scope.roeActive ? 'text-primary' : 'text-muted-foreground'}`} />
                </CardTitle>
                <div className="flex items-center gap-2 text-xs font-mono mt-2">
                  <span className="text-muted-foreground">SIGNED_BY:</span>
                  <span className="text-foreground truncate">{scope.signedBy}</span>
                </div>
              </CardHeader>
              <CardContent className="flex-1 pb-4">
                <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                  {scope.description || "No description provided."}
                </p>
                <div className="grid grid-cols-2 gap-2 text-xs font-mono mt-auto">
                  <div className="bg-muted/30 p-2 rounded-sm border border-border">
                    <div className="text-muted-foreground mb-1 text-[10px] uppercase">Targets</div>
                    <div className="font-bold">{scope.targetCount || 0}</div>
                  </div>
                  <div className="bg-muted/30 p-2 rounded-sm border border-border">
                    <div className="text-muted-foreground mb-1 text-[10px] uppercase">Expires</div>
                    <div className="font-bold">{scope.validUntil ? format(new Date(scope.validUntil), "yyyy-MM-dd") : "NEVER"}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {scopes.length === 0 && (
          <div className="col-span-full p-12 text-center border border-dashed border-border">
            <Shield className="w-12 h-12 text-muted mx-auto mb-4" />
            <p className="text-muted-foreground font-mono text-sm mb-4">NO_AUTHORIZATION_SCOPES_FOUND</p>
            <CreateScopeDialog />
          </div>
        )}
      </div>
    </div>
  )
}
