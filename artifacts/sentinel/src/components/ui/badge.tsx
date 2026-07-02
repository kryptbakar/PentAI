import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        critical: "border-transparent bg-red-500/10 text-red-500 border-red-500/20",
        high: "border-transparent bg-orange-500/10 text-orange-500 border-orange-500/20",
        medium: "border-transparent bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
        low: "border-transparent bg-blue-500/10 text-blue-500 border-blue-500/20",
        info: "border-transparent bg-gray-500/10 text-gray-400 border-gray-500/20",
        recon: "border-transparent bg-purple-500/10 text-purple-400 border-purple-500/20 uppercase tracking-wider text-[10px]",
        scan: "border-transparent bg-cyan-500/10 text-cyan-400 border-cyan-500/20 uppercase tracking-wider text-[10px]",
        exploit: "border-transparent bg-red-500/10 text-red-400 border-red-500/20 uppercase tracking-wider text-[10px]",
        intel: "border-transparent bg-green-500/10 text-green-400 border-green-500/20 uppercase tracking-wider text-[10px]",
        queued: "border-transparent bg-gray-500/10 text-gray-400 border-gray-500/20 uppercase tracking-wider text-[10px]",
        completed: "border-transparent bg-green-500/10 text-green-400 border-green-500/20 uppercase tracking-wider text-[10px]",
        failed: "border-transparent bg-red-500/10 text-red-400 border-red-500/20 uppercase tracking-wider text-[10px]",
        cancelled: "border-transparent bg-muted text-muted-foreground border-muted-foreground/20 uppercase tracking-wider text-[10px]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export function StatusIndicator({ status }: { status: string }) {
  if (status === 'running') {
    return (
      <div className="flex items-center gap-2">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
        </span>
        <span className="text-green-400 text-xs font-semibold uppercase tracking-wider">Running</span>
      </div>
    )
  }
  return <Badge variant={status as any}>{status}</Badge>
}

export { Badge, badgeVariants }
