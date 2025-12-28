export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-zinc-900 via-zinc-800 to-zinc-900">
      <main className="flex w-full max-w-4xl flex-col items-center justify-center py-16 px-8">
        <div className="flex flex-col items-center gap-8 text-center">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg className="h-7 w-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
              </svg>
            </div>
            <h1 className="text-4xl font-bold text-white">Bottleneck Bots</h1>
          </div>

          <p className="max-w-xl text-lg text-zinc-400">
            Automate your workflows with intelligent bots. Build, deploy, and manage automation tasks with ease.
          </p>

          <div className="mt-4 flex items-center gap-2 rounded-full bg-green-500/10 px-4 py-2 text-sm text-green-400">
            <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Supabase Connected
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl bg-zinc-800/50 p-6 text-left border border-zinc-700/50">
              <div className="mb-3 h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Fast Execution</h3>
              <p className="text-sm text-zinc-400">Lightning-fast bot execution with real-time monitoring.</p>
            </div>

            <div className="rounded-xl bg-zinc-800/50 p-6 text-left border border-zinc-700/50">
              <div className="mb-3 h-10 w-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <svg className="h-5 w-5 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Easy Config</h3>
              <p className="text-sm text-zinc-400">Simple configuration with powerful customization options.</p>
            </div>

            <div className="rounded-xl bg-zinc-800/50 p-6 text-left border border-zinc-700/50">
              <div className="mb-3 h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <svg className="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <h3 className="font-semibold text-white mb-1">Secure</h3>
              <p className="text-sm text-zinc-400">Enterprise-grade security with Supabase RLS.</p>
            </div>
          </div>

          <div className="mt-8 flex gap-4">
            <a
              href="/dashboard"
              className="rounded-full bg-gradient-to-r from-blue-500 to-purple-600 px-6 py-3 font-medium text-white transition-all hover:opacity-90"
            >
              Get Started
            </a>
            <a
              href="/docs"
              className="rounded-full border border-zinc-600 px-6 py-3 font-medium text-white transition-all hover:bg-zinc-800"
            >
              Documentation
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
