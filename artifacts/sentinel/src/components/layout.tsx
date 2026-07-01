import * as React from "react"
import { Link, useLocation } from "wouter"
import { 
  Activity, 
  Shield, 
  Crosshair, 
  Radar, 
  AlertTriangle, 
  ScrollText, 
  FileText,
  TerminalSquare
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/", label: "Dashboard", icon: Activity },
  { href: "/scopes", label: "Scopes", icon: Shield },
  { href: "/targets", label: "Targets", icon: Crosshair },
  { href: "/scans", label: "Scans", icon: Radar },
  { href: "/findings", label: "Findings", icon: AlertTriangle },
  { href: "/audit", label: "Audit Log", icon: ScrollText },
  { href: "/reports", label: "Reports", icon: FileText },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation()

  return (
    <div className="flex min-h-[100dvh] w-full bg-background flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-sidebar border-r border-sidebar-border flex-shrink-0 flex flex-col h-auto md:h-screen md:sticky md:top-0">
        <div className="h-14 flex items-center px-4 border-b border-sidebar-border text-primary font-mono font-bold tracking-tight gap-2">
          <TerminalSquare className="w-5 h-5" />
          <span>SENTINEL_OS</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="text-[10px] uppercase font-mono text-muted-foreground mb-4 tracking-widest">Modules</div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location === item.href || (item.href !== "/" && location.startsWith(item.href))
            
            return (
              <Link 
                key={item.href} 
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 text-sm font-medium transition-colors font-mono",
                  isActive 
                    ? "bg-sidebar-accent text-sidebar-accent-foreground border-l-2 border-primary" 
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground border-l-2 border-transparent"
                )}
              >
                <Icon className="w-4 h-4" />
                {item.label}
              </Link>
            )
          })}
        </nav>
        
        <div className="p-4 border-t border-sidebar-border mt-auto">
          <div className="flex items-center gap-2 text-xs font-mono text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
            </span>
            SYSTEM: ONLINE
          </div>
        </div>
      </aside>
      
      <main className="flex-1 min-w-0 flex flex-col h-auto min-h-screen">
        <div className="flex-1 p-4 md:p-8 overflow-x-hidden">
          {children}
        </div>
      </main>
    </div>
  )
}
