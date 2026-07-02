import { lazy, Suspense } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';
import { Spinner } from '@/components/ui/spinner';

// Route-level code splitting — each page is its own chunk, so the initial
// bundle only loads the shell + the first route rather than all 11 pages.
const Dashboard = lazy(() => import('@/pages/dashboard'));
const Scopes = lazy(() => import('@/pages/scopes'));
const ScopeDetail = lazy(() => import('@/pages/scopes-detail'));
const Targets = lazy(() => import('@/pages/targets'));
const Scans = lazy(() => import('@/pages/scans'));
const ScanDetail = lazy(() => import('@/pages/scans-detail'));
const Findings = lazy(() => import('@/pages/findings'));
const FindingDetail = lazy(() => import('@/pages/findings-detail'));
const AuditLog = lazy(() => import('@/pages/audit'));
const Reports = lazy(() => import('@/pages/reports'));
const ReportDetail = lazy(() => import('@/pages/reports-detail'));
const NotFound = lazy(() => import('@/pages/not-found'));

const queryClient = new QueryClient();

function PageFallback() {
  return (
    <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
      <Spinner className="h-6 w-6 text-primary" />
    </div>
  );
}

function Router() {
  return (
    <Layout>
      <Suspense fallback={<PageFallback />}>
        <Switch>
          <Route path="/" component={Dashboard} />
          <Route path="/scopes" component={Scopes} />
          <Route path="/scopes/:id" component={ScopeDetail} />
          <Route path="/targets" component={Targets} />
          <Route path="/scans" component={Scans} />
          <Route path="/scans/:id" component={ScanDetail} />
          <Route path="/findings" component={Findings} />
          <Route path="/findings/:id" component={FindingDetail} />
          <Route path="/audit" component={AuditLog} />
          <Route path="/reports" component={Reports} />
          <Route path="/reports/:id" component={ReportDetail} />
          <Route component={NotFound} />
        </Switch>
      </Suspense>
    </Layout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
