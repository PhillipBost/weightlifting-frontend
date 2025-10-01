'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  description: string;
  methodology?: string;
  children: React.ReactNode;
}

export function MetricTooltip({ title, description, methodology, children }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const [verticalPlacement, setVerticalPlacement] = useState<'top' | 'bottom'>('top');
  const [horizontalAlign, setHorizontalAlign] = useState<'left' | 'center' | 'right'>('center');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const [mounted, setMounted] = useState(false);

  useLayoutEffect(() => {
    setMounted(true);
  }, []);

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      const tooltipWidth = 320; // w-80 = 320px
      const tooltipHeight = tooltipRect.height;
      const gap = 8; // spacing between trigger and tooltip

      // Determine vertical placement
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const isInTableHeader = triggerRef.current.closest('thead') !== null;

      let vertPlacement: 'top' | 'bottom';
      let topPos: number;

      if (isInTableHeader) {
        vertPlacement = 'bottom';
        topPos = triggerRect.bottom + gap;
      } else if (spaceAbove >= tooltipHeight + gap) {
        vertPlacement = 'top';
        topPos = triggerRect.top - tooltipHeight - gap;
      } else if (spaceBelow >= tooltipHeight + gap) {
        vertPlacement = 'bottom';
        topPos = triggerRect.bottom + gap;
      } else {
        vertPlacement = spaceAbove > spaceBelow ? 'top' : 'bottom';
        topPos = vertPlacement === 'top'
          ? triggerRect.top - tooltipHeight - gap
          : triggerRect.bottom + gap;
      }

      // Determine horizontal alignment and position
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      let horizAlign: 'left' | 'center' | 'right';
      let leftPos: number;

      if (triggerCenter >= tooltipWidth / 2 && viewportWidth - triggerCenter >= tooltipWidth / 2) {
        // Center align
        horizAlign = 'center';
        leftPos = triggerCenter - tooltipWidth / 2;
      } else if (triggerCenter < tooltipWidth / 2) {
        // Left align
        horizAlign = 'left';
        leftPos = triggerRect.left;
      } else {
        // Right align
        horizAlign = 'right';
        leftPos = triggerRect.right - tooltipWidth;
      }

      // Ensure tooltip stays within viewport bounds
      leftPos = Math.max(8, Math.min(leftPos, viewportWidth - tooltipWidth - 8));
      topPos = Math.max(8, Math.min(topPos, viewportHeight - tooltipHeight - 8));

      setVerticalPlacement(vertPlacement);
      setHorizontalAlign(horizAlign);
      setPosition({ top: topPos, left: leftPos });
    }
  }, [isVisible]);

  const getArrowStyle = () => {
    if (!triggerRef.current) return {};

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const triggerCenter = triggerRect.left + triggerRect.width / 2;

    // Calculate arrow position relative to tooltip
    let arrowLeft: number;
    if (horizontalAlign === 'center') {
      arrowLeft = 160; // Center of 320px tooltip
    } else if (horizontalAlign === 'left') {
      arrowLeft = Math.min(triggerCenter - position.left, 300); // Max 300px to stay within tooltip
    } else {
      arrowLeft = 320 - (position.left + 320 - triggerCenter);
    }

    const baseStyle = {
      position: 'absolute' as const,
      width: 0,
      height: 0,
      left: `${arrowLeft}px`,
      transform: 'translateX(-50%)',
      borderLeft: '6px solid transparent',
      borderRight: '6px solid transparent',
    };

    if (verticalPlacement === 'top') {
      return {
        ...baseStyle,
        top: '100%',
        borderTop: '6px solid var(--border-primary)',
      };
    } else {
      return {
        ...baseStyle,
        bottom: '100%',
        borderBottom: '6px solid var(--border-primary)',
      };
    }
  };

  const tooltipContent = isVisible && mounted ? (
    <div
      ref={tooltipRef}
      className="fixed z-[9999] w-80 max-w-sm"
      style={{
        top: `${position.top}px`,
        left: `${position.left}px`,
      }}
    >
      <div
        className="bg-app-secondary border border-app-primary rounded-lg p-3 shadow-lg"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
        }}
      >
        {/* Arrow */}
        <div style={getArrowStyle()} />

        <div className="text-sm">
          <div className="font-semibold text-app-primary mb-2">{title}</div>
          <div className="text-app-secondary mb-2">{description}</div>
          {methodology && (
            <div className="text-xs text-app-muted pt-2 border-t border-app-tertiary">
              <strong>How it's calculated:</strong> {methodology}
            </div>
          )}
        </div>
      </div>
    </div>
  ) : null;

  return (
    <>
      <div className="relative inline-block" ref={triggerRef}>
        <div
          className="flex items-center cursor-help"
          onMouseEnter={() => setIsVisible(true)}
          onMouseLeave={() => setIsVisible(false)}
        >
          {children}
          <Info className="h-3 w-3 ml-1 text-app-muted opacity-60 hover:opacity-100 transition-opacity" />
        </div>
      </div>

      {mounted && createPortal(tooltipContent, document.body)}
    </>
  );
}