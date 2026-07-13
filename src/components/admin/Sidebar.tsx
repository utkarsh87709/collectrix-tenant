import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronsUpDown, LogOut, ChevronRight } from "lucide-react";
import { MyProfilePanel } from "@/components/admin/MyProfilePanel";
import { cn } from "@/lib/utils";
import logo from "@/assets/collectrix-logo.png";
import { useAuth } from "@/lib/auth-context";
import { tenantGroups, type NavItem } from "@/lib/nav-registry";
import { useDemoRole } from "@/lib/demo-role";
import { canSeeAnalyticsModule } from "@/lib/analytics-permissions";
import {
  Sidebar as UiSidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Bold gradient pill — marks the actual current page (a top-level item or an
// active submodule leaf). Gradient + glow + a hairline ring for depth.
const ACTIVE_CLS =
  "bg-gradient-tenant text-white font-semibold shadow-tenant ring-1 ring-white/15 hover:bg-gradient-tenant hover:text-white data-[active=true]:bg-gradient-tenant data-[active=true]:text-white data-[active=true]:ring-1 data-[active=true]:ring-white/15";

// Quiet treatment for a parent module whose child is the current page — a soft
// tint + azure accent so it reads as "open section", not a second active pill.
const SECTION_OPEN_CLS =
  "bg-sidebar-accent/60 font-semibold text-tenant hover:bg-sidebar-accent/80 hover:text-tenant";

// Idle nav rows: a touch muted so the active pill clearly wins the eye.
const IDLE_CLS = "text-sidebar-foreground/80 hover:text-sidebar-foreground";

// Icon "chip" behind each nav icon — the signature of the bolder look. It
// collapses back to a bare icon when the sidebar is in icon-only mode.
const CHIP_BASE =
  "flex h-7 w-7 items-center justify-center rounded-lg shrink-0 transition-colors group-data-[collapsible=icon]:!h-5 group-data-[collapsible=icon]:!w-5 group-data-[collapsible=icon]:!bg-transparent";
const CHIP_IDLE =
  "bg-sidebar-accent/50 text-sidebar-foreground/70 group-hover/menu-item:text-[color:var(--tenant)] group-hover/menu-item:bg-sidebar-accent";
const CHIP_ACTIVE = "bg-white/20 text-white";
const CHIP_SECTION = "bg-[color:var(--tenant)]/20 text-tenant";

function isActivePath(pathname: string, to: string): boolean {
  // Exact match for short roots; prefix match otherwise
  if (to === "/" || to === "/tenant") return pathname === to;
  return pathname === to || pathname.startsWith(to + "/");
}

function isActiveFor(pathname: string, item: NavItem): boolean {
  return isActivePath(pathname, item.to);
}

function NavMenuItem({ item, pathname }: { item: NavItem; pathname: string }) {
  const Icon = item.icon;
  const hasSub = !!item.submodules?.length;
  const subActive = item.submodules?.some((s) => isActivePath(pathname, s.to)) ?? false;
  const active = isActiveFor(pathname, item);
  const [open, setOpen] = useState(subActive);

  if (!hasSub) {
    return (
      <SidebarMenuItem>
        <SidebarMenuButton
          asChild
          isActive={active}
          tooltip={item.label}
          className={cn("h-9", active ? ACTIVE_CLS : IDLE_CLS)}
        >
          <Link to={item.to as never}>
            <span className={cn(CHIP_BASE, active ? CHIP_ACTIVE : CHIP_IDLE)}>
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen} asChild>
      <SidebarMenuItem>
        <CollapsibleTrigger asChild>
          <SidebarMenuButton
            isActive={false}
            tooltip={item.label}
            className={cn("h-9", subActive ? SECTION_OPEN_CLS : IDLE_CLS)}
          >
            <span className={cn(CHIP_BASE, subActive ? CHIP_SECTION : CHIP_IDLE)}>
              <Icon className="h-4 w-4" />
            </span>
            <span>{item.label}</span>
            <ChevronRight
              className={cn("ml-auto h-4 w-4 transition-transform opacity-60", open && "rotate-90")}
            />
          </SidebarMenuButton>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {item.submodules!.map((sub) => {
              if (sub.disabled) {
                return (
                  <SidebarMenuSubItem key={sub.to}>
                    <SidebarMenuSubButton
                      aria-disabled
                      className="pointer-events-none cursor-not-allowed opacity-50"
                    >
                      <span className="h-1.5 w-1.5 rounded-full bg-sidebar-foreground/30 shrink-0" />
                      <span>{sub.label}</span>
                    </SidebarMenuSubButton>
                  </SidebarMenuSubItem>
                );
              }
              const sActive = isActivePath(pathname, sub.to);
              return (
                <SidebarMenuSubItem key={sub.to}>
                  <SidebarMenuSubButton
                    asChild
                    isActive={sActive}
                    className={cn("group/sub", sActive ? ACTIVE_CLS : IDLE_CLS)}
                  >
                    <Link to={sub.to as never}>
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full shrink-0 transition-colors",
                          sActive
                            ? "bg-white"
                            : "bg-sidebar-foreground/30 group-hover/sub:bg-[color:var(--tenant)]",
                        )}
                      />
                      <span>{sub.label}</span>
                    </Link>
                  </SidebarMenuSubButton>
                </SidebarMenuSubItem>
              );
            })}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  );
}

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const [profileOpen, setProfileOpen] = useState(false);

  const fullName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "Tenant Admin";
  const initials =
    fullName
      .split(/\s+/)
      .map((w) => w[0])
      .slice(0, 2)
      .join("")
      .toUpperCase() || "TA";
  const email = user?.emailId ?? "";

  const role = useDemoRole();
  const groups = tenantGroups
    .map((g) => ({
      ...g,
      items: g.items.filter((i) => i.to !== "/tenant/analytics" || canSeeAnalyticsModule(role)),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <UiSidebar
      collapsible="icon"
      className="border-r border-sidebar-border [&_[data-sidebar=sidebar]]:bg-gradient-to-b [&_[data-sidebar=sidebar]]:from-sidebar-accent/35 [&_[data-sidebar=sidebar]]:via-sidebar [&_[data-sidebar=sidebar]]:to-sidebar"
    >
      <SidebarHeader className="p-0 border-b border-sidebar-border/70">
        <div
          className={`flex items-center overflow-hidden ${collapsed ? "justify-center px-2 py-4" : "px-4 py-5"}`}
        >
          <img
            src={logo}
            alt="Collectrix Ai"
            className="select-none"
            style={
              collapsed
                ? {
                    height: 44,
                    width: 44,
                    objectFit: "cover",
                    objectPosition: "left center",
                    filter: "brightness(0) invert(1)",
                  }
                : { height: 46, width: "auto", filter: "brightness(0) invert(1)" }
            }
            draggable={false}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && (
              <SidebarGroupLabel className="text-[10px] font-semibold uppercase tracking-[0.14em] text-sidebar-foreground/45">
                {group.label}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavMenuItem key={item.to} item={item} pathname={pathname} />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border/70">
        {!collapsed && (
          <div className="space-y-1 px-2 pb-1">
            <div
              className={cn(
                "mt-2 w-full flex items-center gap-2 px-2 py-2 rounded-xl border transition-colors",
                profileOpen
                  ? "border-[color:var(--tenant)]/50 bg-[color:var(--tenant)]/15"
                  : "border-transparent bg-sidebar-accent/40 hover:bg-sidebar-accent/70",
              )}
            >
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-tenant flex items-center justify-center text-xs font-bold text-white shrink-0 shadow-tenant">
                  {initials}
                </div>
                <div className="text-xs min-w-0 flex-1">
                  <div
                    className={cn(
                      "font-semibold truncate",
                      profileOpen ? "text-tenant" : "text-sidebar-foreground",
                    )}
                  >
                    {fullName}
                  </div>
                  <div className="text-sidebar-foreground/60 truncate">Tenant Administrator</div>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className="p-1 rounded-md hover:bg-sidebar-accent shrink-0"
                    aria-label="Account menu"
                  >
                    <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">{fullName}</span>
                    {email && (
                      <span className="text-xs text-muted-foreground truncate">{email}</span>
                    )}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => {
                      logout();
                      navigate({ to: "/login" });
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <LogOut className="h-4 w-4 mr-2" /> Sign out
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        )}
        {collapsed && (
          <div className="flex justify-center py-2">
            <button
              onClick={() => setProfileOpen(true)}
              aria-label="Open profile"
              className="h-8 w-8 rounded-full bg-gradient-tenant flex items-center justify-center text-xs font-bold text-white shadow-tenant ring-1 ring-white/10 hover:ring-white/30 transition"
            >
              {initials}
            </button>
          </div>
        )}
      </SidebarFooter>
      <MyProfilePanel open={profileOpen} onClose={() => setProfileOpen(false)} />
    </UiSidebar>
  );
}
