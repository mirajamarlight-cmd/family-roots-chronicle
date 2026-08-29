import { Eye, EyeOff, Loader2 } from "lucide-react";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";

import { BuiltByRaafat } from "@/components/brand/built-by-raafat";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { SITE_ORIGIN } from "@/lib/brand";

type AuthMode = "signin" | "signup";

async function continueWithPassword(
  mode: AuthMode,
  email: string,
  password: string,
  redirectTo: string,
) {
  if (mode === "signin") {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error("Email or password is incorrect.");
    return true;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${SITE_ORIGIN}${redirectTo}` },
  });
  if (error) throw error;
  return !!data.session;
}

export function AuthSignInCard({
  title,
  description,
  redirectTo,
  footer,
}: {
  title?: string;
  description?: string;
  redirectTo: string;
  footer?: ReactNode;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<AuthMode>("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!email.trim() || password.length < 6) {
      toast.error("Email and a password of at least 6 characters are needed.");
      return;
    }
    setBusy(true);
    try {
      const signedIn = await continueWithPassword(mode, email.trim(), password, redirectTo);
      toast.success(
        mode === "signin"
          ? "Signed in"
          : signedIn
            ? "Account created"
            : "Account created. Check your email to confirm it.",
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not continue");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="mx-auto max-w-sm leaf-shadow">
      {title && (
        <CardHeader>
          <CardTitle className="font-display">{title}</CardTitle>
        </CardHeader>
      )}
      <CardContent className={title ? undefined : "pt-6"}>
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          {description && <p className="text-sm text-muted-foreground">{description}</p>}
          <div
            className="grid grid-cols-2 rounded-xl bg-secondary/70 p-1"
            aria-label="Choose sign in or create account"
          >
            {(
              [
                ["signin", "Sign in"],
                ["signup", "Create account"],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                onClick={() => setMode(value)}
                className={
                  mode === value
                    ? "rounded-lg bg-background px-3 py-2 text-sm font-medium text-foreground shadow-sm"
                    : "rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
                }
              >
                {label}
              </button>
            ))}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-email">Email</Label>
            <Input
              id="auth-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="auth-password">Password</Label>
            <div className="relative">
              <Input
                id="auth-password"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === "signin"
                ? "Use the email and password from your existing account."
                : "Choose a password with at least 6 characters."}
            </p>
          </div>
          <Button type="submit" disabled={busy} className="w-full">
            {busy && <Loader2 className="size-4 animate-spin" aria-hidden />}
            {busy ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
          {footer}
          <BuiltByRaafat className="pt-1 text-center text-[11px] text-muted-foreground" />
        </form>
      </CardContent>
    </Card>
  );
}
