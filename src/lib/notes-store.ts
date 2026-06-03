// Tenant-scoped notes + templates store (mock). Module-level state with
// useSyncExternalStore — mirrors status-store.ts.

import { useSyncExternalStore } from "react";
import {
  builtInTemplates,
  seedNotes,
  type Note,
  type NoteTemplate,
  type NoteAuditEntry,
  type NoteEditSnapshot,
  type TemplateField,
  type NoteVisibility,
  type TemplateCategory,
} from "./notes-mock";
import { logAudit } from "./audit-timeline-store";
import { isManagerOrAdmin, type DemoRole } from "./demo-role";

// Tenant setting: allow creator to edit/delete same-day notes.
export const TENANT_NOTES_SETTINGS = { allowSameDayEditDelete: true };


let notes: Note[] = seedNotes.map((n) => ({ ...n, fields: { ...n.fields }, attachments: [...n.attachments], links: [...n.links], audit: [...n.audit] }));
let templates: NoteTemplate[] = builtInTemplates.map((t) => ({ ...t, fields: t.fields.map((f) => ({ ...f })) }));

const noteListeners = new Set<() => void>();
const tplListeners = new Set<() => void>();

function emitNotes() { for (const l of noteListeners) l(); }
function emitTpls() { for (const l of tplListeners) l(); }

const subNotes = (cb: () => void) => { noteListeners.add(cb); return () => noteListeners.delete(cb); };
const subTpls = (cb: () => void) => { tplListeners.add(cb); return () => tplListeners.delete(cb); };

const getNotesSnap = () => notes;
const getTplsSnap = () => templates;

export function useNotesAll(): Note[] {
  return useSyncExternalStore(subNotes, getNotesSnap, getNotesSnap);
}

export function useDebtorNotes(debtorId: string): Note[] {
  const all = useNotesAll();
  return all.filter((n) => n.debtorId === debtorId && !n.deletedAt);
}

export function useDebtorNotesIncludingDeleted(debtorId: string): Note[] {
  const all = useNotesAll();
  return all.filter((n) => n.debtorId === debtorId);
}

export function useNote(id: string): Note | undefined {
  const all = useNotesAll();
  return all.find((n) => n.id === id);
}

export function useNoteTemplates(): NoteTemplate[] {
  return useSyncExternalStore(subTpls, getTplsSnap, getTplsSnap);
}

export function findTemplate(id: string): NoteTemplate | undefined {
  return templates.find((t) => t.id === id);
}

// ---------- Permission helpers ----------

