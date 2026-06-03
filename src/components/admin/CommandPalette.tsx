import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import {
  CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { allRoutes, tenantGroups } from "@/lib/nav-registry";

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if (e.key === "/" && !typing && !open) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Listen for a global custom event so the topbar button can also open it.
  useEffect(() => {
    const handler = () => setOpen(true);
    window.addEventListener("collectrix:open-command", handler);
    return () => window.removeEventListener("collectrix:open-command", handler);
  }, []);

  const go = (to: string) => {
    setOpen(false);
    navigate({ to: to as never });
  };

  const primary = tenantGroups;

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Search pages, modules, settings…" />
      <CommandList>
        <CommandEmpty>No results found.</CommandEmpty>

        {primary.map((g) => (
          <CommandGroup key={g.label} heading={g.label}>
            {g.items.map((i) => {
              const Icon = i.icon;
              return (
                <CommandItem key={i.to} value={`${i.label} ${i.keywords ?? ""}`} onSelect={() => go(i.to)}>
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span>{i.label}</span>
                  {i.description && <span className="ml-auto text-xs text-muted-foreground">{i.description}</span>}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ))}

        <CommandSeparator />

        <CommandGroup heading="All destinations">
          {allRoutes.map((i) => {
            const Icon = i.icon;
            return (
              <CommandItem key={`all-${i.to}`} value={`${i.label} ${i.to} ${i.keywords ?? ""}`} onSelect={() => go(i.to)}>
                <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                <span>{i.label}</span>
                <span className="ml-auto text-[10px] font-mono text-muted-foreground">{i.to}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
