import { Sidebar } from "./Sidebar";
import { CommandPalette } from "./CommandPalette";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";

export function Shell({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-gradient-subtle">
        <Sidebar />
        <SidebarInset className="min-w-0 flex flex-col">
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-gradient-glow pointer-events-none opacity-60" />
            <div className="relative">{children}</div>
          </div>
        </SidebarInset>
        <CommandPalette />
      </div>
    </SidebarProvider>
  );
}
