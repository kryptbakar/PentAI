import * as React from "react"
import { Link, useLocation } from "wouter"
import {
  LayoutDashboard,
  ShieldCheck,
  Crosshair,
  Radar,
  AlertTriangle,
  ScrollText,
  FileText,
  ShieldHalf,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { QuickAssessDialog } from "@/components/quick-assess"

const navItems = [
  { href: "/", label: "Command Center", icon: LayoutDashboard },
  { href: "/scopes", label: "Scopes & RoE", icon: ShieldCheck },
  { href: "/targets", label: "Targets", icon: Crosshair },
  { href: "/scans", label: "Scans", icon: Radar },
  { href: "/findings", label: "Findings", icon: AlertTriangle },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileText },
]

function sectionLabel(location: string) {
  if (location === "/") return "Command Center"
  const match = navItems.find(
    (item) => item.href !== "/" && location.startsWith(item.href),
  )
  return match?.label ?? "PentAI"
}

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex min-h-[100dvh] w-full flex-col md:flex-row">
      <aside className="glass flex w-full flex-shrink-0 flex-col md:sticky md:top-0 md:h-screen md:w-72 md:border-r md:border-sidebar-border">
        {/* Brand */}
        <div className="flex h-16 items-center gap-3 px-6">
          <div className="ring-glow flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-fuchsia-500 text-white">
            <ShieldHalf className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <div className="font-display text-lg font-bold tracking-tight">
              <span className="text-gradient">PentAI</span>
            </div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              Autonomous Pentest
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-4">
          <div className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
            Operations
          </div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive =
              location === item.href ||
              (item.href !== "/" && location.startsWith(item.href))

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                  isActive
                    ? "bg-gradient-to-r from-primary/20 to-transparent text-foreground"
                    : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_12px_hsl(266_90%_66%)]" />
                )}
                <Icon
                  className={cn(
                    "h-[18px] w-[18px] transition-colors",
                    isActive ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
                  )}
                />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t border-sidebar-border/60 p-4">
          <div className="flex items-center justify-between rounded-xl bg-secondary/40 px-3 py-2.5">
            <div className="flex items-center gap-2.5">
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="text-xs font-medium text-foreground">Engine online</span>
            </div>
            <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary">
              v1.0
            </span>
          </div>
        </div>
      </aside>

      <main className="flex min-h-screen flex-1 flex-col">
        {/* Topbar */}
        <header className="glass sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-border/60 px-4 md:px-8">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">PentAI</span>
            <span className="text-border">/</span>
            <span className="font-medium text-foreground">{sectionLabel(location)}</span>
          </div>
          <QuickAssessDialog />
        </header>

        <div className="flex-1 overflow-x-hidden p-4 md:p-8">{children}</div>
      </main>
    </div>
  )
}
