export function NotConfigured() {
  return (
    <div className="mx-auto max-w-2xl px-6 py-20">
      <h1 className="font-display text-3xl font-semibold">River Dynasty Capital</h1>
      <p className="mt-4 text-sm text-muted">
        The site isn&rsquo;t connected to a database yet.
      </p>
      <ol className="mt-6 list-decimal space-y-2 pl-5 text-sm leading-relaxed">
        <li>
          Create a free Supabase project at{" "}
          <span className="tnum">supabase.com</span>.
        </li>
        <li>
          In the Supabase SQL Editor, run{" "}
          <code className="tnum rounded bg-ink/5 px-1">supabase/schema.sql</code>{" "}
          then{" "}
          <code className="tnum rounded bg-ink/5 px-1">supabase/seed.sql</code>.
        </li>
        <li>
          Copy <code className="tnum rounded bg-ink/5 px-1">.env.example</code> to{" "}
          <code className="tnum rounded bg-ink/5 px-1">.env.local</code> and fill in
          the Supabase URL and keys.
        </li>
        <li>
          Restart the dev server. Full instructions are in{" "}
          <code className="tnum rounded bg-ink/5 px-1">README.md</code>.
        </li>
      </ol>
    </div>
  );
}
