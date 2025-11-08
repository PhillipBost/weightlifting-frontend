'use client'

import { useState, useRef, useEffect } from 'react'
import { useAuth } from './AuthProvider'
import { queryWithTimeout } from '@/lib/supabase-utils'
import { checkSupabaseHealth } from '@/lib/supabase-health'

interface UserMenuProps {
  onLoginClick?: () => void
  showOnlyWhenLoggedIn?: boolean
}

export function UserMenu({ onLoginClick, showOnlyWhenLoggedIn = false }: UserMenuProps) {
  const { user, logout, isLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutError, setLogoutError] = useState<string | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen])

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent click-outside handler from closing dropdown prematurely

    setIsLoggingOut(true)
    setLogoutError(null)

    try {
      // Wrap logout with timeout to detect hanging promises
      await queryWithTimeout(
        logout(),
        20000,
        'Sign out'
      )

      setIsOpen(false)
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error'
      console.error('[LOGOUT] Failed:', errorMsg)
      setLogoutError(errorMsg)

      // Check Supabase health when logout fails
      const health = await checkSupabaseHealth()
      if (!health.healthy) {
        console.error('[LOGOUT] Supabase health check failed:', health)
      }
    } finally {
      setIsLoggingOut(false)
    }
  }

  if (isLoading) {
    return showOnlyWhenLoggedIn ? null : (
      <div className="w-8 h-8 bg-gray-200 rounded-full animate-pulse"></div>
    )
  }

  if (!user) {
    // If showOnlyWhenLoggedIn is true, don't render anything for logged out users
    if (showOnlyWhenLoggedIn) {
      return null
    }

    return (
      <button
        onClick={onLoginClick}
        className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
      >
        Sign In
      </button>
    )
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        {/* User Avatar */}
        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white text-sm font-medium">
          {user.name ? user.name.charAt(0).toUpperCase() : (user.email || 'U').charAt(0).toUpperCase()}
        </div>
        
        {/* User Info */}
        <div className="text-left hidden sm:block">
          <div className="text-sm font-medium text-gray-900">
            {user.name || 'User'}
          </div>
          <div className="text-xs text-gray-500">{user.email}</div>
        </div>

        {/* Dropdown Arrow */}
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
          <div className="p-3 border-b border-gray-200">
            <div className="text-sm font-medium text-gray-900">{user.name || 'User'}</div>
            <div className="text-xs text-gray-500">{user.email || ''}</div>
            {user.role && (
              <div className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium mt-1 ${
                user.role === 'admin' ? 'bg-red-100 text-red-800' :
                user.role === 'user' ? 'bg-blue-100 text-blue-800' :
                'bg-gray-100 text-gray-800'
              }`}>
                {user.role}
              </div>
            )}
          </div>

          <div className="p-2">
            {logoutError && (
              <div className="mb-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                {logoutError}
              </div>
            )}
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoggingOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}