# USAW Athlete Page - Component & Styling Reference

## 1. LiftAttempts Component

**Location**: Lines 201-248  
**Purpose**: Displays snatch or clean & jerk lift attempts with visual indicators for success/failure

```typescript
// Import required at top of file
import { ... } from 'lucide-react';

// Component definition
const LiftAttempts = ({ lift1, lift2, lift3, best, type }: {
  lift1: string | null;
  lift2: string | null;
  lift3: string | null;
  best: string | null;
  type: string;
}) => {
  const attempts = [lift1, lift2, lift3];
  
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-app-tertiary">{type}</div>
      <div className="flex space-x-2">
        {attempts.map((attempt, index) => {
          const value = parseInt(attempt || '0');
          const isGood = value > 0;
          const isBest = attempt === best;
          const attemptWeight = Math.abs(value);
          
          return (
            <span
              key={index}
              className={`px-2 py-1 rounded text-xs font-mono ${
                isBest 
                  ? 'bg-green-600 text-app-primary' 
                  : isGood 
                    ? 'bg-app-surface text-app-primary'
                    : value < 0
                      ? 'bg-red-900 text-red-300'
                      : 'bg-app-tertiary text-app-muted'
              }`}
            >
              {value === 0 
                ? '-' 
                : isGood 
                  ? `${value}kg` 
                  : `${attemptWeight}kg X`
              }
            </span>
          );
        })}
      </div>
      <div className="text-lg font-bold text-app-primary">
        Best: {best && parseInt(best) > 0 ? `${best}kg` : '-'}
      </div>
    </div>
  );
};
```

**Styling Classes Used**:
- `space-y-1` - vertical spacing between elements
- `text-sm font-medium text-app-tertiary` - label styling
- `flex space-x-2` - horizontal layout with gap
- `px-2 py-1 rounded text-xs font-mono` - attempt button styling
- Color classes: `bg-green-600`, `bg-app-surface`, `bg-red-900`, `bg-app-tertiary`
- Text colors: `text-app-primary`, `text-app-muted`, `text-red-300`

---

## 2. Pagination Component

**Location**: Lines 251-336  
**Purpose**: Navigate through paginated results with smart page number display

```typescript
const Pagination = ({ currentPage, totalPages, totalResults, onPageChange }: {
  currentPage: number;
  totalPages: number;
  totalResults: number;
  onPageChange: (page: number) => void;
}) => {
  if (totalPages <= 1) return null;
  
  const resultsPerPage = 20;
  const startResult = (currentPage - 1) * resultsPerPage + 1;
  const endResult = Math.min(currentPage * resultsPerPage, totalResults);

  const getPageNumbers = () => {
    const delta = 2;
    const pages = [];
    const start = Math.max(1, currentPage - delta);
    const end = Math.min(totalPages, currentPage + delta);

    if (start > 1) {
      pages.push(1);
      if (start > 2) pages.push('...');
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (end < totalPages) {
      if (end < totalPages - 1) pages.push('...');
      pages.push(totalPages);
    }

    return pages;
  };

  return (
    <div className="flex items-center justify-between mt-6">
      <div className="text-sm text-app-muted">
        Showing {startResult} to {endResult} of {totalResults} results
      </div>
      
      <div className="flex items-center space-x-2">
        {currentPage > 1 && (
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            Previous
          </button>
        )}

        <div className="flex space-x-1">
          {getPageNumbers().map((page, index) => (
            <button
              key={index}
              onClick={() => typeof page === 'number' && onPageChange(page)}
              disabled={page === '...'}
              className={`px-3 py-2 text-sm font-medium rounded-lg ${
                page === currentPage
                  ? 'bg-accent-primary text-app-primary border border-accent-primary'
                  : page === '...'
                    ? 'text-app-muted cursor-default'
                    : 'text-app-secondary bg-app-tertiary border border-app-secondary hover:bg-app-surface'
              }`}
            >
              {page}
            </button>
          ))}
        </div>

        {currentPage < totalPages && (
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="flex items-center px-3 py-2 text-sm font-medium text-app-secondary bg-app-tertiary border border-app-secondary rounded-lg hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </button>
        )}
      </div>
    </div>
  );
};
```

