import { redirect } from "next/navigation";
import { ToastProvider } from "@/components/ui";
import { ROLE_SPEC } from "@/lib/roles";
import { getSessionUser } from "@/lib/session";
import { Shell } from "./shell";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login?next=/dashboard");
  const spec = ROLE_SPEC[user.role];
  return (
    <ToastProvider>
      <Shell
        me={{
          id: user.id,
          username: user.username,
          role: user.role,
          canManageUsers: spec.canCreate.length > 0,
          viewAudit: spec.viewAudit,
          manageAll: spec.manageAll,
        }}
      >
        {children}
      </Shell>
    </ToastProvider>
  );
}
