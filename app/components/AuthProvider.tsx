'use client'

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react'
import { createClient } from '@/lib/supabase/client'
import { User, Session } from '@supabase/supabase-js'
import { queryWithTimeout, queryWithRetry } from '@/lib/supabase-utils'
import { checkSupabaseHealth } from '@/lib/supabase-health'

// Extended user interface that includes profile data
export interface ExtendedUser extends User {
  role?: string
  name?: string
}

export interface AuthContextType {
  user: ExtendedUser | null
  session: Session | null
  isLoading: boolean
  isLoadingProfile: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name?: string) => Promise<void>
  logout: () => Promise<void>
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

// Move client outside component to ensure singleton usage
const authClient = createClient()

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingProfile, setIsLoadingProfile] = useState(false)

  // Use the singleton client
  const supabase = authClient

  // Refs to prevent double initialization in React Strict Mode
  const hasInitialized = useRef(false)
  const initPromise = useRef<Promise<void> | null>(null)

  // Profile caching helpers
  const PROFILE_CACHE_KEY = 'user_profile_cache'

  const getCachedProfile = (userId: string): { name?: string; role?: string } | null => {
    if (typeof window === 'undefined') return null
    try {
      const cached = sessionStorage.getItem(PROFILE_CACHE_KEY)
      if (cached) {
        const data = JSON.parse(cached)
        if (data.userId === userId && data.timestamp > Date.now() - 5 * 60 * 1000) {
          console.log('[AUTH] Using cached profile')
          return data.profile
        }
      }
    } catch (error) {
      console.error('[AUTH] Error reading cached profile:', error)
    }
    return null
  }

  const setCachedProfile = (userId: string, profile: { name?: string; role?: string }) => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        userId,
        profile,
        timestamp: Date.now()
      }))
      console.log('[AUTH] Profile cached successfully')
    } catch (error) {
      console.error('[AUTH] Error caching profile:', error)
    }
  }

  const clearCachedProfile = () => {
    if (typeof window === 'undefined') return
    try {
      sessionStorage.removeItem(PROFILE_CACHE_KEY)
      console.log('[AUTH] Profile cache cleared')
    } catch (error) {
      console.error('[AUTH] Error clearing profile cache:', error)
    }
  }

  // Fetch user profile data including role
  const fetchUserProfile = async (authUser: User, retryCount = 0): Promise<ExtendedUser | null> => {
    try {
      console.log(`[AUTH] Fetching profile for user ID: ${authUser.id} (attempt ${retryCount + 1})`)

      // SKIP getSession check here to prevent deadlocks. 
      // We rely on the passed authUser and handle DB errors if the session is invalid.

      // Add timeout to the DB query
      const dbPromise = supabase
        .from('profiles')
        .select('name, role')
        .eq('id', authUser.id)
        .single()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Profile fetch timeout')), 5000)
      )

      const { data: profile, error } = await Promise.race([
        dbPromise,
        timeoutPromise
      ]) as any

      if (error) {
        console.error('[AUTH] Error fetching user profile:', error.message)

        // Handle specific error codes
        if (error.code === 'PGRST116') {
          console.log('[AUTH] Profile not found, creating new profile...')
          const { data: newProfile, error: insertError } = await supabase
            .from('profiles')
            .insert({
              id: authUser.id,
              email: authUser.email,
              name: authUser.user_metadata?.name || '',
              role: 'default'
            })
            .select()
            .single()

          if (insertError) {
            console.error('[AUTH] Error creating profile:', insertError)
            return { ...authUser, role: 'default' }
          }

          return {
            ...authUser,
            role: newProfile?.role || 'default',
            name: newProfile?.name || authUser.user_metadata?.name
          }
        }

        // If it's a potential auth error (like 401/403 equivalent in Supabase/PostgREST), try to refresh session
        if (retryCount < 2 && (error.message.includes('JWT') || error.message.includes('token'))) {
          console.log('[AUTH] Potential stale token detected, refreshing session...')
          const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession()
          if (!refreshError && refreshData.session) {
            console.log('[AUTH] Session refreshed, retrying profile fetch...')
            return fetchUserProfile(refreshData.session.user, retryCount + 1)
          }
        }

        return null
      }

      console.log('[AUTH] Profile fetched successfully:', profile)

      return {
        ...authUser,
        role: profile?.role || 'default',
        name: profile?.name || authUser.user_metadata?.name
      }
    } catch (error) {
      console.error('[AUTH] Failed to fetch user profile:', error)
      return null
    }
  }

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Prevent double initialization
    if (hasInitialized.current) {
      console.log('[AUTH] Already initialized, skipping')
      return
    }

    hasInitialized.current = true
    console.log('[AUTH] First initialization')

    // Get initial session
    const initializeAuth = async () => {
      // 10s timeout for initial session check
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Auth initialization timeout')), 10000)
      )

      try {
        console.log('[AUTH] Getting session...')
        // Race between getSession and timeout
        const { data: { session }, error } = await Promise.race([
          supabase.auth.getSession(),
          timeout
        ]) as any

        if (error) {
          console.error('[AUTH] Session error:', error)
          setSession(null)
          setUser(null)
        } else {
          console.log('[AUTH] Session retrieved:', session ? 'active' : 'none')
          setSession(session)

          if (session?.user) {
            // Set user IMMEDIATELY with basic data
            const basicUser: ExtendedUser = {
              ...session.user,
              role: 'default',
              name: session.user.email?.split('@')[0] || 'User'
            }
            setUser(basicUser)

            // Fetch profile ASYNC without blocking
            // We don't await this, so the UI can render immediately
            fetchUserProfile(session.user)
              .then(extendedUser => {
                if (extendedUser) {
                  console.log('[AUTH] Profile loaded:', extendedUser.role)
                  setUser(extendedUser)
                }
              })
              .catch(err => {
                console.error('[AUTH] Profile fetch failed:', err.message)
              })
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('[AUTH] Init failed:', error)
        setSession(null)
        setUser(null)
      } finally {
        console.log('[AUTH] Init complete, isLoading = false')
        setIsLoading(false)
      }
    }

    if (!initPromise.current) {
      initPromise.current = initializeAuth()
    }

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log(`[AUTH] Auth state change: ${event}`)

      // If the session is the same as what we have, don't do anything drastic
      // This helps prevent loops if onAuthStateChange fires redundantly
      if (event === 'INITIAL_SESSION' && session?.access_token === session?.access_token) {
        // We already handled initial session in initializeAuth, but we update state just in case
      }

      setSession(session)

      if (session?.user) {
        // Immediately set user with session data and cached profile as fallback
        const cachedProfile = getCachedProfile(session.user.id)
        const immediateUser: ExtendedUser = {
          ...session.user,
          name: cachedProfile?.name || session.user.email?.split('@')[0] || 'User',
          role: cachedProfile?.role || 'default'
        }

        // Only update user if it's different to avoid re-renders
        setUser(prev => {
          if (prev?.id === immediateUser.id && prev?.role === immediateUser.role) return prev;
          return immediateUser;
        })

        setIsLoading(false)

        // Only show loading profile if we don't have a cached role
        if (!cachedProfile?.role) {
          setIsLoadingProfile(true)
        }

        // Then fetch fresh profile with retry logic in the background
        try {
          // Use a simpler retry logic that respects auth errors
          const extendedUser = await fetchUserProfile(session.user)

          if (extendedUser) {
            // Cache the successful profile fetch
            if (extendedUser.name || extendedUser.role) {
              setCachedProfile(session.user.id, {
                name: extendedUser.name,
                role: extendedUser.role
              })
            }

            // Update user with fresh profile data
            setUser(extendedUser)
            console.log('[AUTH] Profile loaded successfully:', extendedUser.role)
          } else {
            console.warn('[AUTH] Profile fetch failed, keeping existing profile if available')
            // Do NOT overwrite user with null or default if we already have a profile
          }

          setIsLoadingProfile(false)
        } catch (error) {
          console.error('[AUTH] Profile fetch failed:', error)
          setIsLoadingProfile(false)
        }
      } else {
        setUser(null)
        clearCachedProfile()
        setIsLoading(false)
        setIsLoadingProfile(false)
      }
    })

    return () => subscription.unsubscribe()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Proactive token refresh - refresh every 7 hours (1 hour before 8-hour expiration)
  useEffect(() => {
    // Only set up refresh interval if user is logged in
    if (!session) return

    const SEVEN_HOURS = 7 * 60 * 60 * 1000 // 7 hours in milliseconds

    const refreshInterval = setInterval(async () => {
      try {
        console.log('[AUTH] Proactively refreshing session token...')
        const { data, error } = await supabase.auth.refreshSession()

        if (error) {
          console.error('[AUTH] Proactive refresh failed:', error.message)
        } else {
          console.log('[AUTH] Session refreshed successfully')
        }
      } catch (err) {
        console.error('[AUTH] Proactive refresh error:', err)
      }
    }, SEVEN_HOURS)

    return () => clearInterval(refreshInterval)
  }, [session, supabase])

  // Login function
  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        throw new Error(error.message)
      }

      // Session will be set via the onAuthStateChange listener
    } catch (error) {
      console.error('Login error:', error)
      setIsLoading(false)
      throw error
    }
  }

  // Register function
  const register = async (email: string, password: string, name?: string) => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: name ? { name } : undefined,
        },
      })

      if (error) {
        throw new Error(error.message)
      }

      // If user needs email confirmation, provide feedback
      if (data.user && !data.session) {
        console.log('Registration successful. Please check your email to confirm your account.')
        // Still set loading to false since registration completed
        setIsLoading(false)
        throw new Error('Registration successful. Please check your email to confirm your account.')
      }

      // Session will be set via the onAuthStateChange listener only if confirmed
    } catch (error) {
      console.error('Registration error:', error)
      setIsLoading(false)
      throw error
    }
  }

  // Logout function
  const logout = async () => {
    try {
      // Clear cached profile immediately
      clearCachedProfile()

      // Wrap with timeout to detect hanging promises
      const result = await queryWithTimeout(
        supabase.auth.signOut(),
        15000,
        'supabase.auth.signOut()'
      )

      const { error } = result
      if (error) {
        throw new Error(error.message)
      }
      // Session will be cleared via the onAuthStateChange listener
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[AUTH] Logout failed:', errorMsg)

      // Check health when logout fails
      try {
        const health = await checkSupabaseHealth()
        if (!health.healthy) {
          console.error('[AUTH] Supabase health check failed:', health)
        }
      } catch (healthErr) {
        console.error('[AUTH] Health check error:', healthErr instanceof Error ? healthErr.message : healthErr)
      }

      throw error
    }
  }

  // Refresh user data
  const refreshUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('Error refreshing session:', error)
      } else {
        setSession(session)
        if (session?.user) {
          const extendedUser = await fetchUserProfile(session.user)
          if (extendedUser) {
            setUser(extendedUser)
          }
        } else {
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Failed to refresh user:', error)
    }
  }

  const value: AuthContextType = {
    user,
    session,
    isLoading,
    isLoadingProfile,
    login,
    register,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}