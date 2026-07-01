import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter } from 'wouter';
import { Layout } from '@/components/layout';

import Dashboard from '@/pages/dashboard';
import Scopes from '@/pages/scopes';
import ScopeDetail from '@/pages/scopes-detail';
import Targets from '@/pages/targets';
import Scans from '@/pages/scans';
import ScanDetail from '@/pages/scans-detail';
import Findings from '@/pages/findings';
import FindingDetail from '@/pages/findings-detail';
import AuditLog from '@/pages/audit';
import Reports from '@/pages/reports';
import ReportDetail from '@/pages/reports-detail';

const queryClient = new QueryClient();

function Router() {
  return (
    <Layout>
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
