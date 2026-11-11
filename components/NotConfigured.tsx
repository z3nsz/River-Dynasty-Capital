export function NotConfigured() {
  return (
    <main className="site-shell mx-auto flex min-h-screen w-full max-w-sheet items-center px-4 py-12 sm:px-8">
      <section className="w-full max-w-2xl border-t-4 border-navy bg-white/60 px-6 py-8 shadow-[0_18px_60px_rgba(20,24,28,0.07)] sm:px-10 sm:py-10">
        <p className="eyebrow mb-4">Investment office · Est. 2020</p>
        <h1 className="font-display text-4xl font-semibold tracking-tight sm:text-5xl">
          River Dynasty Capital
        </h1>
        <p className="mt-5 max-w-lg text-sm leading-6 text-muted">
          The site isn&rsquo;t connected to a database yet. Follow these setup steps to publish the live track record.
        </p>
        <ol className="mt-8 flex flex-col gap-4 border-t border-hairline pt-6 text-sm leading-6">
          <li className="flex gap-4">
            <span className="tnum text-xs font-semibold text-navy">01</span>
            <span>Create a free Supabase project at <span className="tnum">supabase.com</span>.</span>
          </li>
          <li className="flex gap-4">
            <span className="tnum text-xs font-semibold text-navy">02</span>
            <span>Run <code className="tnum rounded bg-ink/5 px-1.5 py-0.5">supabase/schema.sql</code> then <code className="tnum rounded bg-ink/5 px-1.5 py-0.5">supabase/seed.sql</code>.</span>
          </li>
          <li className="flex gap-4">
            <span className="tnum text-xs font-semibold text-navy">03</span>
            <span>Copy <code className="tnum rounded bg-ink/5 px-1.5 py-0.5">.env.example</code> to <code className="tnum rounded bg-ink/5 px-1.5 py-0.5">.env.local</code> and add the Supabase URL and keys.</span>
          </li>
          <li className="flex gap-4">
            <span className="tnum text-xs font-semibold text-navy">04</span>
            <span>Restart the dev server. Full instructions are in <code className="tnum rounded bg-ink/5 px-1.5 py-0.5">README.md</code>.</span>
          </li>
        </ol>
      </section>
    </main>
  );
}
