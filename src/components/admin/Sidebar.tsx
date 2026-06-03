import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { ChevronsUpDown, LogOut, ChevronLeft, ChevronRight } from "lucide-react";
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
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function isActiveFor(pathname: string, item: NavItem): boolean {
  // Exact match for short roots; prefix match otherwise
  if (item.to === "/" || item.to === "/tenant") return pathname === item.to;
  return pathname === item.to || pathname.startsWith(item.to + "/");
}

export function Sidebar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { logout, user } = useAuth();
  const { state, toggleSidebar } = useSidebar();
  const collapsed = state === "collapsed";
  const [profileOpen, setProfileOpen] = useState(false);

  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "Tenant Admin";
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
    .map((g) => ({ ...g, items: g.items.filter((i) => i.to !== "/tenant/analytics" || canSeeAnalyticsModule(role)) }))
    .filter((g) => g.items.length > 0);

  return (
    <UiSidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Manual collapse/expand toggle — centered on the right edge. */}
      <button
        onClick={toggleSidebar}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="absolute top-1/2 -right-3 -translate-y-1/2 z-20 h-6 w-6 rounded-full bg-sidebar border border-sidebar-border text-sidebar-foreground shadow-md flex items-center justify-center hover:bg-sidebar-accent transition"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </button>
      <SidebarHeader className="p-0 border-b border-sidebar-border">
        <div className={`flex items-center overflow-hidden ${collapsed ? "justify-center px-2 py-4" : "px-4 py-5"}`}>
          <img
            src={logo}
            alt="Collectrix Ai"
            className="select-none"
            style={
              collapsed
                ? { height: 32, width: 32, objectFit: "cover", objectPosition: "left center", filter: "brightness(0) invert(1)" }
                : { height: 40, width: "auto", filter: "brightness(0) invert(1)" }
            }
            draggable={false}
          />
        </div>
      </SidebarHeader>

      <SidebarContent>
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            {!collapsed && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = isActiveFor(pathname, item);
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton
                        asChild
                        isActive={active}
                        tooltip={item.label}
                        className={
                          active
                            ? "bg-gradient-tenant text-white shadow-tenant hover:bg-gradient-tenant hover:text-white data-[active=true]:bg-gradient-tenant data-[active=true]:text-white"
                            : ""
                        }
                      >
                        <Link to={item.to as never}>
                          <Icon className="h-4 w-4 shrink-0" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {!collapsed && (
          <div className="space-y-1 px-2 pb-1">
            <div
              className={cn(
                "mt-2 w-full flex items-center gap-2 px-2 py-2 rounded-lg transition",
                profileOpen ? "" : "bg-sidebar-accent/50 hover:bg-sidebar-accent",
              )}
              style={profileOpen ? { background: "#EEEDFE", border: "0.5px solid #534AB7" } : undefined}
            >
              <button
                onClick={() => setProfileOpen(true)}
                className="flex items-center gap-3 flex-1 min-w-0 text-left"
              >
                <div className="h-8 w-8 rounded-full bg-gradient-tenant flex items-center justify-center text-xs font-bold text-white shrink-0">
                  {initials}
                </div>
                <div className="text-xs min-w-0 flex-1">
                  <div className="font-semibold truncate" style={profileOpen ? { color: "#3C3489" } : undefined}>
                    {fullName}
                  </div>
                  <div className="text-sidebar-foreground/60 truncate">
                    Tenant Administrator
                  </div>
                </div>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="p-1 rounded hover:bg-sidebar-accent shrink-0" aria-label="Account menu">
                    <ChevronsUpDown className="h-3.5 w-3.5 text-sidebar-foreground/50" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="end" className="w-56">
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="text-sm font-medium truncate">{fullName}</span>
                    {email && <span className="text-xs text-muted-foreground truncate">{email}</span>}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { logout(); navigate({ to: "/login" }); }}
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
              className="h-8 w-8 rounded-full bg-gradient-tenant flex items-center justify-center text-xs font-bold text-white"
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
