'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async () => {
    setError('')
    setLoading(true)
    const supabase = createClient()

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) { setError(signUpError.message); setLoading(false); return }
      if (name) {
        const { data: { user } } = await supabase.auth.getUser()
        if (user) await supabase.from('profiles').update({ name }).eq('id', user.id)
      }
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError) { setError('Email ou mot de passe incorrect.'); setLoading(false); return }
    }
    router.replace('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-4xl mb-2">💪</div>
          <h1 className="text-2xl font-semibold text-gray-900">Gym Tracker</h1>
          <p className="text-gray-500 text-sm mt-1">Push · Pull · Legs</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
          {mode === 'signup' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">Prénom</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Ton prénom"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          )}
          <div>
            <label className="block text-sm text-gray-600 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="email@exemple.com"
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Mot de passe</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm">{error}</p>}

          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password}
            className="w-full bg-teal-600 text-white rounded-xl py-2.5 text-sm font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors"
          >
            {loading ? 'Chargement...' : mode === 'login' ? 'Se connecter' : 'Créer le compte'}
          </button>

          <p className="text-center text-sm text-gray-500">
            {mode === 'login' ? 'Pas encore de compte ?' : 'Déjà un compte ?'}{' '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError('') }}
              className="text-teal-600 font-medium"
            >
              {mode === 'login' ? 'Créer un compte' : 'Se connecter'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
