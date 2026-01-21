"use client";

import React, { useState } from 'react';
import { ROLES } from '../../../lib/roles';
import { User, Crown, Shield, Briefcase, CheckCircle, XCircle, Medal, Database } from 'lucide-react';
import { RoleSelector } from './RoleSelector';

interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: string;
  createdAt: string;
  updatedAt: string;
  lastLogin?: string;
}

interface UserTableProps {
  users: AdminUser[];
  onRoleUpdate: (userId: string, newRole: string) => Promise<{ success: boolean; error?: string }>;
  currentUserId?: string;
}

export function UserTable({ users, onRoleUpdate, currentUserId }: UserTableProps) {
  const [updatingUsers, setUpdatingUsers] = useState<Set<string>>(new Set());
  const [notifications, setNotifications] = useState<Record<string, { type: 'success' | 'error'; message: string }>>({});

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUsers(prev => new Set(prev).add(userId));

    try {
      const result = await onRoleUpdate(userId, newRole);

      if (result.success) {
        setNotifications(prev => ({
          ...prev,
          [userId]: { type: 'success', message: `Role updated to ${newRole}` }
        }));
      } else {
        setNotifications(prev => ({
          ...prev,
          [userId]: { type: 'error', message: result.error || 'Failed to update role' }
        }));
      }

      // Clear notification after 3 seconds
      setTimeout(() => {
        setNotifications(prev => {
          const { [userId]: _, ...rest } = prev;
          return rest;
        });
      }, 3000);
    } finally {
      setUpdatingUsers(prev => {
        const newSet = new Set(prev);
        newSet.delete(userId);
        return newSet;
      });
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return <Shield className="h-4 w-4 text-red-500" />;
      case ROLES.COACH:
        return <Briefcase className="h-4 w-4 text-blue-500" />;
      case ROLES.USAW_NATIONAL_TEAM_COACH:
        return <Medal className="h-4 w-4 text-emerald-500" />;
      case ROLES.RESEARCHER:
        return <Database className="h-4 w-4 text-purple-500" />;
      case ROLES.PREMIUM:
        return <Crown className="h-4 w-4 text-yellow-500" />;
      default:
        return <User className="h-4 w-4 text-app-secondary" />;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case ROLES.ADMIN:
        return 'text-red-500 bg-red-500/10 border-red-500/20';
      case ROLES.COACH:
        return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
      case ROLES.USAW_NATIONAL_TEAM_COACH:
        return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
      case ROLES.RESEARCHER:
        return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
      case ROLES.PREMIUM:
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
      default:
        return 'text-app-secondary bg-app-tertiary border-app-secondary';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (users.length === 0) {
    return (
      <div className="text-center py-8">
        <User className="h-16 w-16 text-app-secondary mx-auto mb-4" />
        <p className="text-app-secondary">No users found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-app-secondary">
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">User</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">Role</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">Joined</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">Last Login</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">Last Updated</th>
            <th className="text-left py-3 px-4 text-sm font-medium text-app-secondary">Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const isCurrentUser = user.id === currentUserId;
            const isUpdating = updatingUsers.has(user.id);
            const notification = notifications[user.id];

            return (
              <tr key={user.id} className="border-b border-app-secondary/50 hover:bg-app-tertiary/30">
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <div className="bg-app-tertiary rounded-full p-2">
                      <User className="h-4 w-4 text-app-secondary" />
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-app-primary">
                          {user.name || 'No name'}
                        </span>
                        {isCurrentUser && (
                          <span className="px-2 py-1 text-xs bg-accent-primary/20 text-accent-primary rounded-full">
                            You
                          </span>
                        )}
                      </div>
                      <span className="text-sm text-app-secondary">{user.email}</span>
                    </div>
                  </div>
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-2">
                    {getRoleIcon(user.role)}
                    <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getRoleColor(user.role)}`}>
                      {user.role}
                    </span>
                  </div>
                </td>
                <td className="py-4 px-4 text-sm text-app-secondary">
                  {formatDate(user.createdAt)}
                </td>
                <td className="py-4 px-4 text-sm text-app-secondary">
                  {user.lastLogin ? formatDate(user.lastLogin) : 'Never'}
                </td>
                <td className="py-4 px-4 text-sm text-app-secondary">
                  {formatDate(user.updatedAt)}
                </td>
                <td className="py-4 px-4">
                  <div className="flex items-center space-x-3">
                    <RoleSelector
                      currentRole={user.role}
                      onRoleChange={(newRole) => handleRoleChange(user.id, newRole)}
                      disabled={isUpdating || (isCurrentUser && user.role === ROLES.ADMIN)}
                      isCurrentUser={isCurrentUser}
                    />

                    {isUpdating && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-accent-primary"></div>
                    )}

                    {notification && (
                      <div className="flex items-center space-x-1">
                        {notification.type === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-500" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-500" />
                        )}
                        <span className={`text-xs ${notification.type === 'success' ? 'text-green-500' : 'text-red-500'
                          }`}>
                          {notification.message}
                        </span>
                      </div>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}