import { createFileRoute, useNavigate, useSearch, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import {
  ShieldCheck, CheckCircle2, Building2, CreditCard, MapPin,
  ArrowRight, ArrowLeft, Lock, Loader2, User, Mail, Smartphone,
  Package as PackageIcon, Database, Users as UsersIcon, ListChecks, AlertTriangle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  getInviteCodeDetails,
  makePayment,
  completeTenantInviteOnboard,
  type InviteDetails,
} from "@/lib/onboard-api";

const searchSchema = z.object({
  inviteCode: z.string().optional(),
});

export const Route = createFileRoute("/tenantinvite")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({ meta: [{ title: "Complete tenant setup — Collectrix Ai" }] }),
  component: TenantInvitePage,
});

const STEPS = [
  { id: 1, label: "Account", icon: Building2 },
  { id: 2, label: "Billing", icon: MapPin },
  { id: 3, label: "Payment", icon: CreditCard },
];

function TenantInvitePage() {
  const { inviteCode } = useSearch({ from: "/tenantinvite" });
  const code = (inviteCode ?? "").trim();
  const navigate = useNavigate();

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!code) {
      setLoading(false);
      setLoadError("No invite code provided. Please use the link from your invitation email.");
      return;
    }
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const details = await getInviteCodeDetails(code);
        if (!cancelled) setInvite(details);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "This invite link is invalid or has expired.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (loading) {
    return (
      <CenteredShell>
        <Loader2 className="h-8 w-8 animate-spin text-tenant" />
        <p className="text-sm text-muted-foreground mt-4">Loading your invitation…</p>
      </CenteredShell>
    );
  }

  if (loadError || !invite) {
    return (
      <CenteredShell>
        <div className="h-12 w-12 rounded-full bg-destructive/15 text-destructive flex items-center justify-center">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-bold mt-4">Invitation unavailable</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">{loadError}</p>
        <Link to="/login" className="mt-6 inline-flex items-center gap-2 text-sm text-tenant hover:underline">
          Go to sign in
        </Link>
      </CenteredShell>
    );
  }

  if (invite.status !== "invited") {
    return (
      <CenteredShell>
        <div className="h-12 w-12 rounded-full bg-success/15 text-success flex items-center justify-center">
          <CheckCircle2 className="h-6 w-6" />
        </div>
        <h1 className="font-display text-xl font-bold mt-4">Already set up</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-sm">
          This invitation for <span className="font-semibold text-foreground">{invite.companyName}</span> has
          already been completed. Please sign in to your workspace.
        </p>
        <Link to="/login" className="mt-6">
          <Button className="bg-gradient-tenant text-white">Go to sign in <ArrowRight className="h-4 w-4" /></Button>
        </Link>
      </CenteredShell>
    );
  }

  return <OnboardWizard invite={invite} onDone={() => navigate({ to: "/login" })} />;
}

