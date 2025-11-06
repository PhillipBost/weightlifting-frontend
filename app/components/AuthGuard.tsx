"use client";

import React, { ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { ROLES } from '../../lib/roles';

interface AuthGuardProps {
  children: ReactNode;
  requireRole?: string;
  requireAnyRole?: string[];
  fallback?: ReactNode;
}

export function AuthGuard({ children, requireRole, requireAnyRole, fallback }: AuthGuardProps) {
  const { user, isLoading } = useAuth();

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // User not authenticated
  if (!user) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Authentication Required
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Please log in to access this page.
          </p>
        </div>
      </div>
    );
  }

  // Check multi-role requirement
  if (requireAnyRole && requireAnyRole.length > 0) {
    const hasRequiredRole = user.role && requireAnyRole.includes(user.role);
    if (!hasRequiredRole) {
      return fallback || null;
    }
  }

  // Check single-role requirement
  if (requireRole && user.role !== requireRole) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            Access Denied
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to access this page.
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
            Required role: {requireRole}, Your role: {user.role || 'none'}
          </p>
        </div>
      </div>
    );
  }

  // User is authenticated and has required role
  return <>{children}</>;
}