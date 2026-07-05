import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center bg-zinc-50 px-6 text-center dark:bg-black">
      <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-50">
        Portfolio site — coming soon
      </h1>
      <p className="mt-3 max-w-md text-zinc-600 dark:text-zinc-400">
        Every section of this site will be driven by the Factory Control
        Center admin panel.
      </p>
      <div className="mt-6 flex gap-3">
        <Link
          href="/projects"
          className="rounded-full border border-zinc-300 px-5 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-900"
        >
          View projects
        </Link>
        <Link
          href="/login"
          className="rounded-full bg-zinc-900 px-5 py-3 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Admin sign in
        </Link>
      </div>
    </div>
  );
}
