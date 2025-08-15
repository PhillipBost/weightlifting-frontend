'use client';

import React from 'react';
import { Moon, Sun, Contrast } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();

  const themes = [
    { 
      id: 'dark' as const, 
      label: 'Dark', 
      icon: Moon,
      description: 'Comfortable dark theme'
    },
    { 
      id: 'light' as const, 
      label: 'Light', 
      icon: Sun,
      description: 'Clean light theme'
    },
    { 
      id: 'high-contrast' as const, 
      label: 'High Contrast', 
      icon: Contrast,
      description: 'Maximum accessibility'
    }
  ];

  return (
    <div className="flex items-center space-x-1 bg-app-tertiary rounded-lg p-1">
      {themes.map(({ id, label, icon: Icon, description }) => (
        <button
          key={id}
          onClick={() => setTheme(id)}
          className={`
            flex items-center space-x-2 px-3 py-2 rounded-md text-xs font-medium transition-all
            ${theme === id 
              ? 'bg-accent-primary text-app-primary shadow-sm' 
              : 'text-app-secondary hover:text-app-primary hover:bg-app-surface'
            }
          `}
          title={description}
        >
          <Icon className="h-3 w-3" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  );
}