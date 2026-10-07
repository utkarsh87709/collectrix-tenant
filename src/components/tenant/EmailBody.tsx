import { useMemo } from "react";

// Email bodies come back from the backend as whatever the template or sender
// wrote — plain text with newlines, HTML, or plain text with a few inline tags
// (`You have <b>outstanding</b> balance…`). Printing them as text shows the
// raw tags, so this renders the markup through an allowlist instead: known
// formatting tags survive without attributes (links keep a safe href), unknown
// tags are unwrapped to their text, and anything executable or remote-loading
// (script, style, iframe, img, …) is dropped outright.

const ALLOWED = new Set([
  "a",
  "b",
  "strong",
  "i",
  "em",
  "u",
  "s",
  "small",
  "sub",
  "sup",
  "mark",
  "span",
  "br",
  "p",
  "div",
  "blockquote",
  "pre",
  "code",
  "hr",
  "ul",
  "ol",
  "li",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "table",
  "thead",
  "tbody",
  "tfoot",
  "tr",
  "td",
  "th",
]);

/** Removed together with their contents. */
const DROPPED = new Set([
  "script",
  "style",
  "iframe",
  "frame",
  "frameset",
  "object",
  "embed",
  "noscript",
  "template",
  "img",
  "svg",
  "math",
  "video",
  "audio",
  "source",
  "picture",
  "link",
  "meta",
  "base",
  "form",
  "input",
  "button",
  "select",
  "textarea",
  "head",
  "title",
]);

/** Tags whose presence means the source newlines are formatting noise, not
 *  line breaks the sender meant. */
const BLOCK_TAG = /<\s*(br|p|div|li|ul|ol|table|tr|h[1-6]|blockquote|pre)\b/i;
const ANY_TAG = /<\/?[a-z][^>]*>/i;
const ENCODED_TAG = /&lt;\/?[a-z][\s\S]*?&gt;/i;

function safeHref(href: string | null): string | null {
  if (!href) return null;
  const v = href.trim();
  return /^(https?:|mailto:|tel:)/i.test(v) ? v : null;
}

function cleanNode(node: Node, doc: Document): Node | null {
  if (node.nodeType === Node.TEXT_NODE) return doc.createTextNode(node.textContent ?? "");
  if (node.nodeType !== Node.ELEMENT_NODE) return null;

  const el = node as Element;
  const tag = el.tagName.toLowerCase();
  if (DROPPED.has(tag)) return null;

  const children = Array.from(el.childNodes)
    .map((c) => cleanNode(c, doc))
    .filter((c): c is Node => c != null);

  if (!ALLOWED.has(tag)) {
    // Unknown wrapper (html, body, font, center, …) — keep its content only.
    const frag = doc.createDocumentFragment();
    children.forEach((c) => frag.appendChild(c));
    return frag;
  }

  const out = doc.createElement(tag);
  if (tag === "a") {
    const href = safeHref(el.getAttribute("href"));
    if (href) {
      out.setAttribute("href", href);
      out.setAttribute("target", "_blank");
      out.setAttribute("rel", "noopener noreferrer nofollow");
    }
  }
  if ((tag === "td" || tag === "th") && el.getAttribute("colspan")) {
    const span = Number(el.getAttribute("colspan"));
    if (Number.isInteger(span) && span > 1 && span < 50) out.setAttribute("colspan", String(span));
  }
  children.forEach((c) => out.appendChild(c));
  return out;
}

/** Returns sanitised HTML, or null when the body is plain text. */
function sanitizeEmailHtml(input: string | null | undefined): string | null {
  if (!input || typeof DOMParser === "undefined") return null;
  let src = input;
  // Some senders double-encode, so the tags arrive as &lt;b&gt;. Decode once
  // so they render as formatting rather than as literal angle brackets.
  if (!ANY_TAG.test(src) && ENCODED_TAG.test(src)) {
    src = new DOMParser().parseFromString(src, "text/html").documentElement.textContent ?? src;
  }
  if (!ANY_TAG.test(src)) return null;

  const parsed = new DOMParser().parseFromString(src, "text/html");
  const doc = document.implementation.createHTMLDocument("");
  const wrap = doc.createElement("div");
  Array.from(parsed.body.childNodes).forEach((c) => {
    const cleaned = cleanNode(c, doc);
    if (cleaned) wrap.appendChild(cleaned);
  });
  return wrap.innerHTML;
}

/**
 * Renders an email body: sanitised HTML when it contains markup, plain text
 * (newlines preserved) otherwise. Styling inherits the bubble's text colour so
 * it reads on both the tinted outgoing and the neutral incoming bubbles.
 */
export function EmailBody({
  body,
  className = "",
}: {
  body: string | null | undefined;
  className?: string;
}) {
  const html = useMemo(() => sanitizeEmailHtml(body), [body]);

  if (html == null) {
    return <div className={`whitespace-pre-wrap break-words ${className}`}>{body ?? ""}</div>;
  }

  // Inline-only HTML (the common template case) still relies on its newlines
  // for paragraphs; full HTML lays itself out with block tags.
  const whitespace = BLOCK_TAG.test(html) ? "" : "whitespace-pre-wrap";
  return (
    <div
      className={`break-words ${whitespace} [&_a]:underline [&_a]:underline-offset-2 [&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_h1]:font-semibold [&_h2]:font-semibold [&_h3]:font-semibold [&_h4]:font-semibold [&_blockquote]:border-l-2 [&_blockquote]:border-current/30 [&_blockquote]:pl-3 [&_blockquote]:opacity-90 [&_table]:my-1.5 [&_td]:pr-3 [&_td]:align-top [&_th]:pr-3 [&_th]:text-left [&_pre]:whitespace-pre-wrap [&_hr]:my-2 [&_hr]:border-current/30 ${className}`}
      // Safe: built by sanitizeEmailHtml from an allowlist, no attributes
      // except vetted hrefs and colspan.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