function OnboardWizard({ invite, onDone }: { invite: InviteDetails; onDone: () => void }) {
  const [step, setStep] = useState(1);

  // Account / company (companyName, email, phone come from the invite — read-only)
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [zipCode, setZipCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Billing
  const [billingSame, setBillingSame] = useState(true);
  const [billingFirstName, setBillingFirstName] = useState("");
  const [billingLastName, setBillingLastName] = useState("");
  const [billingAdress, setBillingAdress] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingZipCode, setBillingZipCode] = useState("");

  // Payment (demo gateway)
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processing, setProcessing] = useState(false);

  const amount = invite.monthlyPrice;

  const submit = async () => {
    setProcessing(true);
    try {
      // 1) Demo payment → paymentId
      const { paymentId } = await makePayment(cardNumber.replace(/\s+/g, ""));
      // 2) Complete onboarding with the real invite + payment data
      await completeTenantInviteOnboard({
        tenantId: invite.tenantId,
        packageId: invite.packageId,
        paymentId,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        address: address.trim(),
        city: city.trim(),
        zipCode: zipCode.trim(),
        password,
        billingFirstName: (billingSame ? firstName : billingFirstName).trim(),
        billingLastName: (billingSame ? lastName : billingLastName).trim(),
        billingAdress: (billingSame ? address : billingAdress).trim(),
        billingCity: (billingSame ? city : billingCity).trim(),
        billingZipCode: (billingSame ? zipCode : billingZipCode).trim(),
        amount,
        emailId: invite.emailId,
        phoneNo: invite.phoneNo,
      });
      toast.success(`${invite.companyName} is now active — please sign in`);
      onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to complete onboarding.");
    } finally {
      setProcessing(false);
    }
  };

  const next = () => {
    if (step === 1) {
      if (!firstName.trim()) return toast.error("First name is required");
      if (!address.trim() || !city.trim() || !zipCode.trim()) return toast.error("Address, city and ZIP are required");
      if (password.length < 8) return toast.error("Password must be at least 8 characters");
      if (password !== confirmPassword) return toast.error("Passwords do not match");
    }
    if (step === 2 && !billingSame) {
      if (!billingFirstName.trim() || !billingAdress.trim() || !billingCity.trim() || !billingZipCode.trim()) {
        return toast.error("Please complete the billing details");
      }
    }
    if (step === 3) {
      if (!cardName.trim() || !cardNumber.trim() || !cardExp.trim() || !cardCvc.trim()) {
        return toast.error("All card fields are required");
      }
      submit();
      return;
    }
    setStep(step + 1);
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-card/50 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 py-5 flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-gradient-tenant flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-bold">Tenant Setup</span>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-6 py-10">
        <div className="text-center mb-8">
          <h1 className="font-display text-2xl md:text-3xl font-bold">Welcome, {invite.companyName}</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-lg mx-auto">
            Complete a few quick steps to activate your workspace.
          </p>
        </div>

        <ol className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => {
            const active = step === s.id;
            const complete = step > s.id;
            const Icon = s.icon;
            return (
              <li key={s.id} className="flex-1 flex items-center">
                <div className={`flex flex-col items-center text-center ${active || complete ? "text-tenant" : "text-muted-foreground"}`}>
                  <div className={`h-9 w-9 rounded-full flex items-center justify-center border-2 transition-colors ${
                    complete ? "bg-tenant border-tenant text-white"
                    : active ? "border-tenant bg-tenant/10"
                    : "border-border bg-muted"
                  }`}>
                    {complete ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </div>
                  <span className="text-[11px] mt-1.5 font-medium">{s.label}</span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`flex-1 h-0.5 mx-2 ${step > s.id ? "bg-tenant" : "bg-border"}`} />
                )}
              </li>
            );
          })}
        </ol>

        <div className="bg-card border border-border rounded-2xl shadow-sm p-6 md:p-8 space-y-4">
          {step === 1 && (
            <>
              <h2 className="font-display text-lg font-semibold">Account details</h2>

              {/* From the invite — read-only */}
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">Company name <Lock className="h-3 w-3 text-muted-foreground" /></Label>
                <Input value={invite.companyName} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                <p className="text-[11px] text-muted-foreground">Set during invitation. Contact your administrator to change.</p>
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5 text-muted-foreground" /> Email</Label>
                  <Input value={invite.emailId} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </div>
                <div className="space-y-1.5">
                  <Label className="flex items-center gap-1.5"><Smartphone className="h-3.5 w-3.5 text-muted-foreground" /> Phone</Label>
                  <Input value={invite.phoneNo} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                </div>
              </div>

              <div className="pt-2">
                <Label className="flex items-center gap-1.5 mb-2"><User className="h-3.5 w-3.5 text-muted-foreground" /> Primary contact</Label>
                <div className="grid md:grid-cols-2 gap-4">
                  <Field id="fname" label="First name" value={firstName} onChange={setFirstName} placeholder="Jane" />
                  <Field id="lname" label="Last name" value={lastName} onChange={setLastName} placeholder="Doe" />
                </div>
              </div>

              <Field id="addr" label="Address" value={address} onChange={setAddress} placeholder="123 Main St" />
              <div className="grid md:grid-cols-2 gap-4">
                <Field id="city" label="City" value={city} onChange={setCity} />
                <Field id="zip" label="ZIP / Postal code" value={zipCode} onChange={setZipCode} />
              </div>

              {/* Selected package */}
              <div className="pt-4 border-t border-border">
                <Label className="flex items-center gap-1.5 mb-2"><PackageIcon className="h-3.5 w-3.5 text-muted-foreground" /> Your selected package</Label>
                <div className="rounded-xl border border-tenant/30 bg-tenant/5 p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-display text-lg font-bold">{invite.packageName}</div>
                      <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{invite.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="font-display text-2xl font-bold">${invite.monthlyPrice}</div>
                      <div className="text-[11px] text-muted-foreground">per month · billed monthly</div>
                    </div>
                  </div>
                  <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                    <PkgStat icon={Database} label="Debtor accounts" value={invite.debtorLimit.toLocaleString()} />
                    <PkgStat icon={UsersIcon} label="Tenant users" value={invite.tenantUserLimit} />
                    <PkgStat icon={ListChecks} label="Modules" value={invite.includedModule.length} />
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {invite.includedModule.map((m) => (
                      <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border">{m}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Password */}
              <div className="pt-4 border-t border-border">
                <Label className="flex items-center gap-1.5 mb-2"><Lock className="h-3.5 w-3.5 text-muted-foreground" /> Set up account password</Label>
                <p className="text-[11px] text-muted-foreground mb-3">Used to sign in to your workspace. Minimum 8 characters.</p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pwd">New password</Label>
                    <Input id="pwd" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" maxLength={128} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpwd">Confirm password</Label>
                    <Input id="cpwd" type="password" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Re-enter password" maxLength={128} />
                    {confirmPassword.length > 0 && confirmPassword !== password && (
                      <p className="text-[11px] text-destructive">Passwords do not match</p>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-display text-lg font-semibold">Billing information</h2>
              <p className="text-sm text-muted-foreground">Used for invoices, receipts and tax compliance.</p>

              <label className="flex items-center gap-2 text-sm rounded-lg border border-border bg-muted/30 px-3 py-2">
                <input type="checkbox" checked={billingSame} onChange={(e) => setBillingSame(e.target.checked)} className="rounded" />
                Same as account information
              </label>

              {billingSame ? (
                <div className="rounded-lg border border-dashed border-border p-4 bg-muted/20 text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">Using account info for billing:</div>
                  <div>{[firstName, lastName].filter(Boolean).join(" ") || "—"} · {invite.companyName}</div>
                  <div>{address || "—"}</div>
                  <div>{[city, zipCode].filter(Boolean).join(", ") || "—"}</div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bfname" label="Billing first name" value={billingFirstName} onChange={setBillingFirstName} placeholder="Jane" />
                    <Field id="blname" label="Billing last name" value={billingLastName} onChange={setBillingLastName} placeholder="Doe" />
                  </div>
                  <Field id="baddr" label="Billing address" value={billingAdress} onChange={setBillingAdress} placeholder="456 Finance Ave" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bcity" label="City" value={billingCity} onChange={setBillingCity} />
                    <Field id="bzip" label="ZIP / Postal code" value={billingZipCode} onChange={setBillingZipCode} />
                  </div>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">Payment</h2>
                  <p className="text-sm text-muted-foreground">Demo checkout — no real card is charged.</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> 256-bit TLS
                </div>
              </div>

              <div className="mt-2 rounded-xl border border-border overflow-hidden shadow-sm">
                <div className="bg-gradient-to-br from-[#1a4dff] to-[#0033cc] text-white p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold">
                        {invite.companyName.charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{invite.companyName}</div>
                        <div className="text-[11px] text-white/80 mt-0.5">{invite.packageName}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-white/70">Total amount</div>
                      <div className="text-2xl font-bold">${amount}</div>
                    </div>
                  </div>
                </div>

                <div className="p-4 space-y-3 bg-card">
                  <Field id="cardname" label="Cardholder name" value={cardName} onChange={setCardName} placeholder="Jane Doe" />
                  <div className="space-y-1.5">
                    <Label htmlFor="cardnum">Card number</Label>
                    <div className="relative">
                      <Input id="cardnum" value={cardNumber} onChange={(e) => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" className="pr-10" />
                      <CreditCard className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <Field id="cardexp" label="Expiry (MM/YY)" value={cardExp} onChange={setCardExp} placeholder="12/29" />
                    <Field id="cardcvc" label="CVC" value={cardCvc} onChange={setCardCvc} placeholder="123" />
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> PCI-DSS compliant</span>
                  <span>Demo gateway</span>
                </div>
              </div>
            </>
          )}

          <div className="mt-6 flex items-center justify-between">
            <Button variant="outline" disabled={step === 1 || processing} onClick={() => setStep(step - 1)}>
              <ArrowLeft className="h-4 w-4" /> Back
            </Button>
            <Button onClick={next} disabled={processing} className="bg-gradient-tenant text-white">
              {processing ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing…</>
              ) : step === STEPS.length ? (
                <>Pay ${amount} & activate <ArrowRight className="h-4 w-4" /></>
              ) : (
                <>Continue <ArrowRight className="h-4 w-4" /></>
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}

function CenteredShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-6 text-center">
      {children}
    </div>
  );
}

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
    </div>
  );
}

function PkgStat({ icon: Icon, label, value }: { icon: typeof PackageIcon; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-md bg-card border border-border px-2.5 py-1.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground truncate">{label}</div>
        <div className="text-xs font-semibold truncate">{value}</div>
      </div>
    </div>
  );
}
