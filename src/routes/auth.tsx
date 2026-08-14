import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Bus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in — College Bus Management System" },
      {
        name: "description",
        content:
          "Sign in or create an account to register for the college bus, pay your monthly fee or manage the transport office.",
      },
      { property: "og:title", content: "Sign in — College Bus Management System" },
      {
        property: "og:description",
        content: "Access your bus registration, fee dues and payment history.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [screen, setScreen] = useState<"auth" | "forgot">("auth");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setBusy(false);
    if (error) {
      toast.error(
        error.code === "invalid_credentials"
          ? "Incorrect email or password. If you created this account with Google, use Continue with Google."
          : error.message,
      );
      return;
    }
    navigate({ to: "/dashboard", replace: true });
  }

  async function signUp(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    setBusy(true);
    const normalizedEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth` },
    });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    if (data.session) {
      setBusy(false);
      toast.success("Account created. Submit your bus registration below.");
      navigate({ to: "/dashboard", replace: true });
      return;
    }
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });
    setBusy(false);
    if (signInError) {
      toast.error(signInError.message);
      return;
    }
    toast.success("Account created. Submit your bus registration below.");
    navigate({ to: "/dashboard", replace: true });
  }

  async function sendPasswordReset(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Check your email for the password reset link");
    setScreen("auth");
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Google sign-in failed. Please try again.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/dashboard", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-primary px-4 py-12">
      <div className="w-full max-w-md">
        <Link
          to="/"
          className="mb-6 flex items-center justify-center gap-2 text-primary-foreground"
        >
          <Bus className="h-6 w-6 text-accent" />
          <span className="text-lg font-semibold">Bus Management</span>
        </Link>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-lg">
          {screen === "forgot" ? (
            <div>
              <h1 className="text-xl font-semibold text-card-foreground">Reset your password</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Enter your email and we will send you a secure reset link.
              </p>
              <form onSubmit={sendPasswordReset} className="mt-6 space-y-4">
                <Field id="reset-email" label="Email" type="email" value={email} onChange={setEmail} />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Sending…" : "Send reset link"}
                </Button>
              </form>
              <Button variant="ghost" className="mt-2 w-full" onClick={() => setScreen("auth")}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to sign in
              </Button>
            </div>
          ) : (
          <>
          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Sign in</TabsTrigger>
              <TabsTrigger value="signup">Create account</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={signIn} className="mt-4 space-y-4">
                <Field id="si-email" label="Email" type="email" value={email} onChange={setEmail} />
                <Field
                  id="si-pass"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Signing in…" : "Sign in"}
                </Button>
                <Button
                  type="button"
                  variant="link"
                  className="w-full"
                  onClick={() => setScreen("forgot")}
                >
                  Forgot password?
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={signUp} className="mt-4 space-y-4">
                <Field id="su-email" label="Email" type="email" value={email} onChange={setEmail} />
                <Field
                  id="su-pass"
                  label="Password"
                  type="password"
                  value={password}
                  onChange={setPassword}
                />
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy ? "Creating…" : "Create account"}
                </Button>
                <p className="text-xs text-muted-foreground">
                  After creating an account you can submit your bus registration. The transport
                  office approves it and assigns your roll number.
                </p>
              </form>
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3 text-xs uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>

          <Button variant="outline" className="w-full" onClick={google}>
            Continue with Google
          </Button>
          </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({
  id,
  label,
  type,
  value,
  onChange,
}: {
  id: string;
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type={type}
        value={value}
        required
        autoComplete={type === "password" ? "current-password" : "email"}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
