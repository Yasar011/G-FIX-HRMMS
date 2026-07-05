"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { ADMIN_NAV } from "@/lib/admin-nav";

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, role, loading, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-zinc-500">
        Loading...
      </div>
    );
  }

  if (role !== "superadmin" && role !== "editor") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
          Not authorized
        </h1>
        <p className="max-w-sm text-sm text-zinc-500">
          Your account ({user.email}) doesn&apos;t have admin access yet. Ask
          the Super Admin to grant you an Editor or Super Admin role.
        </p>
        <button
          onClick={() => signOut()}
          className="mt-4 text-sm font-medium text-zinc-700 underline dark:text-zinc-300"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-1">
      <aside className="w-64 shrink-0 border-r border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
        <div className="px-2 pb-4 text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          Factory Control Center
        </div>
        <nav className="flex flex-col gap-4">
          {ADMIN_NAV.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-1 text-xs font-medium uppercase tracking-wide text-zinc-400">
                {group.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {group.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`rounded-md px-2 py-1.5 text-sm ${
                        active
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-900"
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </aside>

      <div className="flex flex-1 flex-col">
        <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3 dark:border-zinc-800 dark:bg-zinc-950">
          <div className="text-sm text-zinc-500">
            Signed in as <span className="font-medium">{user.email}</span>{" "}
            <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              {role}
            </span>
          </div>
          <button
            onClick={() => signOut()}
            className="text-sm font-medium text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            Sign out
          </button>
        </header>
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
