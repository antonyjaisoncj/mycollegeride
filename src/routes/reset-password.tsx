import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password — College Bus Management" },
      { name: "description", content: "Choose a new password for your College Bus Management account." },
      { property: "og:title", content: "Reset password — College Bus Management" },
      { property: "og:description", content: "Securely reset your College Bus Management password." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const recoveryHash = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setRecoveryReady(recoveryHash || Boolean(data.session));
      setChecking(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setRecoveryReady(true);
        setChecking(false);
      }
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function updatePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Password updated. You can now sign in.");
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-primary px-4 py-12">
      <section className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-lg">
        <Bus className="h-8 w-8 text-primary" />
        <h1 className="mt-4 text-2xl font-semibold text-card-foreground">Choose a new password</h1>
        {checking ? (
          <p className="mt-3 text-sm text-muted-foreground">Checking your reset link…</p>
        ) : recoveryReady ? (
          <form onSubmit={updatePassword} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input id="new-password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input id="confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
            </div>
            <Button type="submit" className="w-full" disabled={busy}>
              {busy ? "Updating…" : "Update password"}
            </Button>
          </form>
        ) : (
          <div className="mt-4">
            <p className="text-sm text-muted-foreground">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Button className="mt-5 w-full" onClick={() => navigate({ to: "/auth" })}>Return to sign in</Button>
          </div>
        )}
      </section>
    </main>
  );
}