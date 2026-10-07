import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Check,
  ChevronDown,
  FileText,
  Heading,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  Loader2,
  Paperclip,
  Underline,
  Unlink,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { getDocumentTemplates, type DocumentTemplate } from "@/lib/template-library-api";
import { isEmptyEmailHtml } from "@/lib/email-html";

// The one email editor every Workspace entry point uses (Inbound Inbox thread,
// customer profile Email tab, …). Only the recipient line and what happens on
// send live with the caller; formatting, attachments and keyboard behaviour
// are identical everywhere.
//
// Toolbar — exactly eight controls, pinned to the top of the editor while the
// body scrolls: Bold · Italic · Underline · Lists · Headers · Alignment ·
// Link · Attachment.
//
// The body is HTML (contentEditable + execCommand, which writes plain tags and
// inline text-align styles — email-safe without a stylesheet) and is sent as
// sendCustomerEmail's emailBody. Attachments from the Template Library go out
// as documentTemplateIdList (the only attachment source for now — Local Drive
// upload is out of scope until sendCustomerEmail accepts files).

type Block = "p" | "h1" | "h2" | "h3";
type Align = "left" | "center" | "right";
type ListKind = "ul" | "ol" | null;

type Formats = {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  list: ListKind;
  block: Block;
  align: Align;
  link: boolean;
};

const EMPTY_FORMATS: Formats = {
  bold: false,
  italic: false,
  underline: false,
  list: null,
  block: "p",
  align: "left",
  link: false,
};

const BLOCK_LABEL: Record<Block, string> = {
  p: "Normal text",
  h1: "Heading 1",
  h2: "Heading 2",
  h3: "Heading 3",
};

function normaliseUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (/^(https?:|mailto:|tel:)/i.test(v)) return v;
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return `mailto:${v}`;
  if (/^[\w-]+(\.[\w-]+)+/.test(v)) return `https://${v}`;
  return null;
}

