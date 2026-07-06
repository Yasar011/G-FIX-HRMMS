"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ThemeToggle } from "./ThemeToggle";

const NAV = [
  { label: "Factory", href: "/" },
  { label: "About", href: "/about" },
  { label: "Projects", href: "/projects" },
  { label: "Photography", href: "/photography" },
  { label: "Certificates", href: "/certificates" },
];

export function PublicShell({
  children,
  active,
}: {
  children: React.ReactNode;
  active?: string;
}) {
  const pathname = usePathname();
  const current = active ?? pathname;

  return (
    <div className="flex min-h-full flex-1 flex-col bg-white text-zinc-900 dark:bg-zinc-950 dark:text-zinc-100">
      <header className="sticky top-0 z-30 border-b border-zinc-200/70 bg-white/80 backdrop-blur-xl dark:border-zinc-800/70 dark:bg-zinc-950/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-3.5 sm:px-6">
          <Link href="/" className="flex items-center gap-2 font-heading text-base font-semibold tracking-tight">
            <span className="flex h-6 w-6 items-center justify-center rounded-md bg-amber-500 text-xs font-bold text-black">
              Y
            </span>
            Yasar Industries
          </Link>
          <nav className="hidden items-center gap-1 sm:flex">
            {NAV.map((item) => {
              const isActive = current === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                    isActive
                      ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                      : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <ThemeToggle />
          </nav>
          <div className="sm:hidden">
            <ThemeToggle />
          </div>
        </div>
        {/* mobile nav */}
        <nav className="flex gap-1 overflow-x-auto border-t border-zinc-100 px-4 py-2 dark:border-zinc-900 sm:hidden">
          {NAV.map((item) => {
            const isActive = current === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`shrink-0 rounded-full px-3 py-1 text-xs font-medium ${
                  isActive
                    ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                    : "text-zinc-500"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-zinc-500 sm:flex-row">
          <span>© {new Date().getFullYear()} Yasar C H · The Digital Factory</span>
          <div className="flex gap-4">
            <Link href="/" className="hover:text-zinc-900 dark:hover:text-zinc-100">
              Enter the factory →
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

export function PageHeader({
  kicker,
  title,
  subtitle,
}: {
  kicker: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="border-b border-zinc-200 bg-gradient-to-b from-zinc-50 to-white py-14 dark:border-zinc-800 dark:from-zinc-900/40 dark:to-zinc-950">
      <div className="mx-auto max-w-5xl px-6">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.3em] text-amber-600 dark:text-amber-400">
          {kicker}
        </p>
        <h1 className="mt-2 font-heading text-4xl font-bold tracking-tight sm:text-5xl">
          {title}
        </h1>
        {subtitle && <p className="mt-3 max-w-2xl text-zinc-500">{subtitle}</p>}
      </div>
    </div>
  );
}
