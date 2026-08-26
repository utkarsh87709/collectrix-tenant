// Built-in note templates and seed notes for Epic 10.
// Pure data — store lives in notes-store.ts.

export type FieldType = "text" | "textarea" | "select" | "date" | "number" | "currency";
export type NoteVisibility = "internal" | "creditor";
export type TemplateCategory =
  | "contact_attempt"
  | "conversation"
  | "hardship"
  | "legal_notice"
  | "payment_arrangement"
  | "dispute"
  | "custom";

export type TemplateField = {
  key: string;
  label: string;
  type: FieldType;
  required: boolean;
  options?: string[];
  placeholder?: string;
};

export type NoteTemplate = {
  id: string;
  name: string;
  category: TemplateCategory;
  description: string;
  icon: string;
  fields: TemplateField[];
  defaultVisibility: NoteVisibility;
  isBuiltIn: boolean;
};

export type NoteAttachment = {
  id: string;
  name: string;
  size: number;
  type: string;
  dataUrl?: string;
};

export type NoteLink = {
  id: string;
  kind: "payment" | "letter" | "call" | "email" | "debtor";
  label: string;
  href?: string;
};

export type NoteAuditEntry = {
  id: string;
  when: string;
  actor: string;
  action: string;
  detail?: string;
};

export type NoteSource = "human" | "ai";

export type NoteEditSnapshot = {
  id: string;
  at: string;
  actor: string;
  prevTitle: string;
  prevBodyHtml: string;
};

export type Note = {
  id: string;
  debtorId: string;
  templateId: string;
  type: string;
  category: TemplateCategory;
  title: string;
  fields: Record<string, string>;
  bodyHtml: string;
  visibility: NoteVisibility;
  pinned: boolean;
  attachments: NoteAttachment[];
  links: NoteLink[];
  voiceTranscript?: string;
  createdBy: string;
  source?: NoteSource;          // default "human"
  createdAt: string;
  updatedAt: string;
  audit: NoteAuditEntry[];
  editHistory?: NoteEditSnapshot[];
  deletedAt?: string;
  deletedBy?: string;
  deleteReason?: string;
};

export const builtInTemplates: NoteTemplate[] = [
  {
    id: "tpl_contact",
    name: "Contact Attempt",
    category: "contact_attempt",
    icon: "CA",
    description: "Log an outbound contact attempt with outcome and next action.",
    defaultVisibility: "creditor",
    isBuiltIn: true,
    fields: [
      { key: "phone", label: "Phone number called", type: "text", required: true, placeholder: "+1 (416) 555-0142" },
      { key: "outcome", label: "Outcome", type: "select", required: true, options: ["Connected", "No answer", "Voicemail", "Wrong number", "Disconnected", "Refused"] },
      { key: "next_action", label: "Next action", type: "textarea", required: true, placeholder: "Schedule callback, send letter, escalate…" },
    ],
  },
  {
    id: "tpl_conversation",
    name: "Conversation Log",
    category: "conversation",
    icon: "CV",
    description: "Detailed log of a customer conversation.",
    defaultVisibility: "creditor",
    isBuiltIn: true,
    fields: [
      { key: "duration", label: "Duration (minutes)", type: "number", required: true },
      { key: "topics", label: "Topics discussed", type: "textarea", required: true },
      { key: "debtor_statements", label: "Customer statements", type: "textarea", required: false },
      { key: "agent_observations", label: "Agent observations", type: "textarea", required: false },
      { key: "next_steps", label: "Next steps", type: "textarea", required: true },
    ],
  },
  {
    id: "tpl_hardship",
    name: "Financial Hardship",
    category: "hardship",
    icon: "HD",
    description: "Document a financial hardship claim.",
    defaultVisibility: "internal",
    isBuiltIn: true,
    fields: [
      { key: "employment", label: "Employment status", type: "select", required: true, options: ["Employed full-time", "Employed part-time", "Self-employed", "Unemployed", "Retired", "Disabled"] },
      { key: "income", label: "Monthly income", type: "currency", required: true },
      { key: "expenses", label: "Monthly expenses", type: "currency", required: true },
      { key: "reason", label: "Hardship reason", type: "select", required: true, options: ["Job loss", "Medical", "Divorce", "Death in family", "Reduced hours", "Other"] },
      { key: "documentation", label: "Supporting documentation", type: "textarea", required: false },
    ],
  },
  {
    id: "tpl_legal",
    name: "Legal Notice",
    category: "legal_notice",
    icon: "LN",
    description: "Track a legal notice sent to the customer.",
    defaultVisibility: "creditor",
    isBuiltIn: true,
    fields: [
      { key: "notice_type", label: "Notice type", type: "select", required: true, options: ["Validation notice", "Demand letter", "Pre-litigation", "Summons", "Garnishment notice"] },
      { key: "date_sent", label: "Date sent", type: "date", required: true },
      { key: "delivery_method", label: "Delivery method", type: "select", required: true, options: ["Certified mail", "First-class mail", "Email", "Hand-delivery", "Process server"] },
      { key: "deadline", label: "Legal deadline", type: "date", required: true },
      { key: "attorney", label: "Attorney assigned", type: "text", required: false },
    ],
  },
  {
    id: "tpl_ptp",
    name: "Payment Arrangement",
    category: "payment_arrangement",
    icon: "PA",
    description: "Record a payment plan or promise-to-pay.",
    defaultVisibility: "creditor",
    isBuiltIn: true,
    fields: [
      { key: "amount", label: "Payment amount", type: "currency", required: true },
      { key: "frequency", label: "Frequency", type: "select", required: true, options: ["One-time", "Weekly", "Bi-weekly", "Monthly"] },
      { key: "start_date", label: "Start date", type: "date", required: true },
      { key: "total_payments", label: "Total payments", type: "number", required: true },
      { key: "method", label: "Payment method", type: "select", required: true, options: ["ACH", "Credit card", "Debit card", "Check", "Wire", "Money order"] },
    ],
  },
  {
    id: "tpl_dispute",
    name: "Dispute Details",
    category: "dispute",
    icon: "DS",
    description: "Capture a customer dispute and investigation status.",
    defaultVisibility: "internal",
    isBuiltIn: true,
    fields: [
      { key: "reason", label: "Dispute reason", type: "select", required: true, options: ["Not my debt", "Wrong amount", "Already paid", "Identity theft", "Fraud", "Statute of limitations", "Other"] },
      { key: "claims", label: "Customer claims", type: "textarea", required: true },
      { key: "evidence_requested", label: "Evidence requested", type: "textarea", required: false },
      { key: "investigation_status", label: "Investigation status", type: "select", required: true, options: ["Open", "Pending evidence", "Under review", "Resolved valid", "Resolved invalid"] },
      { key: "resolution", label: "Resolution", type: "textarea", required: false },
    ],
  },
];