export function EmailComposer({
  value,
  onChange,
  clientId,
  attachments,
  onAttachmentsChange,
  placeholder = "Write your message…",
  disabled = false,
  onSubmit,
  minHeight = 140,
  maxHeight = 320,
}: {
  /** HTML body. Set it to "" to clear the editor after a send. */
  value: string;
  onChange: (html: string) => void;
  /** The customer's client — scopes the Template Library attachment list. */
  clientId: number | null | undefined;
  /** Selected document template ids (sent as documentTemplateIdList). */
  attachments: number[];
  onAttachmentsChange: (ids: number[]) => void;
  placeholder?: string;
  disabled?: boolean;
  /** ⌘/Ctrl+Enter. */
  onSubmit?: () => void;
  minHeight?: number;
  maxHeight?: number;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRange = useRef<Range | null>(null);
  const [formats, setFormats] = useState<Formats>(EMPTY_FORMATS);
  const [focused, setFocused] = useState(false);

  // Library of document templates, shared by the Attachment menu and the chips.
  const [docTemplates, setDocTemplates] = useState<DocumentTemplate[] | null>(null);
  const [docError, setDocError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    setDocTemplates(null);
    setDocError(null);
    if (clientId == null) {
      setDocTemplates([]);
      return;
    }
    getDocumentTemplates(clientId)
      .then((list) => !cancelled && setDocTemplates(list))
      .catch((e) => {
        if (cancelled) return;
        setDocTemplates([]);
        setDocError(e instanceof Error ? e.message : "Couldn't load document templates.");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  // Push outside changes (a reset after send, a quoted reply) into the DOM.
  // Typing round-trips through onChange, so the two already match and the
  // caret is left alone.
  useEffect(() => {
    const el = editorRef.current;
    if (el && el.innerHTML !== value) el.innerHTML = value;
  }, [value]);

  useEffect(() => {
    // Tags rather than <span style="font-weight:…">, so formatting survives in
    // email clients and in our own renderer.
    try {
      document.execCommand("styleWithCSS", false, "false");
      document.execCommand("defaultParagraphSeparator", false, "p");
    } catch {
      /* older engines */
    }
  }, []);

  const selectionInEditor = useCallback((): Range | null => {
    const sel = window.getSelection();
    const el = editorRef.current;
    if (!sel || sel.rangeCount === 0 || !el) return null;
    const range = sel.getRangeAt(0);
    return el.contains(range.commonAncestorContainer) ? range : null;
  }, []);

  const readFormats = useCallback(() => {
    const range = selectionInEditor();
    if (!range) return;
    savedRange.current = range.cloneRange();
    const block = String(document.queryCommandValue("formatBlock") || "p")
      .toLowerCase()
      .replace(/[<>]/g, "");
    const anchor =
      range.startContainer.nodeType === Node.ELEMENT_NODE
        ? (range.startContainer as Element)
        : range.startContainer.parentElement;
    setFormats({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      underline: document.queryCommandState("underline"),
      list: document.queryCommandState("insertOrderedList")
        ? "ol"
        : document.queryCommandState("insertUnorderedList")
          ? "ul"
          : null,
      block: ["h1", "h2", "h3"].includes(block) ? (block as Block) : "p",
      align: document.queryCommandState("justifyCenter")
        ? "center"
        : document.queryCommandState("justifyRight")
          ? "right"
          : "left",
      link: !!anchor?.closest("a"),
    });
  }, [selectionInEditor]);

  useEffect(() => {
    document.addEventListener("selectionchange", readFormats);
    return () => document.removeEventListener("selectionchange", readFormats);
  }, [readFormats]);

  const emit = () => {
    const el = editorRef.current;
    if (!el) return;
    // An emptied contentEditable keeps a stray <br>/<p>; normalise to "".
    const html = isEmptyEmailHtml(el.innerHTML) && !el.querySelector("li") ? "" : el.innerHTML;
    onChange(html);
  };

  /** Put the caret back where it was before a menu took focus. */
  const restoreSelection = () => {
    const el = editorRef.current;
    if (!el) return;
    el.focus();
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    if (savedRange.current && el.contains(savedRange.current.commonAncestorContainer)) {
      sel.addRange(savedRange.current);
    } else {
      const end = document.createRange();
      end.selectNodeContents(el);
      end.collapse(false);
      sel.addRange(end);
    }
  };

  const exec = (cmd: string, arg?: string) => {
    if (disabled) return;
    restoreSelection();
    document.execCommand(cmd, false, arg);
    emit();
    readFormats();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      onSubmit?.();
      return;
    }
    if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey) {
      const k = e.key.toLowerCase();
      if (k === "k") {
        e.preventDefault();
        setLinkOpen(true);
      }
    }
  };

  // Pasted content arrives as plain text: rich paste from Word/web pages
  // brings fonts, classes and colours that break the email's look.
  const onPaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  /* ------------------------------- link -------------------------------- */

  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const currentAnchor = (): HTMLAnchorElement | null => {
    const r = savedRange.current;
    if (!r) return null;
    const node =
      r.startContainer.nodeType === Node.ELEMENT_NODE
        ? (r.startContainer as Element)
        : r.startContainer.parentElement;
    const a = node?.closest("a");
    return a && editorRef.current?.contains(a) ? (a as HTMLAnchorElement) : null;
  };

  const openLink = (open: boolean) => {
    if (open) {
      setLinkUrl(currentAnchor()?.getAttribute("href") ?? "");
      setLinkError(null);
    }
    setLinkOpen(open);
  };

  const applyLink = () => {
    const url = normaliseUrl(linkUrl);
    if (!url) {
      setLinkError("Enter a web address (https://…) or an email address.");
      return;
    }
    const existing = currentAnchor();
    if (existing) {
      existing.setAttribute("href", url);
      emit();
    } else {
      restoreSelection();
      const sel = window.getSelection();
      if (sel && sel.isCollapsed) {
        // Nothing selected: insert the address itself as the link text.
        document.execCommand(
          "insertHTML",
          false,
          `<a href="${url.replace(/"/g, "&quot;")}">${linkUrl
            .trim()
            .replace(/[&<>]/g, (c) => `&#${c.charCodeAt(0)};`)}</a>`,
        );
      } else {
        document.execCommand("createLink", false, url);
      }
      emit();
    }
    setLinkOpen(false);
  };

  const removeLink = () => {
    const a = currentAnchor();
    if (a) {
      const range = document.createRange();
      range.selectNodeContents(a);
      savedRange.current = range;
    }
    exec("unlink");
    setLinkOpen(false);
  };

  /* --------------------------- attachments ----------------------------- */

  const [attachOpen, setAttachOpen] = useState(false);
  const toggleDoc = (id: number) =>
    onAttachmentsChange(
      attachments.includes(id) ? attachments.filter((x) => x !== id) : [...attachments, id],
    );
  const docName = (id: number) =>
    docTemplates?.find((d) => d.templateId === id)?.templateName ?? `Template #${id}`;

  /* ------------------------------ render ------------------------------- */

  const isEmpty = isEmptyEmailHtml(value) && !value.includes("<li");

  return (
    <div
      className={`rounded-xl border bg-background transition-colors ${
        focused ? "border-tenant" : "border-border"
      } ${disabled ? "opacity-60" : ""}`}
    >
      {/* The toolbar sits outside the scrolling body and is sticky, so it
          stays put whether the body or the surrounding page scrolls. */}
      <div
        role="toolbar"
        aria-label="Formatting"
        className="sticky top-0 z-10 flex flex-wrap items-center gap-0.5 rounded-t-xl border-b border-border bg-muted/40 px-1.5 py-1 backdrop-blur"
      >
        {/* 1–3 Bold / Italic / Underline */}
        <ToolButton
          label="Bold (⌘B)"
          active={formats.bold}
          disabled={disabled}
          onClick={() => exec("bold")}
        >
          <Bold className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Italic (⌘I)"
          active={formats.italic}
          disabled={disabled}
          onClick={() => exec("italic")}
        >
          <Italic className="h-4 w-4" />
        </ToolButton>
        <ToolButton
          label="Underline (⌘U)"
          active={formats.underline}
          disabled={disabled}
          onClick={() => exec("underline")}
        >
          <Underline className="h-4 w-4" />
        </ToolButton>

        <Divider />

        {/* 4 Lists */}
        <ToolMenu
          label="Lists"
          active={formats.list != null}
          disabled={disabled}
          trigger={
            formats.list === "ol" ? (
              <ListOrdered className="h-4 w-4" />
            ) : (
              <List className="h-4 w-4" />
            )
          }
          items={[
            {
              key: "ul",
              icon: <List className="h-4 w-4" />,
              text: "Bulleted list",
              checked: formats.list === "ul",
              onSelect: () => exec("insertUnorderedList"),
            },
            {
              key: "ol",
              icon: <ListOrdered className="h-4 w-4" />,
              text: "Numbered list",
              checked: formats.list === "ol",
              onSelect: () => exec("insertOrderedList"),
            },
          ]}
        />

        {/* 5 Headers */}
        <ToolMenu
          label="Headers"
          active={formats.block !== "p"}
          disabled={disabled}
          trigger={
            <span className="inline-flex items-center gap-1 text-xs font-medium">
              <Heading className="h-4 w-4" />
              <span className="hidden sm:inline">{BLOCK_LABEL[formats.block]}</span>
            </span>
          }
          items={(["p", "h1", "h2", "h3"] as Block[]).map((b) => ({
            key: b,
            text: BLOCK_LABEL[b],
            textClass:
              b === "h1"
                ? "text-lg font-bold"
                : b === "h2"
                  ? "text-base font-bold"
                  : b === "h3"
                    ? "text-sm font-bold"
                    : "text-sm",
            checked: formats.block === b,
            onSelect: () => exec("formatBlock", `<${b}>`),
          }))}
        />

        {/* 6 Alignment */}
        <ToolMenu
          label="Alignment"
          active={formats.align !== "left"}
          disabled={disabled}
          trigger={
            formats.align === "center" ? (
              <AlignCenter className="h-4 w-4" />
            ) : formats.align === "right" ? (
              <AlignRight className="h-4 w-4" />
            ) : (
              <AlignLeft className="h-4 w-4" />
            )
          }
          items={[
            {
              key: "left",
              icon: <AlignLeft className="h-4 w-4" />,
              text: "Align left",
              checked: formats.align === "left",
              onSelect: () => exec("justifyLeft"),
            },
            {
              key: "center",
              icon: <AlignCenter className="h-4 w-4" />,
              text: "Align center",
              checked: formats.align === "center",
              onSelect: () => exec("justifyCenter"),
            },
            {
              key: "right",
              icon: <AlignRight className="h-4 w-4" />,
              text: "Align right",
              checked: formats.align === "right",
              onSelect: () => exec("justifyRight"),
            },
          ]}
        />

        <Divider />

        {/* 7 Link */}
        <Popover open={linkOpen} onOpenChange={openLink}>
          <PopoverTrigger asChild>
            <ToolButton label="Link (⌘K)" active={formats.link} disabled={disabled}>
              <LinkIcon className="h-4 w-4" />
            </ToolButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-80 p-3"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <form
              onSubmit={(e) => {
                e.preventDefault();
                applyLink();
              }}
              className="space-y-2"
            >
              <label className="block text-xs font-semibold">
                {currentAnchor() ? "Edit link" : "Insert link"}
              </label>
              <input
                autoFocus
                value={linkUrl}
                onChange={(e) => {
                  setLinkUrl(e.target.value);
                  setLinkError(null);
                }}
                placeholder="https://example.com or name@example.com"
                className="h-9 w-full rounded-md border border-border bg-background px-2.5 text-sm outline-none focus:border-tenant"
              />
              {linkError && <p className="text-[11px] text-destructive">{linkError}</p>}
              <div className="flex items-center justify-between gap-2 pt-1">
                {currentAnchor() ? (
                  <button
                    type="button"
                    onClick={removeLink}
                    className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-destructive"
                  >
                    <Unlink className="h-3.5 w-3.5" /> Remove link
                  </button>
                ) : (
                  <span className="text-[11px] text-muted-foreground">
                    Applies to the selected text.
                  </span>
                )}
                <button
                  type="submit"
                  className="rounded-md bg-tenant px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90"
                >
                  Apply
                </button>
              </div>
            </form>
          </PopoverContent>
        </Popover>

        {/* 8 Attachment */}
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <PopoverTrigger asChild>
            <ToolButton label="Attachment" active={attachments.length > 0} disabled={disabled}>
              <span className="relative inline-flex">
                <Paperclip className="h-4 w-4" />
                {attachments.length > 0 && (
                  <span className="absolute -right-2 -top-1.5 inline-flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-tenant px-0.5 text-[9px] font-bold text-white">
                    {attachments.length}
                  </span>
                )}
              </span>
            </ToolButton>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-72 p-0"
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            <>
              <div className="border-b border-border px-3 py-2">
                <div className="text-sm font-semibold">Attach from Template Library</div>
                <div className="text-[11px] text-muted-foreground">
                  Each one is generated for this customer and sent with the email.
                </div>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {docTemplates === null ? (
                  <div className="flex items-center justify-center py-6 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : docTemplates.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    {docError ??
                      "No document templates for this client. Add one under Template Library → Documents."}
                  </p>
                ) : (
                  docTemplates.map((t) => {
                    const on = attachments.includes(t.templateId);
                    return (
                      <button
                        key={t.templateId}
                        type="button"
                        onClick={() => toggleDoc(t.templateId)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                      >
                        <span
                          className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                            on ? "border-tenant bg-tenant text-white" : "border-border"
                          }`}
                        >
                          {on && <Check className="h-3 w-3" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate">{t.templateName}</span>
                          {t.templateOrignalFileName && (
                            <span className="block truncate text-[11px] text-muted-foreground">
                              {t.templateOrignalFileName}
                            </span>
                          )}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </>
          </PopoverContent>
        </Popover>
      </div>

      {/* Body */}
      <div className="relative">
        {isEmpty && !focused && (
          <div className="pointer-events-none absolute left-4 top-3 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
        <div
          ref={editorRef}
          role="textbox"
          aria-multiline="true"
          aria-label="Email body"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          style={{ minHeight, maxHeight }}
          className="overflow-y-auto px-4 py-3 text-sm leading-relaxed outline-none [&_a]:text-tenant [&_a]:underline [&_h1]:my-1 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:my-1 [&_h2]:text-lg [&_h2]:font-bold [&_h3]:my-1 [&_h3]:text-base [&_h3]:font-semibold [&_ol]:list-decimal [&_ol]:pl-6 [&_p]:my-0 [&_ul]:list-disc [&_ul]:pl-6"
        />
      </div>

      {/* Selected attachments */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-3 py-2">
          {attachments.map((id) => (
            <span
              key={id}
              className="inline-flex max-w-[16rem] items-center gap-1 rounded-lg border border-border bg-muted/50 py-0.5 pl-2 pr-1 text-xs"
            >
              <FileText className="h-3 w-3 shrink-0 text-tenant" />
              <span className="truncate">{docName(id)}</span>
              <button
                type="button"
                onClick={() => toggleDoc(id)}
                disabled={disabled}
                className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label={`Remove ${docName(id)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/* --------------------------------- bits ---------------------------------- */

function Divider() {
  return <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
}

const ToolButton = ({
  label,
  active = false,
  disabled = false,
  onClick,
  children,
  ...rest
}: {
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
} & React.ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button
    type="button"
    title={label}
    aria-label={label}
    aria-pressed={active}
    disabled={disabled}
    // Keep the editor's selection while clicking the toolbar.
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    {...rest}
    className={`inline-flex h-8 min-w-8 items-center justify-center rounded-md px-1.5 transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
      active ? "bg-tenant text-white" : "text-foreground hover:bg-background"
    }`}
  >
    {children}
  </button>
);

type MenuItem = {
  key: string;
  icon?: React.ReactNode;
  text: string;
  textClass?: string;
  checked: boolean;
  onSelect: () => void;
};

function ToolMenu({
  label,
  active,
  disabled,
  trigger,
  items,
}: {
  label: string;
  active: boolean;
  disabled: boolean;
  trigger: React.ReactNode;
  items: MenuItem[];
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <ToolButton label={label} active={active} disabled={disabled}>
          <span className="inline-flex items-center gap-0.5">
            {trigger}
            <ChevronDown className="h-3 w-3 opacity-70" />
          </span>
        </ToolButton>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-48 p-1"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        {items.map((it) => (
          <button
            key={it.key}
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              it.onSelect();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left hover:bg-muted"
          >
            {it.icon}
            <span className={`flex-1 ${it.textClass ?? "text-sm"}`}>{it.text}</span>
            {it.checked && <Check className="h-3.5 w-3.5 text-tenant" />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
