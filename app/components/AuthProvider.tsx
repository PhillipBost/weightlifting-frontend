'use client'

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { User, Session } from '@supabase/supabase-js'
import { queryWithTimeout } from '@/lib/supabase-utils'
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

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<ExtendedUser | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Fetch user profile data including role
  const fetchUserProfile = async (authUser: User): Promise<ExtendedUser> => {
    try {
      console.log('Fetching profile for user ID:', authUser.id)
      
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('name, role')
        .eq('id', authUser.id)
        .single()

      if (error) {
        console.error('Error fetching user profile:', error)
        console.log('User ID being queried:', authUser.id)
        console.log('Auth user email:', authUser.email)
        
        // Try to create the profile if it doesn't exist
        if (error.code === 'PGRST116') {
          console.log('Profile not found, creating new profile...')
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
            console.error('Error creating profile:', insertError)
            return { ...authUser, role: 'default' }
          }
          
          return {
            ...authUser,
            role: newProfile?.role || 'default',
            name: newProfile?.name || authUser.user_metadata?.name
          }
        }
        
        return { ...authUser, role: 'default' }
      }

      console.log('Profile fetched successfully:', profile)
      
      return {
        ...authUser,
        role: profile?.role || 'default',
        name: profile?.name || authUser.user_metadata?.name
      }
    } catch (error) {
      console.error('Failed to fetch user profile:', error)
      return { ...authUser, role: 'default' }
    }
  }

  // Initialize auth state and listen for changes
  useEffect(() => {
    // Get initial session
    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession()
        if (error) {
          console.error('Error getting session:', error)
        } else {
          setSession(session)
          if (session?.user) {
            const extendedUser = await fetchUserProfile(session.user)
            setUser(extendedUser)
          } else {
            setUser(null)
          }
        }
      } catch (error) {
        console.error('Failed to initialize auth:', error)
      } finally {
        setIsLoading(false)
      }
    }

    initializeAuth()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session)

      if (session?.user) {
        try {
          // Wrap fetchUserProfile with timeout
          const extendedUser = await queryWithTimeout(
            fetchUserProfile(session.user),
            8000,
            'fetchUserProfile'
          )

          setUser(extendedUser)
        } catch (error) {
          console.error('[AUTH] Profile fetch timeout:', error instanceof Error ? error.message : error)
          // Still set basic user even if profile fetch fails
          setUser(session.user as ExtendedUser)
        }
      } else {
        setUser(null)
      }

      setIsLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

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
          setUser(extendedUser)
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