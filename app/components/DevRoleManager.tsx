'use client'

import { useState, useEffect } from 'react'
import { useAuth } from './AuthProvider'

interface User {
  id: string
  email: string
  name?: string
  role: string
  createdAt: string
}

export function DevRoleManager() {
  const { user } = useAuth()
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isAdmin = user?.role === 'admin'

  useEffect(() => {
    if (isAdmin) {
      fetchUsers()
    }
  }, [isAdmin])

  const fetchUsers = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/admin/users', {
        credentials: 'include',
      })

      if (response.ok) {
        const data = await response.json()
        setUsers(data.users || [])
      } else {
        setError('Failed to fetch users')
      }
    } catch (err) {
      setError('Network error')
      console.error('Failed to fetch users:', err)
    } finally {
      setLoading(false)
    }
  }

  const updateUserRole = async (userId: string, newRole: string) => {
    try {
      const response = await fetch('/api/admin/update-role', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ userId, role: newRole }),
      })

      if (response.ok) {
        // Refresh users list
        fetchUsers()
      } else {
        setError('Failed to update role')
      }
    } catch (err) {
      setError('Network error')
      console.error('Failed to update role:', err)
    }
  }

  if (!isAdmin) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <p className="text-gray-600">Admin access required</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg">
        <p>Loading users...</p>
      </div>
    )
  }

  return (
    <div className="p-4 border border-gray-200 rounded-lg">
      <h3 className="text-lg font-semibold mb-4">User Role Management</h3>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-3 py-2 rounded mb-4">
          {error}
        </div>
      )}

      <div className="space-y-2">
        {users.length === 0 ? (
          <p className="text-gray-600">No users found</p>
        ) : (
          users.map((userData) => (
            <div key={userData.id} className="flex items-center justify-between p-3 bg-gray-50 rounded">
              <div className="flex-1">
                <div className="font-medium">{userData.email}</div>
                {userData.name && (
                  <div className="text-sm text-gray-600">{userData.name}</div>
                )}
                <div className="text-xs text-gray-500">
                  Created: {new Date(userData.createdAt).toLocaleDateString()}
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className={`px-2 py-1 text-xs rounded ${userData.role === 'admin' ? 'bg-red-100 text-red-800' :
                    userData.role === 'user' ? 'bg-blue-100 text-blue-800' :
                      'bg-gray-100 text-gray-800'
                  }`}>
                  {userData.role}
                </span>

                <select
                  value={userData.role}
                  onChange={(e) => updateUserRole(userData.id, e.target.value)}
                  className="text-xs border rounded px-2 py-1"
                  disabled={userData.id === user?.id} // Prevent self role change
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                  <option value="vip">VIP</option>
                  <option value="default">Default</option>
                </select>
              </div>
            </div>
          ))
        )}
      </div>

      <button
        onClick={fetchUsers}
        className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
      >
        Refresh Users
      </button>
    </div>
  )
}