"use client";

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../components/AuthProvider';
import { AuthGuard } from '../components/AuthGuard';
import { ROLES } from '../../lib/roles';
import { ArrowLeft, Users, Shield, Search, RefreshCw, Medal } from 'lucide-react';
import { ThemeSwitcher } from '../components/ThemeSwitcher';
import { UserTable } from './components/UserTable';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

export default function AdminPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const fetchUsers = async () => {
    try {
      setError(null);
      const { authenticatedFetch } = await import('../../lib/api-client');
      const response = await authenticatedFetch('/api/admin/users');

      if (!response.ok) {
        if (response.status === 403) {
          throw new Error('Admin access required');
        }
        throw new Error('Failed to fetch users');
      }

      const data = await response.json();
      setUsers(data.users || []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch users');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRoleUpdate = async (userId: string, newRole: string) => {
    try {
      const { authenticatedFetch } = await import('../../lib/api-client');
      const response = await authenticatedFetch('/api/admin/update-role', {
        method: 'POST',
        body: JSON.stringify({ userId, newRole }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to update role');
      }

      const data = await response.json();

      // Update the users list with the new role
      setUsers(prevUsers =>
        prevUsers.map(u =>
          u.id === userId
            ? { ...u, role: newRole, updatedAt: data.user.updatedAt }
            : u
        )
      );

      return { success: true };
    } catch (err) {
      console.error('Failed to update role:', err);
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to update role'
      };
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchUsers();
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filteredUsers = users.filter(u =>
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.role.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const roleStats = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <AuthGuard requireRole={ROLES.ADMIN} fallback={
      <div className="min-h-screen bg-app-gradient flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-app-primary mb-2">Access Denied</h1>
          <p className="text-app-secondary">Admin access required to view this page.</p>
          <button
            onClick={() => router.push('/')}
            className="mt-4 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-app-primary rounded-lg transition-colors"
          >
            Return Home
          </button>
        </div>
      </div>
    }>
      <div className="min-h-screen bg-app-gradient">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Admin Header */}
          <div className="card-primary mb-8">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="bg-app-tertiary rounded-full p-4">
                  <Users className="h-12 w-12 text-app-secondary" />
                </div>
                <div>
                  <div className="flex items-center space-x-2 mb-2">
                    <h1 className="text-3xl font-bold text-app-primary">Admin Dashboard</h1>
                    <Shield className="h-6 w-6 text-red-500" />
                  </div>
                  <p className="text-app-secondary">Manage user accounts and roles</p>
                </div>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="flex items-center space-x-2 px-4 py-2 bg-accent-primary hover:bg-accent-primary-hover text-app-primary rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="max-w-[1200px] grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4 mb-8">
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-app-primary">{users.length}</div>
              <div className="text-sm text-app-secondary">Total Users</div>
            </div>
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-app-tertiary">{roleStats[ROLES.DEFAULT] || 0}</div>
              <div className="text-sm text-app-secondary">Default</div>
            </div>
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-purple-500">{roleStats[ROLES.RESEARCHER] || 0}</div>
              <div className="text-sm text-app-secondary">Researchers</div>
            </div>
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-blue-500">{roleStats[ROLES.COACH] || 0}</div>
              <div className="text-sm text-app-secondary">Coaches</div>
            </div>
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-emerald-500">{roleStats[ROLES.USAW_NATIONAL_TEAM_COACH] || 0}</div>
              <div className="text-sm text-app-secondary">USAW Coaches</div>
            </div>
            <div className="card-primary text-center">
              <div className="text-2xl font-bold text-red-500">{roleStats[ROLES.ADMIN] || 0}</div>
              <div className="text-sm text-app-secondary">Admins</div>
            </div>
          </div>

          {/* Search and Filters */}
          <div className="card-primary mb-8">
            <div className="flex items-center space-x-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-app-secondary" />
                <input
                  type="text"
                  placeholder="Search users by email, name, or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-app-tertiary border border-app-secondary rounded-lg text-app-primary placeholder-app-secondary focus:outline-none focus:ring-2 focus:ring-accent-primary"
                />
              </div>
            </div>
          </div>

          {/* User Management Table */}
          <div className="card-primary">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-app-primary">User Management</h2>
              <span className="text-sm text-app-secondary">
                Showing {filteredUsers.length} of {users.length} users
              </span>
            </div>

            {error && (
              <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <p className="text-red-500">{error}</p>
              </div>
            )}

            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-accent-primary mx-auto mb-4"></div>
                <p className="text-app-secondary">Loading users...</p>
              </div>
            ) : (
              <UserTable
                users={filteredUsers}
                onRoleUpdate={handleRoleUpdate}
                currentUserId={user?.id}
              />
            )}
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
