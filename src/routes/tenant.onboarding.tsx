import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  ShieldCheck, CheckCircle2, Building2, CreditCard, MapPin,
  ArrowRight, ArrowLeft, Lock, Loader2, User, Smartphone, Building, Wallet, BadgeCheck,
  Package as PackageIcon, Database, Users as UsersIcon, ListChecks,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/lib/portal-context";
import { packages as packageCatalog } from "@/lib/packages-mock";

const GATEWAY_NAME = "Razorpay";
type PayMethod = "card" | "upi" | "netbanking" | "wallet";

export const Route = createFileRoute("/tenant/onboarding")({
  head: () => ({ meta: [{ title: "Complete tenant setup" }] }),
  component: OnboardingPage,
});

const STEPS = [
  { id: 1, label: "Company", icon: Building2 },
  { id: 2, label: "Billing", icon: MapPin },
  { id: 3, label: "Payment", icon: CreditCard },
];

const TOTAL_AMOUNT = 6000;

function OnboardingPage() {
  const navigate = useNavigate();
  const { activeTenant, tenantId, markOnboardingComplete, isPendingOnboarding } = usePortal();

  const [step, setStep] = useState(1);
  const [companyName, setCompanyName] = useState("");
  const [fullName, setFullName] = useState("");
  const [companyAddr, setCompanyAddr] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyCountry, setCompanyCountry] = useState("");
  const [companyZip, setCompanyZip] = useState("");

  // Billing
  const [billingSame, setBillingSame] = useState(true);
  const [billingFullName, setBillingFullName] = useState("");
  const [billingCompany, setBillingCompany] = useState("");
  const [billingEmail, setBillingEmail] = useState("");
  const [billingPhone, setBillingPhone] = useState("");
  const [billingAddr, setBillingAddr] = useState("");
  const [billingCity, setBillingCity] = useState("");
  const [billingState, setBillingState] = useState("");
  const [billingCountry, setBillingCountry] = useState("");
  const [billingZip, setBillingZip] = useState("");

  const [payMethod, setPayMethod] = useState<PayMethod>("card");
  const [upiId, setUpiId] = useState("");
  const [bank, setBank] = useState("");
  const [wallet, setWallet] = useState("");
  const [phone, setPhone] = useState("");
  const [cardName, setCardName] = useState("");
  const [cardNumber, setCardNumber] = useState("");
  const [cardExp, setCardExp] = useState("");
  const [cardCvc, setCardCvc] = useState("");
  const [processing, setProcessing] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Assigned package (would normally come from invite metadata)
  const assignedPackage = packageCatalog.find((p) => p.id === "pkg_standard") ?? packageCatalog[0];

  useEffect(() => {
    if (activeTenant) setCompanyName(activeTenant.name);
    setStep(1);
  }, [activeTenant?.id]);

  useEffect(() => {
    if (!isPendingOnboarding(tenantId)) navigate({ to: "/tenant" });
  }, [tenantId]);

  const completeOnboarding = () => {
    const isDemoPending = tenantId === "t_11" || tenantId === "t_12";
    markOnboardingComplete(tenantId);
    if (isDemoPending) {
      toast.message("Demo tenant kept in pending state", {
        description: "Lighthouse and Summit always show the pending onboarding flow.",
      });
      setStep(1);
      return;
    }
    toast.success(`${companyName} is now active — redirecting to dashboard`);
    navigate({ to: "/tenant" });
  };

  const next = () => {
    if (step === 1) {
      if (!fullName.trim()) return toast.error("Full name is required");
      if (password.length < 8) return toast.error("Password must be at least 8 characters");
      if (password !== confirmPassword) return toast.error("Passwords do not match");
    }
    if (step === 2 && !billingSame && !billingAddr.trim()) return toast.error("Billing address required");
    if (step === 3) {
      if (!phone.trim() || phone.trim().length < 10) return toast.error("Valid phone number required");
      if (payMethod === "card" && (!cardName.trim() || !cardNumber.trim() || !cardExp.trim() || !cardCvc.trim())) {
        return toast.error("All card fields required");
      }
      if (payMethod === "upi" && !upiId.trim()) return toast.error("UPI ID required");
      if (payMethod === "netbanking" && !bank) return toast.error("Select a bank");
      if (payMethod === "wallet" && !wallet) return toast.error("Select a wallet");
      setProcessing(true);
      toast.message(`Redirecting to ${GATEWAY_NAME}…`, { description: "Securely processing payment" });
      setTimeout(() => {
        setProcessing(false);
        completeOnboarding();
      }, 1800);
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
          <h1 className="font-display text-2xl md:text-3xl font-bold">Welcome, {activeTenant?.name ?? "new tenant"}</h1>
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
              <h2 className="font-display text-lg font-semibold">Company details</h2>

              {/* Company name — prepopulated, read-only */}
              <div className="space-y-1.5">
                <Label htmlFor="cname" className="flex items-center gap-1.5">
                  Company name
                  <Lock className="h-3 w-3 text-muted-foreground" />
                </Label>
                <Input id="cname" value={companyName} readOnly disabled className="bg-muted/50 cursor-not-allowed" />
                <p className="text-[11px] text-muted-foreground">Set during invitation. Contact your administrator to change.</p>
              </div>

              {/* Primary contact name */}
              <div className="pt-2">
                <Label className="flex items-center gap-1.5 mb-2">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                  Primary contact
                </Label>
                <Field id="fullname" label="Full name" value={fullName} onChange={setFullName} placeholder="Jane Doe" />
              </div>

              <Field id="caddr" label="Address" value={companyAddr} onChange={setCompanyAddr} placeholder="123 Main St" />
              <div className="grid md:grid-cols-2 gap-4">
                <Field id="ccity" label="City" value={companyCity} onChange={setCompanyCity} />
                <Field id="cstate" label="State / Province" value={companyState} onChange={setCompanyState} />
              </div>
              <div className="grid md:grid-cols-2 gap-4">
                <Field id="ccountry" label="Country" value={companyCountry} onChange={setCompanyCountry} />
                <Field id="czip" label="ZIP / Postal code" value={companyZip} onChange={setCompanyZip} />
              </div>

              {/* Selected package details */}
              {assignedPackage && (
                <div className="pt-4 border-t border-border">
                  <Label className="flex items-center gap-1.5 mb-2">
                    <PackageIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    Your selected package
                  </Label>
                  <div className="rounded-xl border border-tenant/30 bg-tenant/5 p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-display text-lg font-bold">{assignedPackage.name}</div>
                        <p className="text-xs text-muted-foreground mt-0.5 max-w-md">{assignedPackage.description}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-display text-2xl font-bold">${assignedPackage.monthlyPrice}</div>
                        <div className="text-[11px] text-muted-foreground">per month · billed monthly</div>
                      </div>
                    </div>
                    <div className="mt-3 grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                      <PkgStat icon={Database} label="Customer accounts" value={assignedPackage.debtorLimit.toLocaleString()} />
                      <PkgStat icon={UsersIcon} label="Tenant users" value={assignedPackage.userLimit} />
                      <PkgStat icon={ListChecks} label="Modules" value={assignedPackage.includedModules.length} />
                    </div>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {assignedPackage.includedModules.map((m) => (
                        <span key={m} className="text-[10px] px-2 py-0.5 rounded-full bg-card border border-border">{m}</span>
                      ))}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-3">
                      Overage: +${assignedPackage.overagePerDebtor.toFixed(2)} per extra customer beyond the included limit.
                    </p>
                  </div>
                </div>
              )}


              {/* Account password */}
              <div className="pt-4 border-t border-border">
                <Label className="flex items-center gap-1.5 mb-2">
                  <Lock className="h-3.5 w-3.5 text-muted-foreground" />
                  Set up account password
                </Label>
                <p className="text-[11px] text-muted-foreground mb-3">
                  This password will be used to sign in to your workspace. Minimum 8 characters.
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pwd">New password</Label>
                    <Input
                      id="pwd"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      maxLength={128}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="cpwd">Confirm password</Label>
                    <Input
                      id="cpwd"
                      type="password"
                      autoComplete="new-password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter password"
                      maxLength={128}
                    />
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
                <input type="checkbox" checked={billingSame} onChange={e => setBillingSame(e.target.checked)} className="rounded" />
                Same as company information
              </label>

              {billingSame ? (
                <div className="rounded-lg border border-dashed border-border p-4 bg-muted/20 text-xs text-muted-foreground space-y-1">
                  <div className="font-medium text-foreground">Using company info for billing:</div>
                  <div>{fullName || "—"} · {companyName || "—"}</div>
                  <div>{companyAddr || "—"}</div>
                  <div>
                    {[companyCity, companyState, companyZip].filter(Boolean).join(", ") || "—"}
                    {companyCountry ? ` · ${companyCountry}` : ""}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bfullname" label="Billing full name" value={billingFullName} onChange={setBillingFullName} placeholder="Jane Doe" />
                    <Field id="bcompany" label="Billing company name (optional)" value={billingCompany} onChange={setBillingCompany} placeholder="Acme Inc." />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bemail" label="Billing email" value={billingEmail} onChange={setBillingEmail} placeholder="billing@acme.com" />
                    <Field id="bphone" label="Billing phone" value={billingPhone} onChange={setBillingPhone} placeholder="+1 555 555 0100" />
                  </div>
                  <Field id="baddr" label="Billing address" value={billingAddr} onChange={setBillingAddr} placeholder="456 Finance Ave" />
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bcity" label="City" value={billingCity} onChange={setBillingCity} />
                    <Field id="bstate" label="State / Province" value={billingState} onChange={setBillingState} />
                  </div>
                  <div className="grid md:grid-cols-2 gap-4">
                    <Field id="bcountry" label="Country" value={billingCountry} onChange={setBillingCountry} />
                    <Field id="bzip" label="ZIP / Postal code" value={billingZip} onChange={setBillingZip} />
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
                  <p className="text-sm text-muted-foreground">Secure checkout powered by {GATEWAY_NAME}.</p>
                </div>
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground bg-muted px-2.5 py-1 rounded-full">
                  <Lock className="h-3 w-3" /> 256-bit TLS
                </div>
              </div>

              {/* Razorpay-style hosted checkout mock */}
              <div className="mt-2 rounded-xl border border-border overflow-hidden shadow-sm">
                {/* Header */}
                <div className="bg-[#0d2husb] bg-gradient-to-br from-[#1a4dff] to-[#0033cc] text-white p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center font-bold">
                        {(activeTenant?.name ?? "A").charAt(0)}
                      </div>
                      <div>
                        <div className="font-semibold">{activeTenant?.name ?? "Acme Corp"}</div>
                        <div className="flex items-center gap-1 text-[11px] text-white/80 mt-0.5">
                          <BadgeCheck className="h-3 w-3" /> {GATEWAY_NAME} Trusted Business
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] uppercase tracking-wider text-white/70">Total amount</div>
                      <div className="text-2xl font-bold">₹ {TOTAL_AMOUNT.toLocaleString("en-IN")}</div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-1 text-[10px] text-white/80">
                    <Lock className="h-3 w-3" /> Secured by {GATEWAY_NAME}
                  </div>
                </div>

                {/* Contact */}
                <div className="p-4 bg-card border-b border-border space-y-1.5">
                  <Label htmlFor="phone" className="text-xs">Contact details</Label>
                  <div className="flex gap-2">
                    <div className="px-3 flex items-center bg-muted rounded-md text-sm border border-input">+91</div>
                    <Input id="phone" value={phone} onChange={e => setPhone(e.target.value)} placeholder="9000900009" maxLength={10} />
                  </div>
                </div>

                {/* Methods + form */}
                <div className="grid md:grid-cols-[200px_1fr] bg-card">
                  <div className="border-r border-border bg-muted/20 p-2 space-y-1">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground px-2 py-1.5">Cards, UPI & more</div>
                    {([
                      { id: "card", label: "Card", desc: "Visa, MC, RuPay", icon: CreditCard },
                      { id: "upi", label: "UPI / QR", desc: "GPay, PhonePe", icon: Smartphone },
                      { id: "netbanking", label: "Netbanking", desc: "All Indian banks", icon: Building },
                      { id: "wallet", label: "Wallet", desc: "PhonePe & more", icon: Wallet },
                    ] as { id: PayMethod; label: string; desc: string; icon: typeof CreditCard }[]).map((m) => {
                      const Ic = m.icon;
                      const active = payMethod === m.id;
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setPayMethod(m.id)}
                          className={`w-full flex items-center gap-2.5 rounded-md px-2.5 py-2 text-left transition ${
                            active ? "bg-[#1a4dff]/10 border border-[#1a4dff]/40" : "border border-transparent hover:bg-muted"
                          }`}
                        >
                          <Ic className={`h-4 w-4 ${active ? "text-[#1a4dff]" : "text-muted-foreground"}`} />
                          <div className="min-w-0">
                            <div className="text-xs font-semibold truncate">{m.label}</div>
                            <div className="text-[10px] text-muted-foreground truncate">{m.desc}</div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="p-4 space-y-3 min-h-[260px]">
                    {payMethod === "card" && (
                      <>
                        <Field id="cardname" label="Cardholder name" value={cardName} onChange={setCardName} placeholder="Jane Doe" />
                        <div className="space-y-1.5">
                          <Label htmlFor="cardnum">Card number</Label>
                          <div className="relative">
                            <Input id="cardnum" value={cardNumber} onChange={e => setCardNumber(e.target.value)} placeholder="4242 4242 4242 4242" className="pr-10" />
                            <CreditCard className="h-4 w-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2" />
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <Field id="cardexp" label="Expiry (MM/YY)" value={cardExp} onChange={setCardExp} placeholder="12/29" />
                          <Field id="cardcvc" label="CVC" value={cardCvc} onChange={setCardCvc} placeholder="123" />
                        </div>
                      </>
                    )}
                    {payMethod === "upi" && (
                      <>
                        <Field id="upi" label="UPI ID" value={upiId} onChange={setUpiId} placeholder="name@upi" />
                        <p className="text-[11px] text-muted-foreground">You'll receive a collect request in your UPI app.</p>
                      </>
                    )}
                    {payMethod === "netbanking" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Select bank</Label>
                        <div className="grid grid-cols-3 gap-2">
                          {["SBI", "ICICI", "Axis", "Kotak", "Yes", "IDBI"].map((b) => (
                            <button
                              key={b}
                              type="button"
                              onClick={() => setBank(b)}
                              className={`rounded-md border p-3 text-sm font-medium transition ${
                                bank === b ? "border-[#1a4dff] bg-[#1a4dff]/10" : "border-border hover:border-muted-foreground/40"
                              }`}
                            >
                              {b}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                    {payMethod === "wallet" && (
                      <div className="space-y-2">
                        <Label className="text-xs">Select wallet</Label>
                        <div className="grid grid-cols-2 gap-2">
                          {["PhonePe", "Paytm", "Amazon Pay", "Mobikwik"].map((w) => (
                            <button
                              key={w}
                              type="button"
                              onClick={() => setWallet(w)}
                              className={`rounded-md border p-3 text-sm font-medium transition ${
                                wallet === w ? "border-[#1a4dff] bg-[#1a4dff]/10" : "border-border hover:border-muted-foreground/40"
                              }`}
                            >
                              {w}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between px-4 py-2.5 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1"><Lock className="h-3 w-3" /> PCI-DSS compliant</span>
                  <span>Powered by {GATEWAY_NAME}</span>
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
                <><Loader2 className="h-4 w-4 animate-spin" /> Processing payment…</>
              ) : step === STEPS.length ? (
                <>Pay ₹ {TOTAL_AMOUNT.toLocaleString("en-IN")} & activate <ArrowRight className="h-4 w-4" /></>
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

function Field({ id, label, value, onChange, placeholder }: { id: string; label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
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
