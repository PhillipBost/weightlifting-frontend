"use client";

import React from "react";
import { AuthGuard } from "../components/AuthGuard";
import { ROLES } from "../../lib/roles";
import { ResultsArchiveContent } from "./components/ResultsArchiveContent";

export default function ResultsArchivePage() {
    return (
        <AuthGuard requireAnyRole={[ROLES.ADMIN, ROLES.VIP]}>
            <div className="min-h-screen bg-app-primary">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="max-w-[1200px] mx-auto">
                        <ResultsArchiveContent />
                    </div>
                </div>
            </div>
        </AuthGuard>
    );
}