**Styling Classes Used**:
- `flex items-center justify-between mt-6` - main container layout
- `text-sm text-app-muted` - result count text
- `flex items-center space-x-2` - button group spacing
- `flex items-center px-3 py-2 text-sm font-medium` - button base styling
- `border border-app-secondary rounded-lg` - button border styling
- `hover:bg-app-surface disabled:opacity-50 disabled:cursor-not-allowed` - interaction states
- `bg-accent-primary text-app-primary border border-accent-primary` - active page styling

**Import Requirements**:
```typescript
import { ChevronLeft, ChevronRight } from 'lucide-react';
```

---

## 3. SortIcon Component

**Location**: Lines 339-352  
**Purpose**: Display sorting direction indicator in table headers

```typescript
const SortIcon = ({ column, sortConfig }: { 
  column: string; 
  sortConfig: { key: string | null; direction: 'asc' | 'desc' } 
}) => {
  if (sortConfig.key !== column) {
    return <span className="text-app-disabled ml-1">↕</span>;
  }
  
  return (
    <span className="text-accent-primary ml-1">
      {sortConfig.direction === 'asc' ? '↑' : '↓'}
    </span>
  );
};
```

**Styling Classes Used**:
- `text-app-disabled ml-1` - unsorted column indicator
- `text-accent-primary ml-1` - sorted column indicator (active color)

**Usage Example**:
```tsx
// In table header
<button onClick={() => handleSort('date')}>
  Date
  <SortIcon column="date" sortConfig={sortConfig} />
</button>
```

---

## 4. exportChartToPDF Function

**Location**: Lines 34-72  
**Purpose**: Export Recharts chart to PDF using html2canvas

```typescript
const exportChartToPDF = async (chartRef: React.RefObject<HTMLDivElement>, filename: string) => {
  if (!chartRef.current) return;
  
  try {
    const element = chartRef.current;
    const rect = element.getBoundingClientRect();
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#1f2937', // Use a fixed color for exports
      scale: 1,
      useCORS: true,
      allowTaint: true,
      width: rect.width,
      height: rect.height,
      scrollX: 0,
      scrollY: 0,
      windowWidth: window.innerWidth,
      windowHeight: window.innerHeight,
      x: 0,
      y: 0,
    });
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a3' 
    });
    
    pdf.addImage(imgData, 'PNG', 20, 20, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error: any) {
    console.error('Full error details:', error);
    alert(`Failed to export PDF: ${error.message}`);
  }
};
```

**Import Requirements**:
```typescript
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
```

**Usage Example**:
```tsx
const performanceChartRef = useRef<HTMLDivElement>(null);

// In JSX
<button onClick={() => exportChartToPDF(performanceChartRef, 'performance-chart.pdf')}>
  Export Chart
</button>

// Reference the chart container
<div ref={performanceChartRef}>
  <ResponsiveContainer width="100%" height={400}>
    <LineChart data={chartData}>
      {/* Chart content */}
    </LineChart>
  </ResponsiveContainer>
</div>
```

---

## 5. exportTableToPDF Function

**Location**: Lines 75-139  
**Purpose**: Export HTML table to PDF with scaling

```typescript
const exportTableToPDF = async (tableRef: React.RefObject<HTMLDivElement>, filename: string, athleteName: string) => {
  if (!tableRef.current) return;
  
  try {
    const element = tableRef.current;
    const table = element.querySelector('table');
    if (!table) {
      alert('No table found to export');
      return;
    }
    
    const originalStyles = {
      width: table.style.width,
      fontSize: table.style.fontSize,
      transform: table.style.transform,
      transformOrigin: table.style.transformOrigin
    };
    
    const tableWidth = table.scrollWidth;
    const viewportWidth = window.innerWidth - 100;
    const scale = Math.min(1, viewportWidth / tableWidth);
    
    table.style.transform = `scale(${scale})`;
    table.style.transformOrigin = 'top left';
    table.style.width = `${tableWidth}px`;
    table.style.fontSize = '10px';
    
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const canvas = await html2canvas(element, {
      backgroundColor: '#1f2937', // Use fixed color for exports
      scale: 1,
      useCORS: true,
      allowTaint: true,
      scrollX: 0,
      scrollY: 0,
      windowWidth: tableWidth * scale + 100,
      windowHeight: window.innerHeight,
      width: tableWidth * scale + 40,
      height: element.scrollHeight,
    });
    
    // Restore original styles
    Object.assign(table.style, originalStyles);
    
    const imgData = canvas.toDataURL('image/png', 1.0);
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [imgWidth + 40, imgHeight + 80]
    });
    
    pdf.setFontSize(16);
    pdf.setTextColor(0, 0, 0);
    pdf.text(`${athleteName} - Competition Results`, 20, 40);
    pdf.addImage(imgData, 'PNG', 20, 60, imgWidth, imgHeight);
    pdf.save(filename);
  } catch (error) {
    console.error('Error exporting table:', error);
    alert('Failed to export table. Please try again.');
  }
};
```

