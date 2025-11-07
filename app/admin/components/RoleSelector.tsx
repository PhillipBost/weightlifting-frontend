"use client";

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ROLES } from '../../../lib/roles';
import { ChevronDown, User, Crown, Shield, Briefcase, AlertTriangle, Medal } from 'lucide-react';

interface RoleSelectorProps {
  currentRole: string;
  onRoleChange: (newRole: string) => void;
  disabled?: boolean;
  isCurrentUser?: boolean;
}

export function RoleSelector({ currentRole, onRoleChange, disabled = false, isCurrentUser = false }: RoleSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [showConfirm, setShowConfirm] = useState<string | null>(null);

  const buttonRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const roleOptions = [
    {
      value: ROLES.DEFAULT,
      label: 'Default',
      description: 'Basic user access',
      icon: <User className="h-4 w-4" />,
      color: 'text-app-secondary'
    },
    {
      value: ROLES.PREMIUM,
      label: 'Premium',
      description: 'Advanced analytics access',
      icon: <Crown className="h-4 w-4" />,
      color: 'text-yellow-500'
    },
    {
      value: ROLES.COACH,
      label: 'Coach',
      description: 'Team management features',
      icon: <Briefcase className="h-4 w-4" />,
      color: 'text-blue-500'
    },
    {
      value: ROLES.USAW_NATIONAL_TEAM_COACH,
      label: 'USAW National Team Coach',
      description: 'National team coaching authority',
      icon: <Medal className="h-4 w-4" />,
      color: 'text-emerald-500'
    },
    {
      value: ROLES.ADMIN,
      label: 'Admin',
      description: 'Full system access',
      icon: <Shield className="h-4 w-4" />,
      color: 'text-red-500'
    },
  ];

  const getCurrentRoleOption = () => {
    return roleOptions.find(option => option.value === currentRole) || roleOptions[0];
  };

  const handleRoleSelect = (newRole: string) => {
    setIsOpen(false);
    
    // Show confirmation for admin role changes and current user changes
    if (newRole === ROLES.ADMIN || (isCurrentUser && currentRole === ROLES.ADMIN)) {
      setShowConfirm(newRole);
    } else {
      onRoleChange(newRole);
    }
  };

  const handleConfirmChange = () => {
    if (showConfirm) {
      onRoleChange(showConfirm);
      setShowConfirm(null);
    }
  };

  useEffect(() => {
    const handleScrollOrResize = () => {
      if (isOpen && buttonRef.current && dropdownRef.current) {
        const rect = buttonRef.current.getBoundingClientRect();
        const scrollX = window.pageXOffset;
        const scrollY = window.pageYOffset;
        dropdownRef.current.style.left = `${rect.left + scrollX}px`;
        dropdownRef.current.style.top = `${rect.bottom + scrollY}px`;
        dropdownRef.current.style.width = '16rem';
      }
    };

    if (isOpen && buttonRef.current && dropdownRef.current) {
      handleScrollOrResize();
    }

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize, true);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize, true);
    };
  }, [isOpen]);

  const currentOption = getCurrentRoleOption();

  // Don't allow current user to change their own admin role
  const isDisabled = disabled || (isCurrentUser && currentRole === ROLES.ADMIN);

  return (
    <div className="relative">
      {/* Role Selector Button */}
      <button
        ref={buttonRef}
        onClick={(e) => {
          e.stopPropagation();
          if (!isDisabled) setIsOpen(prev => !prev);
        }}
        disabled={isDisabled}
        className={`
          flex items-center space-x-2 px-3 py-2 rounded-lg border transition-colors min-w-[120px]
          ${isDisabled 
            ? 'bg-app-tertiary/50 border-app-secondary/50 cursor-not-allowed opacity-50' 
            : 'bg-app-tertiary border-app-secondary hover:border-accent-primary hover:bg-app-tertiary/80 cursor-pointer'
          }
        `}
      >
        <span className={currentOption.color}>
          {currentOption.icon}
        </span>
        <span className="text-sm font-medium text-app-primary flex-1 text-left">
          {currentOption.label}
        </span>
        {!isDisabled && (
          <ChevronDown className={`h-4 w-4 text-app-secondary transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && !isDisabled && createPortal(
        <div 
          ref={dropdownRef}
          className="w-64 bg-app-secondary border border-app-secondary rounded-lg shadow-lg max-h-64 overflow-y-auto"
          style={{ position: 'fixed', zIndex: 50 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="py-1">
            {roleOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleRoleSelect(option.value)}
                className={`
                  w-full px-4 py-3 text-left hover:bg-app-tertiary transition-colors
                  ${option.value === currentRole ? 'bg-accent-primary/10' : ''}
                `}
              >
                <div className="flex items-center space-x-3">
                  <span className={option.color}>
                    {option.icon}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-app-primary">{option.label}</span>
                      {option.value === currentRole && (
                        <span className="text-xs text-accent-primary">Current</span>
                      )}
                    </div>
                    <span className="text-xs text-app-secondary">{option.description}</span>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>,
        document.body
      )}


      {/* Confirmation Dialog */}
      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-app-secondary border border-app-secondary rounded-lg p-6 max-w-md mx-4">
            <div className="flex items-center space-x-3 mb-4">
              <AlertTriangle className="h-6 w-6 text-yellow-500" />
              <h3 className="text-lg font-bold text-app-primary">Confirm Role Change</h3>
            </div>
            
            <p className="text-app-secondary mb-6">
              {showConfirm === ROLES.ADMIN 
                ? "You are about to grant admin privileges. This will give the user full system access including the ability to manage other users."
                : "You are about to change your own admin role. You will lose admin access and won't be able to access this page."
              }
            </p>
            
            <div className="flex items-center space-x-3">
              <button
                onClick={handleConfirmChange}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors"
              >
                Confirm Change
              </button>
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-2 bg-app-tertiary hover:bg-app-tertiary/80 text-app-primary font-medium rounded-lg transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
