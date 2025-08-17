'use client';

import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from './ThemeProvider';

export function ThemeSwitcher() {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="
        relative flex items-center justify-center w-12 h-6 
        bg-app-tertiary rounded-full border border-app-primary
        transition-all duration-300 ease-in-out
        hover:bg-app-surface
        focus:outline-none focus:ring-2 focus:ring-accent-primary focus:ring-offset-2 focus:ring-offset-app-primary
      "
      type="button"
      role="switch"
      aria-checked={theme === 'light'}
      title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      {/* Sliding circle */}
      <span 
        className={`
          absolute w-5 h-5 bg-app-primary rounded-full shadow-lg
          transition-transform duration-300 ease-in-out
          flex items-center justify-center
          ${theme === 'light' ? 'translate-x-3' : '-translate-x-3'}
        `}
      >
        {/* Icons */}
        <Sun 
          className={`
            h-3 w-3 text-app-secondary absolute
            transition-opacity duration-300
            ${theme === 'light' ? 'opacity-100' : 'opacity-0'}
          `} 
        />
        <Moon 
          className={`
            h-3 w-3 text-app-secondary absolute
            transition-opacity duration-300
            ${theme === 'dark' ? 'opacity-100' : 'opacity-0'}
          `} 
        />
      </span>
    </button>
  );
}