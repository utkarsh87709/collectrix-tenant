// Topbar notification bell + popover. Reads from the notifications store.
import { Bell, Check, CheckCheck, Trash2, MessageSquare, Mail, Phone, Moon, PhoneCall, AlertTriangle, ShieldAlert, DollarSign, Banknote, UserCog, Gavel } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useNotifications, markRead, markAllRead, clearAll, CATEGORY_LABEL, type Notification, type NotificationCategory } from "@/lib/notifications-store";

const ICON: Record<NotificationCategory, React.ComponentType<{ className?: string }>> = {
  inbound_sms: MessageSquare,
  inbound_email: Mail,
  inbound_call: Phone,
  after_hours_message: Moon,
  debtor_callback_request: PhoneCall,
  ai_transfer_failed: AlertTriangle,
  validation_warning: ShieldAlert,
  payment_reported: DollarSign,
  payment_posted: Banknote,
  assignment_changed: UserCog,
  dispute_raised: Gavel,
};

const SEVERITY_CLS: Record<Notification["severity"], string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

function timeAgo(iso: string) {
  const d = (Date.now() - new Date(iso).getTime()) / 1000;
  if (d < 60) return `${Math.floor(d)}s`;
  if (d < 3600) return `${Math.floor(d / 60)}m`;
  if (d < 86400) return `${Math.floor(d / 3600)}h`;
  return `${Math.floor(d / 86400)}d`;
}

export function NotificationBell() {
  const items = useNotifications();
  const unread = items.filter((n) => !n.read).length;
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-muted transition-colors shrink-0"
        aria-label="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unread > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-destructive text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-background">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-[380px] max-w-[92vw] rounded-xl border border-border bg-card shadow-elegant z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <div>
              <div className="text-sm font-semibold">Notifications</div>
              <div className="text-[11px] text-muted-foreground">{unread} unread · {items.length} total</div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={markAllRead}
                disabled={unread === 0}
                className="text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md hover:bg-muted disabled:opacity-40"
                title="Mark all as read"
              >
                <CheckCheck className="h-3.5 w-3.5" /> Mark all
              </button>
              <button
                onClick={clearAll}
                disabled={items.length === 0}
                className="text-[11px] font-semibold inline-flex items-center gap-1 px-2 py-1 rounded-md text-destructive hover:bg-destructive/10 disabled:opacity-40"
                title="Clear all"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          <div className="max-h-[420px] overflow-y-auto divide-y divide-border">
            {items.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                <Bell className="h-6 w-6 mx-auto opacity-30 mb-2" />
                No notifications yet.
              </div>
            )}
            {items.map((n) => {
              const Icon = ICON[n.category];
              const Inner = (
                <div className={`px-3 py-2.5 flex items-start gap-2.5 ${n.read ? "" : "bg-tenant-soft/40"} hover:bg-muted/60 transition`}>
                  <div className={`shrink-0 mt-0.5 ${SEVERITY_CLS[n.severity]}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                        {CATEGORY_LABEL[n.category]}
                      </span>
                      {!n.read && <span className="h-1.5 w-1.5 rounded-full bg-tenant" />}
                      <span className="ml-auto text-[10px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                    </div>
                    <div className="text-sm font-medium truncate">{n.title}</div>
                    {n.body && <div className="text-xs text-muted-foreground line-clamp-2">{n.body}</div>}
                  </div>
                  {!n.read && (
                    <button
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); markRead(n.id); }}
                      className="shrink-0 p-1 rounded hover:bg-muted text-muted-foreground"
                      title="Mark read"
                    >
                      <Check className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              );
              return n.href ? (
                <Link key={n.id} to={n.href as never} onClick={() => { markRead(n.id); setOpen(false); }}>
                  {Inner}
                </Link>
              ) : (
                <div key={n.id} onClick={() => markRead(n.id)} className="cursor-pointer">{Inner}</div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
