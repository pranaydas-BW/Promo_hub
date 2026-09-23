import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from './supabase'
import { useAuth } from './AuthContext'

const SettingsContext = createContext({})

export function SettingsProvider({ children }) {
  const { user, isAdmin } = useAuth()
  const [hideCampaigns, setHideCampaignsState] = useState(false)
  const [loading, setLoading] = useState(true)

  const load = async () => {
    const { data } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'hide_campaigns')
      .maybeSingle()
    setHideCampaignsState(data?.value === true)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Only meaningful for admins — RLS blocks the write for anyone else anyway.
  const setHideCampaigns = async (value) => {
    if (!isAdmin) return
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'hide_campaigns', value, updated_at: new Date().toISOString(), updated_by: user?.email || null }, { onConflict: 'key' })
    if (!error) setHideCampaignsState(value)
    return error
  }

  return (
    <SettingsContext.Provider value={{ hideCampaigns, setHideCampaigns, loading }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
