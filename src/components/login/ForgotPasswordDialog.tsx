import { useEffect, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { toast } from "sonner";
import { forgotPassword } from "@/lib/profile-api";
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

/** "Reset your password": emails a reset link. Opened from the login page and
 *  from a reset page whose link has expired. */
export function ForgotPasswordDialog({
  open,
  onOpenChange,
  defaultEmail = "",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pre-fills the email each time the dialog opens. */
  defaultEmail?: string;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setEmail(defaultEmail);
  }, [open, defaultEmail]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Enter your email address.");
      return;
    }
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      onOpenChange(false);
      toast.success(`If an account exists for ${email.trim()}, a reset link has been sent.`);
      setEmail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to send reset link.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Reset your password</DialogTitle>
          <DialogDescription>
            Enter the email associated with your account and we'll send you a password reset link.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="forgot-email">Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="forgot-email"
                type="email"
                placeholder="you@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
