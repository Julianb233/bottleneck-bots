'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'

export default function SettingsPage() {
  const [user, setUser] = useState<any>(null)
  const [name, setName] = useState('')
  const [apiKeys, setApiKeys] = useState<any[]>([])
  const [newKeyName, setNewKeyName] = useState('')
  const [newKey, setNewKey] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadUser()
    loadApiKeys()
  }, [])

  async function loadUser() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      setUser(user)
      setName(user.user_metadata?.name || '')
    }
  }

  async function loadApiKeys() {
    const res = await fetch('/api/user/api-keys')
    if (res.ok) setApiKeys(await res.json())
  }

  async function saveProfile() {
    setSaving(true)
    await fetch('/api/user', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    })
    setSaving(false)
  }

  async function createApiKey() {
    const res = await fetch('/api/user/api-keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newKeyName })
    })
    if (res.ok) {
      const data = await res.json()
      setNewKey(data.key)
      setNewKeyName('')
      loadApiKeys()
    }
  }

  async function signOut() {
    await supabase.auth.signOut()
    window.location.href = '/'
  }

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-white">Settings</h1>

      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Profile</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Email</label>
            <input type="email" value={user?.email || ''} disabled className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-zinc-400" />
          </div>
          <div>
            <label className="block text-sm text-zinc-400 mb-1">Name</label>
            <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white" />
          </div>
          <button onClick={saveProfile} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>

      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">API Keys</h2>
        {newKey && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
            <p className="text-green-400 text-sm mb-2">Copy your new API key (shown only once):</p>
            <code className="text-green-300 break-all">{newKey}</code>
          </div>
        )}
        <div className="flex gap-2 mb-4">
          <input type="text" placeholder="Key name" value={newKeyName} onChange={e => setNewKeyName(e.target.value)} className="flex-1 bg-zinc-900 border border-zinc-700 rounded-lg px-4 py-2 text-white" />
          <button onClick={createApiKey} className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg">Generate</button>
        </div>
        <div className="space-y-2">
          {apiKeys.map(key => (
            <div key={key.id} className="flex justify-between items-center p-3 bg-zinc-900 rounded-lg">
              <div>
                <p className="text-white">{key.name}</p>
                <p className="text-xs text-zinc-500">{key.prefix}...</p>
              </div>
              <p className="text-xs text-zinc-500">{new Date(key.created_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-xl bg-zinc-800/50 border border-zinc-700/50 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
        <button onClick={signOut} className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg">Sign Out</button>
      </div>
    </div>
  )
}
