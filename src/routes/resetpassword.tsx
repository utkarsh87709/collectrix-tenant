import { createFileRoute, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, ShieldCheck, CheckCircle2, Loader2 } from "lucide-react";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { submitResetPasswordRequest, validateResetPassword } from "@/lib/profile-api";

const searchSchema = z.object({
  resetPasswordCode: z.string().optional(),
});

export const Route = createFileRoute("/resetpassword")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Reset password — Collectrix Ai" },
      { name: "description", content: "Set a new password for your Collectrix Ai account." },
    ],
  }),
  component: ResetPasswordPage,
});

const passwordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .max(128, "Password is too long"),
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function ResetPasswordPage() {
  const { resetPasswordCode } = useSearch({ from: "/resetpassword" });
  const code = (resetPasswordCode ?? "").trim();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  // Validate the reset code against the backend before showing the form.
  const [status, setStatus] = useState<"validating" | "valid" | "invalid">(
    code ? "validating" : "invalid",
  );

  useEffect(() => {
    if (!code) return;
    let active = true;
    validateResetPassword(code)
      .then(() => {
        if (active) setStatus("valid");
      })
      .catch(() => {
        if (active) setStatus("invalid");
      });
    return () => {
      active = false;
    };
  }, [code]);

  const tokenMissing = status === "invalid";

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    const parsed = passwordSchema.safeParse({ password, confirm });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    setLoading(true);
    try {
      await submitResetPasswordRequest(code, password);
      setDone(true);
      toast.success("Password updated. You can now sign in.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to reset password. The link may have expired.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-subtle px-4 py-10">
      <div className="absolute inset-0 bg-gradient-glow pointer-events-none opacity-60" />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-md shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-display font-bold tracking-tight">Reset password</h1>
              <p className="text-xs text-muted-foreground">
                Choose a new password for your account
              </p>
            </div>
          </div>

          {status === "validating" ? (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Verifying your reset link…
            </div>
          ) : tokenMissing ? (
            <div className="space-y-4">
              <p className="text-sm text-destructive">
                This reset link is invalid or has expired. Please request a new password reset.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
                Back to sign in
              </Button>
            </div>
          ) : done ? (
            <div className="space-y-4 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                <CheckCircle2 className="h-6 w-6 text-primary" />
              </div>
              <p className="text-sm text-muted-foreground">
                Your password has been updated successfully.
              </p>
              <Button className="w-full" onClick={() => navigate({ to: "/login" })}>
                Continue to sign in
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="At least 8 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9"
                    maxLength={128}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type="password"
                    autoComplete="new-password"
                    placeholder="Re-enter password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    className="pl-9"
                    maxLength={128}
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "Updating…" : "Update password"}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
