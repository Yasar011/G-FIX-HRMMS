export function PlaceholderModule({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center dark:border-zinc-700">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        {title}
      </h2>
      <p className="mt-2 text-sm text-zinc-500">{description}</p>
      <p className="mt-4 text-xs uppercase tracking-wide text-zinc-400">
        Module coming soon
      </p>
    </div>
  );
}
