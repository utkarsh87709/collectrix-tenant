import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/tenant/settings")({
  component: SettingsLayout,
});

function SettingsLayout() {
  return <Outlet />;
}
