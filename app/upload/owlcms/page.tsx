"use client";

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { OwlcmsUploader } from '@/app/components/owlcms/OwlcmsUploader';

export default function OwlcmsUploadPage() {
  return (
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
          <a
            href="https://owlcms.jflamy.dev/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-xs font-medium text-app-tertiary hover:text-app-primary transition"
          >
            <span>owlcms Documentation</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        <div className="w-full">
          <OwlcmsUploader />
        </div>
      </div>
    </div>
  );
}