---

## 6. exportTableToCSV Function

**Location**: Lines 141-199  
**Purpose**: Export results table to CSV with optional column display

```typescript
const exportTableToCSV = (results: any[], athleteName: string, showAllColumns: boolean) => {
  try {
    const csvData = results.map(result => {
      if (showAllColumns) {
        return {
          'Date': new Date(result.date).toLocaleDateString('en-US'),
          'Meet': result.meet_name || '',
          'Level': result.meets?.Level || '',
          'WSO': result.wso || '',
          'Club': result.club_name || '',
          'Age Category': result.age_category || '',
          'Weight Class': result.weight_class || '',
          'Body Weight (kg)': result.body_weight_kg || '',
          'Competition Age': result.competition_age || '',
          'Snatch Lift 1': result.snatch_lift_1 || '',
          'Snatch Lift 2': result.snatch_lift_2 || '',
          'Snatch Lift 3': result.snatch_lift_3 || '',
          'Best Snatch (kg)': result.best_snatch || '',
          'C&J Lift 1': result.cj_lift_1 || '',
          'C&J Lift 2': result.cj_lift_2 || '',
          'C&J Lift 3': result.cj_lift_3 || '',
          'Best C&J (kg)': result.best_cj || '',
          'Total (kg)': result.total || '',
          'Q-Youth': result.q_youth || '',
          'Q-Points': result.qpoints || '',
          'Q-Masters': result.q_masters || ''
        };
      } else {
        const bestQScore = getBestQScore(result);
        return {
          'Date': new Date(result.date).toLocaleDateString('en-US'),
          'Meet': result.meet_name || '',
          'Weight Class': result.weight_class || '',
          'Best Snatch (kg)': result.best_snatch || '',
          'Best C&J (kg)': result.best_cj || '',
          'Total (kg)': result.total || '',
          'Best Q-Score': bestQScore.value || ''
        };
      }
    });

    const csv = Papa.unparse(csvData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `${athleteName.replace(/\s+/g, '_')}_competition_results.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  } catch (error) {
    console.error('Error exporting CSV:', error);
    alert('Failed to export CSV. Please try again.');
  }
};
```

**Import Requirements**:
```typescript
import Papa from 'papaparse';
```

---

## 7. Avatar/User Icon Styling in Athlete Header Card

**Location**: Lines 825-866  
**Purpose**: Display athlete avatar with icon in header card

```tsx
// Full header section with avatar
<div className="card-primary mb-8">
  <div className="flex flex-col md:flex-row md:items-start md:justify-between">
    <div className="flex items-start space-x-6">
      {/* Avatar Circle with User Icon */}
      <div className="bg-app-tertiary rounded-full p-4">
        <User className="h-12 w-12 text-app-secondary" />
      </div>
      
      {/* Athlete Information */}
      <div>
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold text-app-primary mb-2">
            {athlete.athlete_name}
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-app-secondary">
            {athlete.membership_number && (
              <div className="flex items-center space-x-1">
                <span>USAW Membership #{athlete.membership_number}</span>
              </div>
            )}
            {athlete.gender && (
              <div className="flex items-center space-x-1">
                <span>{athlete.gender === 'M' ? 'Male' : 'Female'}</span>
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-app-secondary mt-2">
            {recentInfo.wso && (
              <div className="flex items-center space-x-1">
                <MapPin className="h-4 w-4" />
                <span>WSO: {recentInfo.wso}</span>
              </div>
            )}
            {recentInfo.club && (
              <div className="flex items-center space-x-1">
                <Dumbbell className="h-4 w-4" />
                <span>Barbell Club: {recentInfo.club}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
```

**Avatar-specific Classes**:
- `bg-app-tertiary rounded-full p-4` - Avatar container styling
- `h-12 w-12 text-app-secondary` - Icon sizing and color
- `flex items-start space-x-6` - Avatar + content spacing

**Icon Imports**:
```typescript
import { User, MapPin, Dumbbell } from 'lucide-react';
```

---

## 8. Header Structure with bg-header-blur

**Location**: Lines 784-823  
**Purpose**: Top navigation header with logo, back button, and theme switcher

```tsx
<header className="bg-header-blur border-b border-app-secondary">
  <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="flex justify-between items-center py-4">
      {/* Left Section: Logo and Navigation */}
      <div className="flex items-center space-x-6">
        <Link href="/" className="flex items-center space-x-2 hover:opacity-80 transition-opacity">
          <Image
            src="/logo.png"
            alt="WeightliftingDB Logo"
            width={40}
            height={40}
            className="h-10 w-10 object-contain"
          />
          <div>
            <div className="text-lg font-bold text-app-primary">WeightliftingDB</div>
            <div className="text-xs text-app-tertiary">USA Weightlifting Results Database</div>
          </div>
        </Link>
        <button
          onClick={() => router.push('/')}
          className="flex items-center space-x-2 text-app-secondary hover:text-accent-primary transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Search</span>
        </button>
      </div>
      
      {/* Right Section: Theme Switcher and External Link */}
      <div className="flex items-center space-x-4">
        <ThemeSwitcher />
        {athlete?.internal_id && (
          <button
            onClick={() => window.open(`https://usaweightlifting.sport80.com/public/rankings/member/${athlete.internal_id}`, '_blank')}
            className="flex items-center space-x-2 text-app-tertiary hover:text-accent-primary transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            <span>External Profile</span>
          </button>
        )}
      </div>
    </div>
  </div>
</header>
```

**Styling Breakdown**:
- `bg-header-blur border-b border-app-secondary` - Header styling with backdrop blur
- `max-w-6xl mx-auto px-4 sm:px-6 lg:px-8` - Responsive container with max width
- `flex justify-between items-center py-4` - Main header layout
- `flex items-center space-x-6` - Logo and nav grouping
- `flex items-center space-x-2 hover:opacity-80 transition-opacity` - Logo link styling
- `text-lg font-bold text-app-primary` - Logo text styling
- `text-xs text-app-tertiary` - Subtitle styling

---

## 9. Container Styling (max-w-6xl vs app-container)

**max-w-6xl Pattern** (Lines 701, 785, 825):
```tsx
<div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
  {/* Content */}
</div>
```

**Breakdown**:
- `max-w-6xl` - Maximum width constraint (1152px in Tailwind)
- `mx-auto` - Center horizontally
- `px-4 sm:px-6 lg:px-8` - Responsive horizontal padding:
  - Mobile: 1rem (px-4)
  - Small screens: 1.5rem (sm:px-6)
  - Large screens: 2rem (lg:px-8)

**Alternative Pattern** (seen elsewhere):
```tsx
<div className="app-container">
  {/* Content */}
</div>
```

**Recommendation for IWF Page**: Use `max-w-6xl` pattern as it's the primary pattern in the athlete page and matches the design system.

---

## 10. Chart Toggle Styling with "Show All Details" / "Compact View"

**Location**: Lines 1782-1796  
**Purpose**: Toggle table column visibility with button group

```tsx
<div className="flex space-x-2">
  <button
    onClick={() => setShowAllColumns(!showAllColumns)}
    className="btn-tertiary"
  >
    {showAllColumns ? 'Compact View' : 'Show All Details'}
  </button>
  <button
    onClick={() => exportTableToCSV(results, athlete.athlete_name, showAllColumns)}
    className="btn-tertiary"
  >
    Export CSV
  </button>
</div>
```

**State Management**:
```typescript
const [showAllColumns, setShowAllColumns] = useState(false);
```

**Button Class Reference**:
- `btn-tertiary` - Custom button styling class (defined in project CSS)
- Likely includes: padding, border, background color, hover states
- Group with `flex space-x-2` for consistent spacing

**Similar Lift Toggle Pattern** (Lines 880-904):
```tsx
<div className="flex gap-1 border border-app-secondary rounded-lg p-1 w-fit">
  <button 
    onClick={() => setShowSnatch(!showSnatch)}
    className={`
      px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
      ${showSnatch 
        ? 'bg-accent-primary text-app-primary' 
        : 'bg-app-surface text-app-secondary hover:bg-app-hover'
      }
    `}
  >
    Snatch
  </button>
  <button 
    onClick={() => setShowCleanJerk(!showCleanJerk)}
    className={`
      px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out
      ${showCleanJerk 
        ? 'bg-accent-primary text-app-primary' 
        : 'bg-app-surface text-app-secondary hover:bg-app-hover'
      }
    `}
  >
    C&J
  </button>
</div>
```

**Styling Classes for Button Groups**:
- `flex gap-1 border border-app-secondary rounded-lg p-1 w-fit` - Container
- `px-2 py-1 rounded text-xs font-medium` - Individual button base
- `bg-accent-primary text-app-primary` - Active state
- `bg-app-surface text-app-secondary hover:bg-app-hover` - Inactive state
- `transition-all duration-300 ease-in-out` - Smooth transitions

---

## Required Imports Summary

```typescript
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { 
  Trophy, Calendar, Weight, TrendingUp, Medal, User, Building, 
  MapPin, ExternalLink, ArrowLeft, BarChart3, Dumbbell, 
  ChevronLeft, ChevronRight, Database 
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, BarChart, Bar, AreaChart, Area, 
  ScatterChart, Scatter, Brush, ReferenceLine 
} from 'recharts';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import { ThemeSwitcher } from '../../components/ThemeSwitcher';
import { AthleteCard } from '../../components/AthleteCard';
```

---

## Component Props & State References

### Common State Variables
```typescript
const [currentPage, setCurrentPage] = useState(1);
const [showAllColumns, setShowAllColumns] = useState(false);
const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
const performanceChartRef = useRef<HTMLDivElement>(null);
const resultsTableRef = useRef<HTMLDivElement>(null);
```

### ref Patterns
```typescript
// Chart reference for export
const performanceChartRef = useRef<HTMLDivElement>(null);

// Table reference for export
const resultsTableRef = useRef<HTMLDivElement>(null);

// In JSX:
<div ref={performanceChartRef}>
  {/* Chart content */}
</div>

<div ref={resultsTableRef}>
  {/* Table content */}
</div>
```

---

## CSS Color Variables Used

These are referenced throughout the components:
- `var(--chart-qpoints)` - Q-points chart color
- `var(--chart-qyouth)` - Q-youth chart color
- `var(--chart-qmasters)` - Q-masters chart color

Custom classes referenced:
- `.bg-header-blur` - Header background with blur effect
- `.card-primary` - Primary card styling
- `.btn-tertiary` - Tertiary button styling
- `.bg-app-gradient` - Full-page gradient background
- `.text-app-*` - Various text color utilities
- `.bg-app-*` - Various background color utilities

---

## Key Styling Patterns

### Responsive Spacing
```
px-4 sm:px-6 lg:px-8  // Padding: mobile 1rem, tablet 1.5rem, desktop 2rem
```

### Flex Layouts
```
flex items-center justify-between  // Space items apart
flex items-start space-x-6         // Align top, gap spacing
flex flex-col md:flex-row          // Stack on mobile, row on desktop
```

### Color Theming
```
text-app-primary       // Main text color
text-app-secondary     // Secondary text
text-app-tertiary      // Tertiary text
bg-app-surface         // Button/surface background
bg-accent-primary      // Active/accent background
```

### Interactive States
```
hover:bg-app-surface           // Hover background
hover:text-accent-primary      // Hover text color
disabled:opacity-50            // Disabled opacity
disabled:cursor-not-allowed    // Disabled cursor
transition-colors              // Smooth color transitions
```
