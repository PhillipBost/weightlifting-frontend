'use client'

import React from 'react'
import {
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    Line,
    ComposedChart
} from 'recharts'
import { Users, User, GitCompare } from 'lucide-react'
import { useTheme } from '../ThemeProvider' // Adjust import path as needed

// Theme colors
const COLORS = {
    maleClub: '#2563EB',   // Blue 600
    femaleClub: '#DB2777', // Pink 600
    maleAvg: '#93C5FD',    // Blue 300 (Lighter for Avg)
    femaleAvg: '#F9A8D4',  // Pink 300 (Lighter for Avg)
    avgLine: '#D97706',    // Amber 600 (Darker for Light Mode contrast)
    avgLineDark: '#fbbf24' // Amber 400 (Lighter for Dark Mode contrast)
}

interface ClubDemographicsProps {
    data: {
        gender: { name: string; value: number }[]
        age: { range: string; count: number; percentage: number }[]
    }
    averageData: {
        gender: { name: string; value: number }[]
        age: { range: string; percentage: number }[]
    }
    className?: string
}

export default function ClubDemographics({ data, averageData, className = '' }: ClubDemographicsProps) {
    const { theme } = useTheme()
    const isDark = theme === 'dark'

    // Prepare Age Data: Merge Club Data with Average Data
    const ageChartData = data.age.map(item => {
        const avgItem = averageData.age.find(a => a.range === item.range)
        return {
            range: item.range,
            'This Club': Number(item.percentage.toFixed(1)),
            'National Avg': avgItem ? Number(avgItem.percentage.toFixed(1)) : 0
        }
    })

    // Prepare Gender Data
    const genderChartData = data.gender.map(item => ({
        name: `${item.name} (This Club)`,
        value: Number(item.value.toFixed(1))
    }))

    // Avg Gender Data
    const avgGenderChartData = averageData.gender.map(item => ({
        name: `${item.name} (Nat. Avg)`,
        value: Number(item.value.toFixed(1))
    }))

    // Custom Label for Inner Pie (Inside)
    const renderInnerLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
        if (percent < 0.1) return null
        const RADIAN = Math.PI / 180
        const radius = innerRadius + (outerRadius - innerRadius) * 0.5
        const x = cx + radius * Math.cos(-midAngle * RADIAN)
        const y = cy + radius * Math.sin(-midAngle * RADIAN)

        return (
            <text x={x} y={y} fill={isDark ? "black" : "black"} textAnchor="middle" dominantBaseline="central" fontSize={10} fontWeight="bold">
                {`${(percent * 100).toFixed(0)}%`}
            </text>
        )
    }

    // Custom Label for Outer Pie (Outside) - Adaptive Color
    const renderOuterLabel = (props: any) => {
        const { cx, cy, midAngle, innerRadius, outerRadius, value, index, name, percent } = props;
        const RADIAN = Math.PI / 180;
        const radius = outerRadius + 20; // Distance from center
        const x = cx + radius * Math.cos(-midAngle * RADIAN);
        const y = cy + radius * Math.sin(-midAngle * RADIAN);

        return (
            <text
                x={x}
                y={y}
                fill={isDark ? "white" : "black"}
                textAnchor={x > cx ? 'start' : 'end'}
                dominantBaseline="central"
                fontSize={12}
            >
                {`${(percent * 100).toFixed(1)}%`}
            </text>
        );
    };

    // Custom Legend Component
    const CustomLegend = () => (
        <div className="flex flex-col items-center mt-4 text-xs gap-1">
            <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center"><div className="w-3 h-3 mr-1" style={{ backgroundColor: COLORS.femaleClub }}></div>Female (This Club)</div>
                <div className="flex items-center"><div className="w-3 h-3 mr-1" style={{ backgroundColor: COLORS.maleClub }}></div>Male (This Club)</div>
            </div>
            <div className="flex flex-wrap justify-center gap-4">
                <div className="flex items-center"><div className="w-3 h-3 mr-1" style={{ backgroundColor: COLORS.femaleAvg }}></div>Female (Nat. Avg)</div>
                <div className="flex items-center"><div className="w-3 h-3 mr-1" style={{ backgroundColor: COLORS.maleAvg }}></div>Male (Nat. Avg)</div>
            </div>
        </div>
    )

    return (
        <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 ${className}`}>

            {/* Gender Distribution */}
            <div className="card-primary p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-app-primary">
                    <User className="w-5 h-5 mr-2" />
                    Gender Distribution
                </h3>
                <div className="h-[340px] w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            {/* Inner Pie: National Average (Increased Size) */}
                            <Pie
                                data={avgGenderChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={0}
                                outerRadius={75}
                                startAngle={90}
                                endAngle={-270}
                                dataKey="value"
                                stroke="white"
                                label={renderInnerLabel}
                                labelLine={false}
                                legendType="none"
                            >
                                {avgGenderChartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-avg-${index}`}
                                        fill={entry.name.includes('Male') ? COLORS.maleAvg : COLORS.femaleAvg}
                                    />
                                ))}
                            </Pie>

                            {/* Outer Pie: This Club (Increased Size) */}
                            <Pie
                                data={genderChartData}
                                cx="50%"
                                cy="50%"
                                innerRadius={85}
                                outerRadius={115}
                                startAngle={90}
                                endAngle={-270}
                                paddingAngle={2}
                                dataKey="value"
                                label={renderOuterLabel}
                                legendType="none"
                            >
                                {genderChartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.name.includes('Male') ? COLORS.maleClub : COLORS.femaleClub}
                                    />
                                ))}
                            </Pie>
                            {/* No Recharts Legend */}
                        </PieChart>
                    </ResponsiveContainer>
                </div>
                <CustomLegend />

            </div>

            {/* Age Distribution */}
            <div className="card-primary p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center text-app-primary">
                    <Users className="w-5 h-5 mr-2" />
                    Age Distribution
                </h3>
                <div className="h-[400px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart
                            data={ageChartData}
                            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                        >
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis
                                dataKey="range"
                                tick={{ fill: isDark ? '#9CA3AF' : '#4B5563', fontSize: 12 }}
                            />
                            <YAxis
                                tick={{ fill: isDark ? '#9CA3AF' : '#4B5563' }}
                                unit="%"
                            />
                            <Tooltip
                                cursor={{ fill: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' }}
                                contentStyle={{
                                    backgroundColor: isDark ? '#1F2937' : '#FFFFFF',
                                    borderColor: isDark ? '#374151' : '#E5E7EB',
                                    color: isDark ? '#F3F4F6' : '#111827'
                                }}
                            />
                            <Legend wrapperStyle={{ paddingTop: '20px' }} />
                            <Line
                                type="monotone"
                                dataKey="National Avg"
                                stroke={isDark ? COLORS.avgLineDark : COLORS.avgLine}
                                strokeWidth={3}
                                dot={{ r: 4, fill: isDark ? COLORS.avgLineDark : COLORS.avgLine }}
                            />
                            <Bar dataKey="This Club" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} />
                        </ComposedChart>
                    </ResponsiveContainer>
                </div>
            </div>


        </div>
    )
}
