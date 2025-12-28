export default function DocsPage() {
  return (
    <div className="min-h-screen bg-zinc-900 text-white">
      <div className="max-w-4xl mx-auto py-16 px-8">
        <h1 className="text-4xl font-bold mb-8">Documentation</h1>
        
        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400">Getting Started</h2>
          <div className="bg-zinc-800 rounded-xl p-6 space-y-4">
            <p className="text-zinc-300">1. Sign up for an account at /signup</p>
            <p className="text-zinc-300">2. Create your first bot from the dashboard</p>
            <p className="text-zinc-300">3. Configure actions (HTTP requests, notifications)</p>
            <p className="text-zinc-300">4. Set a schedule or trigger manually</p>
          </div>
        </section>

        <section className="mb-12">
          <h2 className="text-2xl font-semibold mb-4 text-blue-400">API Reference</h2>
          <div className="space-y-4">
            <div className="bg-zinc-800 rounded-xl p-6">
              <code className="text-green-400">GET /api/bots</code>
              <p className="text-zinc-400 mt-2">List all your bots</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-6">
              <code className="text-green-400">POST /api/bots</code>
              <p className="text-zinc-400 mt-2">Create a new bot</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-6">
              <code className="text-green-400">POST /api/bots/:id/run</code>
              <p className="text-zinc-400 mt-2">Trigger bot execution</p>
            </div>
            <div className="bg-zinc-800 rounded-xl p-6">
              <code className="text-yellow-400">POST /api/webhooks/:botId</code>
              <p className="text-zinc-400 mt-2">External webhook trigger</p>
            </div>
          </div>
        </section>

        <a href="/dashboard" className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-medium">Go to Dashboard</a>
      </div>
    </div>
  )
}
