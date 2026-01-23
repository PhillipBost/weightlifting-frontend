
"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";

interface SearchableDropdownProps<T> {
    label: string;
    options: T[];
    selected: string[];
    onSelect: (selected: string[]) => void;
    // Function to get the unique key/value for an item (e.g. country code)
    getValue: (item: T) => string;
    // Function to get the display label (e.g. country name)
    getLabel: (item: T) => string;
    // Optional custom renderer for the row (e.g. flag + name)
    renderOption?: (item: T) => React.ReactNode;
    placeholder?: string;
    // Classes to match existing styles exactly
    triggerClassName?: string;
    dropdownClassName?: string;
}

export function SearchableDropdown<T>({
    label,
    options,
    selected,
    onSelect,
    getValue,
    getLabel,
    renderOption,
    placeholder = "Select...",
    // Default values matching the current "Premium" styling in RankingsPage
    triggerClassName = "w-full flex items-center justify-between h-10 px-3 bg-app-tertiary border border-app-primary rounded-xl text-app-primary text-sm focus:outline-none focus:ring-2 focus:ring-blue-500",
    dropdownClassName = "absolute z-20 mt-1 w-full max-h-64 overflow-y-auto bg-app-surface border border-app-primary rounded-xl shadow-lg p-2"
}: SearchableDropdownProps<T>) {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    // Virtualization: only render this many items initially
    const [visibleCount, setVisibleCount] = useState(20);
    const containerRef = useRef<HTMLDivElement>(null);

    // Reset visible count when search changes or close
    useEffect(() => {
        if (!isOpen) {
            setSearchTerm("");
            setVisibleCount(20);
        }
    }, [isOpen]);

    // Filter options based on search
    const filteredOptions = useMemo(() => {
        if (!searchTerm) return options;
        const lowerSearch = searchTerm.toLowerCase();
        return options.filter(item =>
            getLabel(item).toLowerCase().includes(lowerSearch)
        );
    }, [options, searchTerm, getLabel]);

    // Derived visible items
    const visibleOptions = filteredOptions.slice(0, visibleCount);

    // Handle scroll to load more
    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
        // Load more when properly close to bottom (50px buffer)
        if (scrollTop + clientHeight >= scrollHeight - 50) {
            if (visibleCount < filteredOptions.length) {
                // Increase by batch size
                setVisibleCount(prev => Math.min(prev + 20, filteredOptions.length));
            }
        }
    };

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleSelectAll = () => {
        // Select all CURRENTLY FILTERED items
        const allValues = filteredOptions.map(getValue);
        // Merge with existing selection to avoid losing non-visible items? 
        // Usually "Select All" implies "Select All Matches". 
        // But for a simple dropdown, usually it means "Select All Options".
        // Let's stick to simple "Select All" behavior for now matching the visible intent.
        // If search is active, we should probably only select visible, but existing behavior 
        // in RankingsPage selects generic lists. 
        // Let's assume standard behavior: Select visible filtered.

        // Actually, to match existing "Select All" behavior safely:
        const newSelected = Array.from(new Set([...selected, ...allValues]));
        onSelect(newSelected);
    };

    const handleClear = () => {
        onSelect([]);
    };

    const toggleOption = (value: string) => {
        const newSelected = selected.includes(value)
            ? selected.filter(v => v !== value)
            : [...selected, value];
        onSelect(newSelected);
    };

    return (
        <div className="relative" ref={containerRef}>
            <label className="block text-sm font-medium text-app-tertiary mb-1">
                {label}
            </label>

            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={triggerClassName}
            >
                <span className="truncate">
                    {selected.length === 0
                        ? placeholder
                        : `${selected.length} selected`}
                </span>
                <span className="ml-2 text-xs text-app-tertiary flex-shrink-0">
                    <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                </span>
            </button>

            {isOpen && (
                <>
                    <div className={dropdownClassName} onScroll={handleScroll}>
                        {/* Header: Search + Actions */}
                        <div className="bg-app-surface z-10 space-y-2 p-1 mb-1">
                            {/* Search Bar */}
                            <div className="relative">
                                <input
                                    type="text"
                                    placeholder="Search..."
                                    value={searchTerm}
                                    onChange={(e) => {
                                        setSearchTerm(e.target.value);
                                        setVisibleCount(20); // Reset scroll on search
                                    }}
                                    className="w-full h-9 pl-8 pr-2 bg-app-tertiary border border-app-primary rounded text-sm text-app-primary placeholder:text-app-muted focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    autoFocus
                                />
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-app-tertiary" />
                            </div>

                            {/* Actions Row */}
                            <div className="flex justify-between items-center px-1">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary transition-colors"
                                >
                                    Select All
                                </button>
                                <div className="text-xs font-medium text-app-tertiary">
                                    {filteredOptions.length} items
                                </div>
                                <button
                                    type="button"
                                    onClick={handleClear}
                                    className="px-2 py-1 bg-app-tertiary rounded hover:bg-app-hover text-xs text-app-secondary transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>

                        {/* Scrollable List */}
                        <div className="grid grid-cols-1 gap-1">
                            {visibleOptions.length > 0 ? (
                                visibleOptions.map((item) => {
                                    const value = getValue(item);
                                    const isChecked = selected.includes(value);

                                    return (
                                        <label
                                            key={value}
                                            className="flex items-center space-x-2 text-xs text-app-secondary cursor-pointer hover:bg-app-hover p-1.5 rounded transition-colors"
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => toggleOption(value)}
                                                className="h-3 w-3 accent-blue-500 flex-shrink-0 cursor-pointer"
                                            />
                                            <div className="flex-1 truncate select-none">
                                                {renderOption ? renderOption(item) : getLabel(item)}
                                            </div>
                                        </label>
                                    );
                                })
                            ) : (
                                <div className="text-app-muted text-xs p-4 text-center">
                                    No results found
                                </div>
                            )}

                            {/* Virtualization Sentinel/Loading Indicator */}
                            {visibleCount < filteredOptions.length && (
                                <div className="text-center py-2 text-xs text-app-muted animate-pulse">
                                    Loading more...
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