const now = Date.now();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

function makeSeed(debtorId: string, base: number): Note[] {
  return [
    {
      id: `n_${debtorId}_1`,
      debtorId,
      templateId: "tpl_contact",
      type: "Contact Attempt",
      category: "contact_attempt",
      title: "Reached customer on mobile — committed to call back",
      fields: { phone: "+1 (416) 555-0142", outcome: "Connected", next_action: "Customer will call back Friday at 2pm with payment proposal." },
      bodyHtml: "<p>Spoke with customer for ~6 minutes. Tone cooperative. Acknowledged balance and indicated willingness to set up a payment plan once paycheck arrives Thursday.</p>",
      visibility: "creditor",
      pinned: false,
      attachments: [],
      links: [],
      createdBy: "Maya Lindstrom",
      createdAt: ago(base + 60),
      updatedAt: ago(base + 60),
      audit: [{ id: "a1", when: ago(base + 60), actor: "Maya Lindstrom", action: "Created note" }],
    },
    {
      id: `n_${debtorId}_2`,
      debtorId,
      templateId: "tpl_hardship",
      type: "Financial Hardship",
      category: "hardship",
      title: "AI summary — hardship signals detected",
      fields: { employment: "Unemployed", income: "0", expenses: "2400", reason: "Job loss", documentation: "EI stub forwarded by email." },
      bodyHtml: "<p><strong>AI generated:</strong> Lost employment 3 weeks ago, actively job-searching. Recommend pausing collection for 30 days and re-evaluating.</p>",
      visibility: "internal",
      pinned: true,
      attachments: [],
      links: [],
      createdBy: "AI Assistant",
      source: "ai",
      createdAt: ago(base + 240),
      updatedAt: ago(base + 240),
      audit: [
        { id: "a1", when: ago(base + 240), actor: "AI Assistant", action: "Created note (AI)" },
        { id: "a2", when: ago(base + 230), actor: "Theo Park", action: "Pinned note" },
      ],
    },
    {
      id: `n_${debtorId}_3`,
      debtorId,
      templateId: "tpl_ptp",
      type: "Payment Arrangement",
      category: "payment_arrangement",
      title: "PTP $250/mo for 6 months",
      fields: { amount: "250", frequency: "Monthly", start_date: "2026-05-01", total_payments: "6", method: "ACH" },
      bodyHtml: "<p>Customer agreed to a 6-month plan starting May 1. ACH authorization on file.</p>",
      visibility: "creditor",
      pinned: false,
      attachments: [],
      links: [],
      createdBy: "Maya Lindstrom",
      createdAt: ago(base + 1440),
      updatedAt: ago(base + 1440),
      audit: [{ id: "a1", when: ago(base + 1440), actor: "Maya Lindstrom", action: "Created note" }],
    },
  ];
}

export const seedNotes: Note[] = [
  ...makeSeed("d_10421", 30),
  ...makeSeed("d_10420", 90),
  ...makeSeed("d_10419", 120),
  ...makeSeed("d_10418", 180),
  ...makeSeed("d_10417", 60),
];
