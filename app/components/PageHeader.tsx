"use client";

import React from "react";

export type MetaChipTone = "default" | "muted" | "accent";

export interface MetaChip {
  label: string;
  value: string | number;
  tone?: MetaChipTone;
}

export interface PageHeaderProps {
  icon?: React.ReactNode;
  title: string;
  subtitle?: string;
  meta?: MetaChip[];
  actions?: React.ReactNode; // Right-side actions (buttons, menus, etc.)
}

/**
 * Shared page header to align /meet, /club, /WSO, /rankings.
 * Usage:
 *  - Place at top of page content.
 *  - Pass in meta chips and actions specific to the page.
 */
export const PageHeader: React.FC<PageHeaderProps> = ({
  icon,
  title,
  subtitle,
  meta = [],
  actions,
}) => {
  return (
    <div className="bg-gray-800 rounded-2xl p-6 md:p-8 mb-8 border border-gray-700">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Left: Icon, title, subtitle, meta chips */}
        <div className="flex items-start space-x-4">
          {icon && (
            <div className="bg-gray-700 rounded-2xl p-3 flex items-center justify-center">
              {icon}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-bold text-white">{title}</h1>
            {subtitle && (
              <p className="text-sm text-gray-300 mt-1">{subtitle}</p>
            )}
            {meta.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 text-[10px]">
                {meta.map((chip, idx) => {
                  const tone = chip.tone || "default";
                  const base =
                    "inline-flex items-center px-2.5 py-1 rounded-full";
                  const cls =
                    tone === "accent"
                      ? `${base} bg-blue-600/20 text-blue-300 border border-blue-500/40`
                      : tone === "muted"
                      ? `${base} bg-gray-700 text-gray-400`
                      : `${base} bg-gray-700 text-gray-300`;
                  return (
                    <span key={idx} className={cls}>
                      {chip.label && (
                        <span className="mr-1 uppercase tracking-wide text-[9px] text-gray-400">
                          {chip.label}:
                        </span>
                      )}
                      <span>{chip.value}</span>
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: actions */}
        {actions && (
          <div className="flex items-start md:items-center space-x-3">
            {actions}
          </div>
        )}
      </div>
    </div>
  );
};

export default PageHeader;
