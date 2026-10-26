import { Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  Mail,
  Paperclip,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { EmailBody } from "@/components/tenant/EmailBody";
import { usePermissions } from "@/lib/permissions/store";
import { getClientTemplate, getDocumentTemplates } from "@/lib/template-library-api";
import {
  getValidEmailCounts,
  startBulkOperation,
  type ValidEmailCounts,
} from "@/lib/bulk-operations-api";

export type BulkSendKind = "email" | "document";

/** One template choice, whichever library it came from. */
type TemplateOption = {
  templateId: number;
  name: string;
  /** Email: the subject line. Document: the template's description. */
  summary: string | null;
  /** Email: attached documents. Document: the uploaded source file. */
  files: string[];
  /** Email body, previewed under the picked template. */
  body: string | null;
};

type Step = "template" | "check" | "done";

/**
 * "Create documents" / "Send email" for files selected on the Customers list.
 * Every selected file must belong to `clientId` — the backend doesn't check
 * that a template matches the files' client, so the list only offers this when
 * they do. The run is started in the background (no download here, no Merge
 * PDF); the user collects the result from Bulk Operations.
 */
export function BulkSendDrawer({
  kind,
  clientId,
  clientName,
  uploadedDebtorIdList,
  onClose,
  onStarted,
}: {
  kind: BulkSendKind;
  clientId: number;
  clientName: string;
  uploadedDebtorIdList: number[];
  onClose: () => void;
  /** Called once the run has been accepted, e.g. to clear the selection. */
  onStarted: () => void;
}) {
  const { can } = usePermissions();
  const isEmail = kind === "email";
  const count = uploadedDebtorIdList.length;

  const [step, setStep] = useState<Step>("template");
  const [options, setOptions] = useState<TemplateOption[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pickedId, setPickedId] = useState<number | null>(null);
  const picked = options?.find((o) => o.templateId === pickedId) ?? null;

  const loadTemplates = useCallback(() => {
    setOptions(null);
    setLoadError(null);
    const load = isEmail
      ? getClientTemplate({ clientId, templateType: "email" }).then((list) =>
          list.map(
            (t): TemplateOption => ({
              templateId: t.templateId,
              name: t.templateName,
              summary: t.templateSubject || null,
              files: t.documentTemplateNameList ?? [],
              body: t.templateMessage,
            }),
          ),
        )
      : getDocumentTemplates(clientId).then((list) =>
          list.map(
            (t): TemplateOption => ({
              templateId: t.templateId,
              name: t.templateName,
              summary: t.templateDescription || null,
              files: t.templateOrignalFileName ? [t.templateOrignalFileName] : [],
              body: null,
            }),
          ),
        );
    load
      .then((list) => {
        setOptions(list);
        // Nothing to choose between when the client has a single template.
        if (list.length === 1) setPickedId(list[0].templateId);
      })
      .catch((e) => setLoadError(e instanceof Error ? e.message : "Failed to load templates."));
  }, [isEmail, clientId]);
  useEffect(() => {
    loadTemplates();
  }, [loadTemplates]);

  // Email only: how many of the selected files have an address to send to.
  const [emailCounts, setEmailCounts] = useState<ValidEmailCounts | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const runCheck = () => {
    setEmailCounts(null);
    setCheckError(null);
    getValidEmailCounts(uploadedDebtorIdList)
      .then(setEmailCounts)
      .catch((e) =>
        setCheckError(e instanceof Error ? e.message : "Couldn't check the email addresses."),
      );
  };
  const goToCheck = () => {
    setStep("check");
    if (isEmail) runCheck();
  };

  const willRun = isEmail ? (emailCounts?.totalValid ?? 0) : count;
  const skipped = isEmail ? (emailCounts?.totalInvalid ?? 0) : 0;
  const checking = isEmail && !emailCounts && !checkError;

  const [starting, setStarting] = useState(false);
  const start = async () => {
    if (!picked) return;
    setStarting(true);
    try {
      await startBulkOperation(kind, uploadedDebtorIdList, picked.templateId);
      setStep("done");
      onStarted();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't start the bulk operation.");
    } finally {
      setStarting(false);
    }
  };

  const title = isEmail ? "Send email" : "Create documents";
  const noun = isEmail ? "email" : "document";

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent
        side="right"
        className="w-full sm:max-w-lg p-0 flex flex-col gap-0 overflow-hidden"
      >
        <div className="px-6 pt-6 pb-4 pr-12 border-b border-border">
          <SheetTitle className="font-display text-xl font-bold tracking-tight">{title}</SheetTitle>
          <SheetDescription className="mt-1 text-sm text-muted-foreground">
            {count} {count === 1 ? "file" : "files"} selected · {clientName}
          </SheetDescription>
          {step !== "done" && (
            <ol className="mt-4 flex items-center gap-2 text-xs font-semibold">
              <StepLabel n={1} label="Template" active={step === "template"} />
              <span className="text-muted-foreground">·</span>
              <StepLabel
                n={2}
                label={isEmail ? "Check & send" : "Check & create"}
                active={step === "check"}
              />
            </ol>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {step === "template" &&
            (loadError ? (
              <div className="py-10 text-center">
                <p className="text-sm text-destructive font-medium">{loadError}</p>
                <button
                  onClick={loadTemplates}
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border text-sm hover:bg-muted"
                >
                  <RefreshCw className="h-4 w-4" /> Try again
                </button>
              </div>
            ) : !options ? (
              <div className="py-10 flex justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : options.length === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm font-medium">
                  {clientName} has no {noun} templates yet.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Templates are set up per client in the Template Library.
                </p>
                {can("templates.view") && (
                  <Link
                    to="/tenant/engagement/template-library"
                    className="mt-3 inline-block text-sm font-semibold text-tenant hover:underline"
                  >
                    Open Template Library
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-3" role="radiogroup" aria-label={`${title} template`}>
                {options.map((o) => {
                  const active = o.templateId === pickedId;
                  return (
                    <button
                      key={o.templateId}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setPickedId(o.templateId)}
                      className={`w-full text-left rounded-xl border p-4 transition ${
                        active
                          ? "border-[color:var(--tenant)] bg-[color:var(--tenant)]/5"
                          : "border-border hover:bg-muted/40"
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-[color:var(--tenant)]/10 text-tenant shrink-0">
                          {isEmail ? (
                            <Mail className="h-4 w-4" />
                          ) : (
                            <FileText className="h-4 w-4" />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold">{o.name}</div>
                          {o.summary && (
                            <div className="text-sm text-muted-foreground mt-0.5">{o.summary}</div>
                          )}
                          {o.files.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {o.files.map((f, i) => (
                                <span
                                  key={`${f}-${i}`}
                                  className="inline-flex items-center gap-1 max-w-full px-2 py-0.5 rounded-md border border-border text-xs text-muted-foreground break-all"
                                >
                                  <Paperclip className="h-3 w-3" /> {f}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      {active && o.body && (
                        <div className="mt-3 rounded-lg border border-border bg-background p-3 text-sm max-h-56 overflow-y-auto">
                          <EmailBody body={o.body} />
                        </div>
                      )}
                    </button>
                  );
                })}
                {isEmail && (
                  <p className="text-xs text-muted-foreground">
                    Placeholders like {"{{Debtor first name}}"} are filled from each customer's file
                    when the email is sent.
                  </p>
                )}
              </div>
            ))}

          {step === "check" && picked && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <CountTile label="Selected" value={count} />
                <CountTile
                  label={isEmail ? "Will be sent" : "Will be created"}
                  value={checking ? null : willRun}
                  tone="text-tenant"
                />
                <CountTile label="Skipped" value={checking ? null : skipped} tone="text-warning" />
              </div>
              {checkError && (
                <div className="text-sm text-destructive">
                  {checkError}{" "}
                  <button onClick={runCheck} className="font-semibold underline">
                    Try again
                  </button>
                </div>
              )}
              {isEmail && emailCounts && skipped > 0 && (
                <p className="text-sm text-muted-foreground">
                  {skipped} {skipped === 1 ? "file has" : "files have"} no valid email address and
                  will be skipped.
                </p>
              )}
              {isEmail && emailCounts && willRun === 0 && (
                <p className="text-sm text-destructive font-medium">
                  None of the selected files has a valid email address, so there's nothing to send.
                </p>
              )}
              <div className="rounded-xl border border-border p-4 text-sm space-y-1.5">
                <div className="font-semibold">{picked.name}</div>
                <p className="text-muted-foreground">
                  {isEmail
                    ? "The emails are sent in the background, usually within a minute."
                    : "The documents are created in the background, usually within a minute. Each one is also filed on its customer's Documents tab."}{" "}
                  Track the run in Bulk Operations
                  {isEmail ? "." : ", where the documents can be downloaded once it completes."}
                </p>
              </div>
            </div>
          )}

          {step === "done" && (
            <div className="py-8 text-center">
              <CheckCircle2 className="h-10 w-10 mx-auto text-success" />
              <h3 className="mt-3 font-display text-lg font-bold">
                {isEmail ? "Bulk email scheduled" : "Document creation scheduled"}
              </h3>
              <p className="mt-1 text-sm text-muted-foreground max-w-sm mx-auto">
                “{picked?.name}” for {count} {count === 1 ? "file" : "files"} runs in the
                background, usually within a minute.{" "}
                {isEmail
                  ? "Its results appear in Bulk Operations."
                  : "Download the documents from Bulk Operations once it completes."}
              </p>
              {can("bulkOperations.view") && (
                <Link
                  to="/tenant/engagement/bulk-operations"
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-border text-sm font-semibold hover:bg-muted"
                >
                  Open Bulk Operations <ArrowRight className="h-4 w-4" />
                </Link>
              )}
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border flex items-center justify-between gap-3">
          {step === "check" ? (
            <button
              onClick={() => setStep("template")}
              disabled={starting}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm hover:bg-muted disabled:opacity-50"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
          ) : (
            <span />
          )}
          {step === "template" && (
            <button
              onClick={goToCheck}
              disabled={!picked}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Continue <ArrowRight className="h-4 w-4" />
            </button>
          )}
          {step === "check" && (
            <button
              onClick={start}
              disabled={starting || checking || willRun === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {starting && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEmail
                ? `Send to ${willRun} ${willRun === 1 ? "file" : "files"}`
                : `Create ${willRun} ${willRun === 1 ? "document" : "documents"}`}
            </button>
          )}
          {step === "done" && (
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-gradient-tenant text-white text-sm font-semibold shadow-tenant"
            >
              Done
            </button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

function StepLabel({ n, label, active }: { n: number; label: string; active: boolean }) {
  return (
    <li
      className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md ${
        active ? "bg-[color:var(--tenant)]/10 text-tenant" : "text-muted-foreground"
      }`}
    >
      <span
        className={`inline-flex h-4 w-4 items-center justify-center rounded-full text-[10px] ${
          active ? "bg-tenant text-white" : "bg-muted"
        }`}
      >
        {n}
      </span>
      {label}
    </li>
  );
}

function CountTile({
  label,
  value,
  tone = "text-foreground",
}: {
  label: string;
  /** null while still being worked out. */
  value: number | null;
  tone?: string;
}) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className={`font-display text-2xl font-bold ${tone}`}>
        {value === null ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : (
          value
        )}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}
