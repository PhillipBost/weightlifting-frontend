"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { UserMenu } from "./UserMenu";
import { UnifiedSearch } from "./UnifiedSearch";

interface GlobalHeaderProps {
  /**
   * Whether to show the Back button.
   * For /meet, /club, /WSO, /rankings this should mimic the /meet header behavior.
   */
  showBack?: boolean;
  /**
   * Optional explicit back href. If not provided, will call router.back().
   */
  backHref?: string;
}

/**
 * Global header that matches the /meet header.
 * Applied to all non-Home pages: /meet, /club, /WSO, /rankings, etc.
 * Home keeps its own header and should not use this.
 */
export const GlobalHeader: React.FC<GlobalHeaderProps> = ({
  showBack = true,
  backHref,
}) => {
  const router = useRouter();
  const pathname = usePathname();

  // Do NOT render on Home. Home has its own dedicated header.
  if (pathname === "/") {
    return null;
  }

  const handleBack = () => {
    if (backHref) {
      router.push(backHref);
    } else {
      router.back();
    }
  };

  return (
    <header className="bg-header-blur border-b border-app-secondary relative z-[1001]">
      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Left: Logo + Back */}
          <div className="flex items-center space-x-6">
            <Link
              href="/"
              className="flex items-center space-x-2 hover:opacity-80 transition-opacity"
            >
              <Image
                alt="WeightliftingDB Logo"
                src="/logo.png"
                width={40}
                height={40}
                className="h-10 w-10 object-contain"
              />
              <div className="hidden sm:block">
                <div className="text-lg font-bold text-app-primary">
                  WeightliftingDB
                </div>
                <div className="text-xs text-app-tertiary">
                  Olympic Weightlifting Results Database
                </div>
              </div>
            </Link>

            {showBack && (
              <button
                type="button"
                onClick={handleBack}
                className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Back</span>
              </button>
            )}
          </div>

          {/* Right: Search + Theme + User Menu */}
          <div className="flex items-center gap-2">
            <div className="w-40 sm:w-64">
              <UnifiedSearch variant="header" placeholder="Search..." />
            </div>
            {/* Theme Toggle - Always Visible */}
            <div className="flex items-center shrink-0 ml-1 sm:ml-2">
              <ThemeSwitcher />
            </div>

            {/* Mobile User Menu / Desktop User Menu */}
            <div className="sm:hidden ml-1">
              <UserMenu />
            </div>
            <div className="hidden sm:block">
            </div>
            {/* Simple UserMenu for mobile? Or existing one is responsive? 
                 UserMenu usually has an avatar. 
                 Let's keep elements but rely on flex shrinking if needed.
                 Actually, simpler to just show Search and Menu on mobile if space is tight.
             */}
            <div className="sm:hidden">
              <UserMenu showOnlyWhenLoggedIn />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

export default GlobalHeader;
