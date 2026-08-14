import { Bus, LogOut } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function AppHeader({ subtitle, email }: { subtitle: string; email?: string | null }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="border-b border-border bg-primary text-primary-foreground">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-6 py-4">
        <div className="flex items-center gap-3">
          <Bus className="h-6 w-6 text-accent" />
          <div>
            <p className="text-base font-semibold leading-tight">Bus Management</p>
            <p className="text-xs text-primary-foreground/70">{subtitle}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {email ? (
            <span className="hidden text-sm text-primary-foreground/80 sm:inline">{email}</span>
          ) : null}
          <Button variant="secondary" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign out
          </Button>
        </div>
      </div>
    </header>
  );
}
