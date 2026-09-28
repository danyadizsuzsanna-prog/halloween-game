import { useEffect, useState, useCallback } from 'react'
import { supabase } from './supabaseClient'

/**
 * Kezeli a bejelentkezett felhasználó session-jét és a hozzá tartozó
 * profil sort (csapat, kapitány-e). A profils.email alapján automatikusan
 * csapatba sorolás egy Postgres trigger / RPC hívás felelőssége
 * (lásd supabase/migrations/0001_schema.sql -> assign_team_on_signup).
 */
export function useSession() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }
    const { data, error } = await supabase
      .from('profiles')
      .select('*, teams(*)')
      .eq('id', userId)
      .single()
    if (error) {
      // eslint-disable-next-line no-console
      console.error('Profil betöltési hiba:', error.message)
      setProfile(null)
    } else {
      setProfile(data)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session?.user?.id) {
        await loadProfile(data.session.user.id)
      }
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession)
        if (newSession?.user?.id) {
          await loadProfile(newSession.user.id)
        } else {
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      listener.subscription.unsubscribe()
    }
  }, [loadProfile])

  return { session, profile, loading, refreshProfile: () => loadProfile(session?.user?.id) }
}