function isSameDay(iso: string): boolean {
  const a = new Date(iso); const b = new Date();
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function canEditNote(note: Note, role: DemoRole, actor: string): boolean {
  if (note.deletedAt) return false;
  if (isManagerOrAdmin(role)) return true;
  if (!TENANT_NOTES_SETTINGS.allowSameDayEditDelete) return false;
  return note.createdBy === actor && isSameDay(note.createdAt);
}

export function canDeleteNote(note: Note, role: DemoRole, actor: string): boolean {
  if (note.deletedAt) return false;
  if (isManagerOrAdmin(role)) return true;
  if (!TENANT_NOTES_SETTINGS.allowSameDayEditDelete) return false;
  return note.createdBy === actor && isSameDay(note.createdAt);
}

// ---------- Note CRUD ----------

export function createNote(input: Omit<Note, "id" | "createdAt" | "updatedAt" | "audit"> & { actor?: string }): Note {
  const ts = new Date().toISOString();
  const actor = input.actor ?? input.createdBy ?? "Maya Lindstrom";
  const note: Note = {
    ...input,
    id: `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    source: input.source ?? "human",
    createdAt: ts,
    updatedAt: ts,
    audit: [{ id: `a_${Date.now()}`, when: ts, actor, action: "Created note" }],
    editHistory: [],
  };
  notes = [note, ...notes];
  emitNotes();
  logAudit({
    debtorId: note.debtorId, actor, actorKind: note.source === "ai" ? "ai" : "human",
    category: "note", action: "Note added", summary: note.title,
  });
  return note;
}

export function updateNote(id: string, patch: Partial<Note>, actor = "Maya Lindstrom"): boolean {
  const idx = notes.findIndex((n) => n.id === id);
  if (idx === -1) return false;
  const prev = notes[idx];
  if (prev.deletedAt) return false;
  const ts = new Date().toISOString();
  const audit: NoteAuditEntry = { id: `a_${Date.now()}`, when: ts, actor, action: "Edited note" };
  const snap: NoteEditSnapshot = {
    id: `s_${Date.now()}`, at: ts, actor,
    prevTitle: prev.title, prevBodyHtml: prev.bodyHtml,
  };
  const editHistory = [snap, ...(prev.editHistory ?? [])];
  notes = notes.map((n) => (n.id === id ? { ...n, ...patch, id: n.id, updatedAt: ts, audit: [audit, ...n.audit], editHistory } : n));
  emitNotes();
  logAudit({
    debtorId: prev.debtorId, actor, actorKind: "human",
    category: "note", action: "Note edited", summary: prev.title,
  });
  return true;
}

export function deleteNote(id: string, opts: { actor: string; reason: string; role: DemoRole }): { ok: boolean; error?: string } {
  const n = notes.find((x) => x.id === id);
  if (!n) return { ok: false, error: "Note not found" };
  if (!canDeleteNote(n, opts.role, opts.actor)) return { ok: false, error: "You are not allowed to delete this note." };
  if (!opts.reason.trim()) return { ok: false, error: "Reason required." };
  const ts = new Date().toISOString();
  notes = notes.map((x) => (x.id === id ? {
    ...x, deletedAt: ts, deletedBy: opts.actor, deleteReason: opts.reason.trim(),
    audit: [{ id: `a_${Date.now()}`, when: ts, actor: opts.actor, action: "Deleted note", detail: opts.reason.trim() }, ...x.audit],
  } : x));
  emitNotes();
  logAudit({
    debtorId: n.debtorId, actor: opts.actor, actorKind: "human",
    category: "note", action: "Note deleted (soft)", summary: n.title, reason: opts.reason.trim(),
  });
  return { ok: true };
}

export function togglePin(id: string, actor = "Maya Lindstrom"): boolean {
  const n = notes.find((x) => x.id === id);
  if (!n) return false;
  const ts = new Date().toISOString();
  const next = !n.pinned;
  notes = notes.map((x) =>
    x.id === id
      ? {
          ...x,
          pinned: next,
          updatedAt: ts,
          audit: [{ id: `a_${Date.now()}`, when: ts, actor, action: next ? "Pinned note" : "Unpinned note" }, ...x.audit],
        }
      : x,
  );
  emitNotes();
  return true;
}

// ---------- Template CRUD ----------

export function createTemplate(input?: Partial<NoteTemplate>): NoteTemplate {
  const id = `tpl_${Date.now()}`;
  const tpl: NoteTemplate = {
    id,
    name: input?.name ?? "New custom template",
    category: input?.category ?? "custom",
    icon: input?.icon ?? "NT",
    description: input?.description ?? "Custom note template",
    defaultVisibility: input?.defaultVisibility ?? "internal",
    isBuiltIn: false,
    fields: input?.fields ?? [],
  };
  templates = [...templates, tpl];
  emitTpls();
  return tpl;
}

export function updateTemplate(id: string, patch: Partial<NoteTemplate>): { ok: boolean; error?: string } {
  const t = templates.find((x) => x.id === id);
  if (!t) return { ok: false, error: "Template not found" };
  if (t.isBuiltIn) return { ok: false, error: "Built-in templates cannot be edited" };
  templates = templates.map((x) => (x.id === id ? { ...x, ...patch, id: x.id, isBuiltIn: false } : x));
  emitTpls();
  return { ok: true };
}

export function deleteTemplate(id: string): { ok: boolean; error?: string } {
  const t = templates.find((x) => x.id === id);
  if (!t) return { ok: false, error: "Template not found" };
  if (t.isBuiltIn) return { ok: false, error: "Built-in templates cannot be deleted" };
  templates = templates.filter((x) => x.id !== id);
  emitTpls();
  return { ok: true };
}

export function upsertTemplateField(id: string, field: TemplateField): boolean {
  const t = templates.find((x) => x.id === id);
  if (!t || t.isBuiltIn) return false;
  const exists = t.fields.some((f) => f.key === field.key);
  const fields = exists ? t.fields.map((f) => (f.key === field.key ? field : f)) : [...t.fields, field];
  return updateTemplate(id, { fields }).ok;
}

export function removeTemplateField(id: string, key: string): boolean {
  const t = templates.find((x) => x.id === id);
  if (!t || t.isBuiltIn) return false;
  return updateTemplate(id, { fields: t.fields.filter((f) => f.key !== key) }).ok;
}

export type { Note, NoteTemplate, NoteVisibility, TemplateCategory, TemplateField };
