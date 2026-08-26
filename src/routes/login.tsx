import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { Lock, Mail, Loader2, ShieldCheck, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import logo from "@/assets/collectrix-logo.png";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — Collectrix Ai" },
      { name: "description", content: "Sign in to Collectrix Ai admin portal." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotLoading, setForgotLoading] = useState(false);

  useEffect(() => {
    if (isAuthenticated) navigate({ to: "/tenant" });
  }, [isAuthenticated, navigate]);

  const handleForgot = async (e: FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) {
      toast.error("Enter your email address.");
      return;
    }
    setForgotLoading(true);
    await new Promise((r) => setTimeout(r, 700));
    setForgotLoading(false);
    setForgotOpen(false);
    toast.success(`If an account exists for ${forgotEmail}, a reset link has been sent.`);
    setForgotEmail("");
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setLoading(true);
    try {
      await login(email, password);
      router.invalidate();
      navigate({ to: "/tenant" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between overflow-hidden bg-gradient-tenant text-white p-10">
        <div className="absolute inset-0 bg-gradient-glow opacity-40 pointer-events-none" />
        <motion.div className="absolute -top-16 -left-10 h-72 w-72 rounded-full blur-3xl bg-white/10"
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }} transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }} />
        <motion.div className="absolute bottom-0 right-0 h-80 w-80 rounded-full blur-3xl bg-cyan-300/20"
          animate={{ x: [0, -24, 0], y: [0, -16, 0] }} transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }} />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: "radial-gradient(circle at 1px 1px, #fff 1px, transparent 0)", backgroundSize: "22px 22px" }}
        />

        <div className="relative">
          <img src={logo} alt="Collectrix Ai" className="h-12 w-auto select-none" style={{ filter: "brightness(0) invert(1)" }} draggable={false} />
        </div>

        <motion.div
          className="relative"
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, delay: 0.1 }}
        >
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-[11px] font-semibold tracking-wide">
            <Sparkles className="h-3 w-3" /> Tenant Admin Workspace
          </span>
          <h2 className="mt-5 font-display text-4xl font-bold leading-[1.1] tracking-tight">
            Recover smarter,<br />stay compliant.
          </h2>
          <p className="mt-4 text-white/80 max-w-sm leading-relaxed">
            Manage your team, roles and customer operations from one secure, AI-assisted control center.
          </p>
        </motion.div>

        <div className="relative text-xs text-white/60">© {new Date().getFullYear()} Collectrix Ai. All rights reserved.</div>
      </div>

      {/* Form panel */}
      <div className="relative flex items-center justify-center p-6 sm:p-10">
        <div className="absolute inset-0 bg-gradient-glow opacity-50 pointer-events-none lg:hidden" />
        <motion.div
          className="relative w-full max-w-sm"
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        >
          <div className="lg:hidden mb-8 flex justify-center">
            <img src={logo} alt="Collectrix Ai" className="h-12 w-auto select-none" draggable={false} />
          </div>

          <h1 className="font-display text-2xl font-bold tracking-tight">Welcome back</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">Sign in to your tenant workspace.</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" autoComplete="email" placeholder="you@company.com"
                  value={email} onChange={(e) => setEmail(e.target.value)} className="pl-9 h-11" />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button type="button" onClick={() => { setForgotEmail(email); setForgotOpen(true); }}
                  className="text-xs font-medium text-tenant hover:underline">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="password" type="password" autoComplete="current-password" placeholder="••••••••"
                  value={password} onChange={(e) => setPassword(e.target.value)} className="pl-9 h-11" />
              </div>
            </div>

            {error && (
              <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="text-sm text-destructive" role="alert">
                {error}
              </motion.p>
            )}

            <motion.button
              type="submit" disabled={loading} whileTap={{ scale: 0.98 }}
              className="w-full h-11 inline-flex items-center justify-center gap-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing in…" : "Sign in"}
            </motion.button>
          </form>

          <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-tenant" />
            Protected workspace — authorized personnel only.
          </div>
        </motion.div>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset your password</DialogTitle>
            <DialogDescription>
              Enter the email associated with your account and we'll send you a password reset link.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgot} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input id="forgot-email" type="email" placeholder="you@company.com"
                  value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="pl-9" />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setForgotOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={forgotLoading}>{forgotLoading ? "Sending…" : "Send reset link"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
