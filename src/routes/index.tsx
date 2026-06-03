import { createFileRoute, redirect } from "@tanstack/react-router";

// This is a tenant-admin-only frontend. The root path always lands on the
// tenant workspace.
export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/tenant" });
  },
});
