"use client";

import React, { useState, useRef } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine
} from 'recharts';
import { TrendingUp } from 'lucide-react';

interface PerformanceChartProps {
  chartData: any[];
  athlete: any;
}

export default function PerformanceChart({ chartData, athlete }: PerformanceChartProps) {
  const [autoScalePerformance, setAutoScalePerformance] = useState(true);
  const [showPerformanceBrush, setShowPerformanceBrush] = useState(false);
  const [showSnatch, setShowSnatch] = useState(true);
  const [showCleanJerk, setShowCleanJerk] = useState(true);
  const [showAttempts, setShowAttempts] = useState(true);
  const [showTotal, setShowTotal] = useState(true);
  const [showBodyweight, setShowBodyweight] = useState(true);
  const [performanceMouseX, setPerformanceMouseX] = useState<number | null>(null);

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-app-primary flex items-center">
          <TrendingUp className="h-5 w-5 mr-2" />
          {athlete.athlete_name} Performance Progress
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {/* Performance toggles in their own bordered group */}
          <div className="flex gap-1 border border-app-secondary rounded-lg p-1 w-fit">
            <button
              onClick={() => setShowSnatch(!showSnatch)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showSnatch ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              Snatch
            </button>
            <button
              onClick={() => setShowCleanJerk(!showCleanJerk)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showCleanJerk ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              C&J
            </button>
            <button
              onClick={() => setShowTotal(!showTotal)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showTotal ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              Total
            </button>
            <button
              onClick={() => setShowAttempts(!showAttempts)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showAttempts ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              Attempts
            </button>
            <button
              onClick={() => setShowBodyweight(!showBodyweight)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showBodyweight ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              Bodyweight
            </button>
          </div>

          {/* Chart controls in their own separate group */}
          <div className="flex gap-2">
            <div className="flex space-x-1 border-app-secondary rounded-lg p-1">
              <button
                onClick={() => setAutoScalePerformance(!autoScalePerformance)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${autoScalePerformance ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Auto Scale
              </button>
              <button
                onClick={() => setShowPerformanceBrush(!showPerformanceBrush)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showPerformanceBrush ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Zoom
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-app-muted mb-4">
        Lifting performance over time.
      </p>

      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
          onMouseMove={(e) => {
            if (e && e.activeLabel && !showPerformanceBrush) {
              setPerformanceMouseX(Number(e.activeLabel));
            }
          }}
          onMouseLeave={() => setPerformanceMouseX(null)}
        >
          {performanceMouseX && !showPerformanceBrush && (
            <ReferenceLine
              x={performanceMouseX}
              stroke="var(--text-muted)"
              strokeWidth={1}
              strokeDasharray="2 2"
              strokeOpacity={0.6}
            />
          )}
          <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
          <XAxis
            type="number"
            dataKey="timestamp"
            scale="time"
            domain={['dataMin', 'dataMax']}
            stroke="var(--chart-axis)"
            fontSize={11}
            tickFormatter={(timestamp) => {
              const date = new Date(timestamp);
              const year = date.getFullYear().toString().slice(-2);
              return `Jan '${year}`;
            }}
            padding={{ left: 10, right: 10 }}
            ticks={(() => {
              if (chartData.length === 0) return [];
              const minYear = new Date(Math.min(...chartData.map(d => d.timestamp))).getFullYear();
              const maxYear = new Date(Math.max(...chartData.map(d => d.timestamp))).getFullYear();
              const ticks = [];
              for (let year = minYear - 1; year <= maxYear + 1; year++) {
                ticks.push(new Date(year, 0, 1).getTime());
              }
              return ticks;
            })()}
            allowDataOverflow={true}
            label={{
              value: 'Competition Date (Competition Age)',
              position: 'insideBottom',
              offset: -5,
              style: { textAnchor: 'middle', fill: 'var(--chart-axis)', fontSize: '12px' }
            }}
          />
          <YAxis
            stroke="var(--chart-axis)"
            fontSize={12}
            domain={autoScalePerformance ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 5']}
            allowDataOverflow={true}
            tickFormatter={(value) => parseFloat(value.toFixed(2)).toString()}
            label={{
              value: 'Weight (kg)',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'var(--chart-axis)', fontSize: '12px' }
            }}
          />
          {!showPerformanceBrush && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: '1px solid var(--chart-tooltip-border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                padding: '12px',
                zIndex: 9999,
              }}
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-app-secondary border border-app-primary rounded-lg p-3">
                      <p className="text-app-primary font-medium mb-2">{`${data.meet} - ${data.dateWithAge}`}</p>
                      {data.total && (
                        <p style={{ color: 'var(--chart-total)' }}>Total: {data.total}kg</p>
                      )}
                      <p style={{ color: 'var(--chart-cleanjerk)' }}>
                        Best Clean &amp; Jerk: {data.cleanJerk ? `${data.cleanJerk}kg` : '-'}
                      </p>
                      {[1, 2, 3].map(num => {
                        const good = data[`cjGood${num}`];
                        const miss = data[`cjMiss${num}`];
                        if (good || miss) {
                          return (
                            <p key={`cj-${num}`} style={{ color: 'var(--text-primary)' }}>
                              C&J Attempt {num} {good ? '✓' : '✗'}: {good || miss}kg
                            </p>
                          );
                        }
                        return null;
                      })}
                      <p style={{ color: 'var(--chart-snatch)' }}>
                        Best Snatch: {data.snatch ? `${data.snatch}kg` : '-'}
                      </p>
                      {[1, 2, 3].map(num => {
                        const good = data[`snatchGood${num}`];
                        const miss = data[`snatchMiss${num}`];
                        if (good || miss) {
                          return (
                            <p key={`snatch-${num}`} style={{ color: 'var(--text-primary)' }}>
                              Snatch Attempt {num} {good ? '✓' : '✗'}: {good || miss}kg
                            </p>
                          );
                        }
                        return null;
                      })}
                      {data.bodyweight && (
                        <p style={{ color: 'var(--chart-bodyweight)' }}>Bodyweight: {data.bodyweight}kg</p>
                      )}
                    </div>
                  );
                }
                return null;
              }}
              cursor={false}
              animationDuration={150}
              allowEscapeViewBox={{ x: false, y: true }}
              position={{ x: undefined, y: undefined }}
            />
          )}

          {showSnatch && (
            <>
              <Line dataKey="snatch" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" />
              <Line
                dataKey="snatch"
                stroke="var(--chart-snatch)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-snatch)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-snatch)', style: { cursor: 'pointer' } }}
                name="snatch"
                connectNulls={false}
              />
              {showAttempts && (
                <>
                  {[1, 2, 3].map(attemptNum => (
                    <Line key={`snatch-good-${attemptNum}`} type="monotone" dataKey={`snatchGood${attemptNum}`} stroke="none" dot={{ fill: 'none', stroke: 'var(--chart-snatch)', strokeWidth: 1, r: 2.5 }} activeDot={false} connectNulls={false} legendType="none" />
                  ))}
                  {[1, 2, 3].map(attemptNum => (
                    <Line key={`snatch-miss-${attemptNum}`} type="monotone" dataKey={`snatchMiss${attemptNum}`} stroke="none" dot={{ fill: 'none', stroke: 'var(--chart-failed)', strokeWidth: 1, r: 2.5 }} activeDot={false} connectNulls={false} legendType="none" />
                  ))}
                </>
              )}
            </>
          )}

          {showPerformanceBrush && (
            <Brush key="performance-brush" dataKey="timestamp" height={20} y={500 - 20} stroke="var(--text-disabled)" fill="var(--chart-grid)" fillOpacity={0.6}
              tickFormatter={(timestamp) => new Date(timestamp).getFullYear().toString()}
            />
          )}

          {showCleanJerk && (
            <>
              <Line dataKey="cleanJerk" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} />
              <Line
                dataKey="cleanJerk"
                stroke="var(--chart-cleanjerk)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-cleanjerk)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-cleanjerk)', style: { cursor: 'pointer' } }}
                name="cleanJerk"
                connectNulls={false}
              />
              {showAttempts && (
                <>
                  {[1, 2, 3].map(attemptNum => (
                    <Line key={`cj-good-${attemptNum}`} type="monotone" dataKey={`cjGood${attemptNum}`} stroke="none" dot={{ fill: 'none', stroke: 'var(--chart-cleanjerk)', strokeWidth: 1, r: 2.5 }} activeDot={false} connectNulls={false} legendType="none" />
                  ))}
                  {[1, 2, 3].map(attemptNum => (
                    <Line key={`cj-miss-${attemptNum}`} type="monotone" dataKey={`cjMiss${attemptNum}`} stroke="none" dot={{ fill: 'none', stroke: 'var(--chart-failed)', strokeWidth: 1, r: 2.5 }} activeDot={false} connectNulls={false} legendType="none" />
                  ))}
                </>
              )}
            </>
          )}

          {showTotal && (
            <>
              <Line dataKey="total" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} />
              <Line
                dataKey="total"
                stroke="var(--chart-total)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-total)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-total)', style: { cursor: 'pointer' } }}
                name="total"
                connectNulls={false}
              />
            </>
          )}

          {showBodyweight && (
            <>
              <Line dataKey="bodyweight" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} />
              <Line
                dataKey="bodyweight"
                stroke="var(--chart-bodyweight)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-bodyweight)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-bodyweight)', style: { cursor: 'pointer' } }}
                name="bodyweight"
                connectNulls={false}
              />
            </>
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[var(--chart-snatch)]"></div>
          <span className="text-sm text-app-secondary">Snatch</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[var(--chart-cleanjerk)]"></div>
          <span className="text-sm text-app-secondary">Clean &amp; Jerk</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[var(--chart-total)]"></div>
          <span className="text-sm text-app-secondary">Total</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[var(--chart-bodyweight)]"></div>
          <span className="text-sm text-app-secondary">Bodyweight</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[var(--chart-snatch)] opacity-100 border border-[var(--chart-stroke)] border-opacity-50"></div>
          <span className="text-sm text-app-secondary">Best Snatch</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-3 h-3 rounded-full bg-[var(--chart-cleanjerk)] opacity-100 border border-[var(--chart-stroke)] border-opacity-50"></div>
          <span className="text-sm text-app-secondary">Best C&J</span>
        </div>
      </div>

      <div className="flex flex-wrap justify-center gap-4 mt-2 text-sm">
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-snatch)]/50 border border-[var(--chart-snatch)]"></div>
          <span className="text-app-secondary">Snatch attempts</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-cleanjerk)]/50 border border-[var(--chart-cleanjerk)]"></div>
          <span className="text-app-secondary">C&J attempts</span>
        </div>
        <div className="flex items-center space-x-2">
          <div className="w-1.5 h-1.5 rounded-full bg-[var(--chart-failed)]/50 border border-[var(--chart-failed)]"></div>
          <span className="text-app-secondary">Failed attempts</span>
        </div>
      </div>
    </div>
  );
}
