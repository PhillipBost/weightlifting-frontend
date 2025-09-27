'use client';

import React, { useState, useRef, useLayoutEffect } from 'react';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  description: string;
  methodology?: string;
  children: React.ReactNode;
}

export function MetricTooltip({ title, description, methodology, children }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState<'top' | 'bottom'>('top');
  const [alignment, setAlignment] = useState<'left' | 'center' | 'right'>('center');
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (isVisible && triggerRef.current && tooltipRef.current) {
      const triggerRect = triggerRef.current.getBoundingClientRect();
      const tooltipRect = tooltipRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const viewportWidth = window.innerWidth;

      // Check if we're in a table header by looking for overflow containers
      const isInTableHeader = triggerRef.current.closest('thead') !== null;
      const overflowContainer = triggerRef.current.closest('[class*="overflow"]');

      // Determine vertical position
      const spaceAbove = triggerRect.top;
      const spaceBelow = viewportHeight - triggerRect.bottom;
      const tooltipHeight = tooltipRect.height;

      // For table headers, always use bottom positioning to avoid clipping
      if (isInTableHeader) {
        setPosition('bottom');
      } else {
        if (spaceAbove >= tooltipHeight + 10) {
          setPosition('top');
        } else if (spaceBelow >= tooltipHeight + 10) {
          setPosition('bottom');
        } else {
          // Use the side with more space
          setPosition(spaceAbove > spaceBelow ? 'top' : 'bottom');
        }
      }

      // Determine horizontal alignment
      const tooltipWidth = 320; // w-80 = 320px
      const triggerCenter = triggerRect.left + triggerRect.width / 2;
      const leftSpace = triggerCenter;
      const rightSpace = viewportWidth - triggerCenter;

      // For overflow containers, be more conservative with centering
      if (overflowContainer) {
        const containerRect = overflowContainer.getBoundingClientRect();
        const relativeLeft = triggerCenter - containerRect.left;
        const relativeRight = containerRect.right - triggerCenter;

        if (relativeLeft >= tooltipWidth / 2 && relativeRight >= tooltipWidth / 2) {
          setAlignment('center');
        } else if (relativeLeft < tooltipWidth / 2) {
          setAlignment('left');
        } else {
          setAlignment('right');
        }
      } else {
        if (leftSpace >= tooltipWidth / 2 && rightSpace >= tooltipWidth / 2) {
          setAlignment('center');
        } else if (leftSpace < tooltipWidth / 2) {
          setAlignment('left');
        } else {
          setAlignment('right');
        }
      }
    }
  }, [isVisible]);

  const getTooltipClasses = () => {
    const baseClasses = "absolute z-[100] w-80 max-w-sm";

    const verticalClass = position === 'top'
      ? "bottom-full mb-2"
      : "top-full mt-2";

    const horizontalClass = {
      left: "left-0",
      center: "left-1/2 transform -translate-x-1/2",
      right: "right-0"
    }[alignment];

    return `${baseClasses} ${verticalClass} ${horizontalClass}`;
  };

  const getArrowStyle = () => {
    const isTop = position === 'top';
    const arrowPosition = {
      left: alignment === 'left' ? '20px' : alignment === 'right' ? 'calc(100% - 26px)' : '50%',
      transform: alignment === 'center' ? 'translateX(-50%)' : undefined
    };

    if (isTop) {
      return {
        top: '100%',
        ...arrowPosition,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderTop: '6px solid var(--border-primary)',
      };
    } else {
      return {
        bottom: '100%',
        ...arrowPosition,
        borderLeft: '6px solid transparent',
        borderRight: '6px solid transparent',
        borderBottom: '6px solid var(--border-primary)',
      };
    }
  };

  return (
    <div className="relative inline-block" ref={triggerRef}>
      <div
        className="flex items-center cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        <Info className="h-3 w-3 ml-1 text-app-muted opacity-60 hover:opacity-100 transition-opacity" />
      </div>

      {isVisible && (
        <div className={getTooltipClasses()} ref={tooltipRef}>
          <div
            className="bg-app-secondary border border-app-primary rounded-lg p-3 shadow-lg"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Arrow */}
            <div
              className="absolute w-0 h-0"
              style={getArrowStyle()}
            />

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
      )}
    </div>
  );
}