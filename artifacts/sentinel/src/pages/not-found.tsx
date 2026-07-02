import { AlertCircle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function NotFound() {
  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center bg-background">
      <Card className="w-full max-w-md mx-4 border-destructive/50">
        <CardContent className="pt-6">
          <div className="flex mb-4 gap-2">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <h1 className="text-2xl font-bold font-mono text-foreground">Page not found</h1>
          </div>

          <p className="mt-4 text-sm font-mono text-muted-foreground">
            The requested module or resource could not be located in the current operation scope.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
