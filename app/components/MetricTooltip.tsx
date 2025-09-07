'use client';

import React, { useState } from 'react';
import { Info } from 'lucide-react';

interface MetricTooltipProps {
  title: string;
  description: string;
  methodology?: string;
  children: React.ReactNode;
}

export function MetricTooltip({ title, description, methodology, children }: MetricTooltipProps) {
  const [isVisible, setIsVisible] = useState(false);

  return (
    <div className="relative inline-block">
      <div 
        className="flex items-center cursor-help"
        onMouseEnter={() => setIsVisible(true)}
        onMouseLeave={() => setIsVisible(false)}
      >
        {children}
        <Info className="h-3 w-3 ml-1 text-app-muted opacity-60 hover:opacity-100 transition-opacity" />
      </div>
      
      {isVisible && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-80 max-w-sm">
          <div 
            className="bg-app-secondary border border-app-primary rounded-lg p-3 shadow-lg"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              boxShadow: '0 10px 25px rgba(0, 0, 0, 0.4)'
            }}
          >
            {/* Arrow pointing down */}
            <div 
              className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0"
              style={{
                borderLeft: '6px solid transparent',
                borderRight: '6px solid transparent',
                borderTop: '6px solid var(--border-primary)',
              }}
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