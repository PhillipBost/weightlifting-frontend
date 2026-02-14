"use client";

import React from "react";
import { AuthGuard } from "../components/AuthGuard";
import { ROLES } from "../../lib/roles";
import { ResultsArchiveContent } from "./components/ResultsArchiveContent";

export default function ResultsArchivePage() {
    return (
        <AuthGuard requireAnyRole={[ROLES.ADMIN, ROLES.VIP]}>
            <div className="container mx-auto px-4 py-8">
                <h1 className="text-3xl font-bold mb-6">Results Archive</h1>
                <ResultsArchiveContent />
            </div>
        </AuthGuard>
    );
}
