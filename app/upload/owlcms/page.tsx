"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield } from 'lucide-react';
import { AuthGuard } from '@/app/components/AuthGuard';
import { ROLES } from '@/lib/roles';
import { OwlcmsUploader } from '@/app/components/owlcms/OwlcmsUploader';

export default function OwlcmsUploadPage() {
  return (
    <AuthGuard
      requireRole={ROLES.ADMIN}
      fallback={
        <div className="min-h-screen bg-app-gradient flex items-center justify-center p-6">
          <div className="text-center max-w-md p-8 bg-app-secondary border border-app-primary rounded-2xl shadow-xl">
            <Shield className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-app-primary mb-2">Access Denied</h1>
            <p className="text-app-tertiary text-sm mb-6">
              Admin access is required to access the owlcms competition importer.
            </p>
            <Link
              href="/"
              className="px-5 py-2.5 bg-sky-600 hover:bg-sky-500 text-white font-medium rounded-xl transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      }
    >
      <div className="min-h-screen bg-app-gradient py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1200px] mx-auto space-y-6">
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-medium text-app-tertiary hover:text-app-primary transition group"
            >
              <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
              <span>Back to Home</span>
            </Link>
          </div>

          <div className="w-full">
            <OwlcmsUploader />
          </div>
        </div>
      </div>
    </AuthGuard>
  );
}
