"use client";

import { useEffect, useState } from "react";
import { onValue, ref } from "firebase/database";
import { db } from "@/lib/firebase";

function useCollectionCount(path: string): number | "error" {
  const [count, setCount] = useState<number | "error">(0);

  useEffect(() => {
    const unsubscribe = onValue(
      ref(db, path),
      (snapshot) => {
        setCount(snapshot.exists() ? Object.keys(snapshot.val()).length : 0);
      },
      () => setCount("error")
    );
    return unsubscribe;
  }, [path]);

  return count;
}

const STATS: { label: string; path: string }[] = [
  { label: "Projects", path: "content/projects" },
  { label: "Internships", path: "content/internships" },
  { label: "Certificates", path: "content/certificates" },
  { label: "Messages", path: "messages" },
];

export default function AdminDashboardPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
          Dashboard Home
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Live counts from the database. These will populate as content
          managers are built out.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {STATS.map((stat) => (
          <StatTile key={stat.path} label={stat.label} path={stat.path} />
        ))}
      </div>
    </div>
  );
}

function StatTile({ label, path }: { label: string; path: string }) {
  const count = useCollectionCount(path);
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950">
      <div
        className={`text-2xl font-semibold ${
          count === "error" ? "text-red-600" : "text-zinc-900 dark:text-zinc-50"
        }`}
      >
        {count === "error" ? "—" : count}
      </div>
      <div className="text-sm text-zinc-500">{label}</div>
    </div>
  );
}
