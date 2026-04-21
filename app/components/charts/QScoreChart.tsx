"use client";

import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine
} from 'recharts';
import { BarChart3 } from 'lucide-react';

interface QScoreChartProps {
  chartData: any[];
  athlete: any;
  legendFlags: {
    hasQYouth: boolean;
    hasQMasters: boolean;
  };
}

export default function QScoreChart({ chartData, athlete, legendFlags }: QScoreChartProps) {
  const [autoScaleQScores, setAutoScaleQScores] = useState(true);
  const [showQScoresBrush, setShowQScoresBrush] = useState(false);
  const [showQPoints, setShowQPoints] = useState(true);
  const [showQYouth, setShowQYouth] = useState(false);
  const [showQMasters, setShowQMasters] = useState(true);
  const [qScoresMouseX, setQScoresMouseX] = useState<number | null>(null);

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-app-primary flex items-center">
          <BarChart3 className="h-5 w-5 mr-2" />
          {athlete.displayName} Q-Scores Over Time
        </h3>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
          {/* Q-score toggles */}
          <div className="flex gap-1 border border-app-secondary rounded-lg p-1 w-fit">
            <button
              onClick={() => setShowQPoints(!showQPoints)}
              className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showQPoints ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
            >
              Q-Points
            </button>
            {legendFlags.hasQYouth && (
              <button
                onClick={() => setShowQYouth(!showQYouth)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showQYouth ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Q-Youth
              </button>
            )}
            {legendFlags.hasQMasters && (
              <button
                onClick={() => setShowQMasters(!showQMasters)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showQMasters ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Q-Masters
              </button>
            )}
          </div>
          {/* Chart controls */}
          <div className="flex gap-2">
            <div className="flex space-x-1 border-app-secondary rounded-lg p-1">
              <button
                onClick={() => setAutoScaleQScores(!autoScaleQScores)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${autoScaleQScores ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Auto Scale
              </button>
              <button
                onClick={() => setShowQScoresBrush(!showQScoresBrush)}
                className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showQScoresBrush ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
              >
                Zoom
              </button>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-app-muted mb-4">
        <a
          href="https://www.usaweightlifting.org/news/2024/november/19/q-points-q-youth-to-be-used-in-2025-to-determine-best-lifters"
          target="_blank"
          rel="noopener noreferrer"
          className="text-accent-primary hover:text-accent-primary-hover underline decoration-1 underline-offset-2"
        >
          Q-Scores
        </a>{' '}normalize performance across age groups and weight classes. Higher scores indicate better performance.
      </p>

      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
          onMouseMove={(e) => {
            if (e && e.activeLabel && !showQScoresBrush) {
              setQScoresMouseX(Number(e.activeLabel));
            }
          }}
          onMouseLeave={() => setQScoresMouseX(null)}
        >
          {qScoresMouseX && !showQScoresBrush && (
            <ReferenceLine
              x={qScoresMouseX}
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
            domain={autoScaleQScores ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 5']}
            allowDataOverflow={true}
            tickFormatter={(value) => value.toFixed(2)}
            label={{
              value: 'Q-Score',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'var(--chart-axis)', fontSize: '12px' }
            }}
          />
          {!showQScoresBrush && (
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--chart-tooltip-bg)',
                border: '1px solid var(--chart-tooltip-border)',
                borderRadius: '8px',
                color: 'var(--text-primary)',
                fontSize: '14px',
                padding: '12px',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
                backdropFilter: 'blur(8px)',
              }}
              wrapperStyle={{
                zIndex: 9999,
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                padding: '4px'
              }}
              formatter={(value: any, name: string) => {
                if (!value && value !== 0) return ['-', name];
                if (typeof value === 'number') {
                  if (name === 'qpoints') return [value.toFixed(2), 'Q-Points'];
                  if (name === 'qYouth') return [value.toFixed(2), 'Q-Youth'];
                  if (name === 'qMasters') return [value.toFixed(2), 'Q-Masters'];
                  return [value.toFixed(2), name];
                } else {
                  return [String(value), name];
                }
              }}
              labelFormatter={(label, payload) => {
                if (payload && payload[0] && payload[0].payload) {
                  const data = payload[0].payload;
                  return `${data.meet} - ${data.dateWithAge}`;
                }
                return `Competition: ${new Date(label).toLocaleDateString()}`;
              }}
              isAnimationActive={false}
              cursor={false}
              animationDuration={150}
              allowEscapeViewBox={{ x: false, y: true }}
              position={{ x: undefined, y: undefined }}
            />
          )}

          {showQPoints && (
            <>
              <Line dataKey="qpointsBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line
                dataKey="qpoints"
                stroke="var(--chart-qpoints)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-qpoints)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-qpoints)', style: { cursor: 'pointer' } }}
                name="qpoints"
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}

          {showQYouth && chartData.some(d => d.qYouth) && (
            <>
              <Line dataKey="qYouthBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line
                dataKey="qYouth"
                stroke="var(--chart-qyouth)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-qyouth)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-qyouth)', style: { cursor: 'pointer' } }}
                name="qYouth"
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}

          {showQMasters && chartData.some(d => d.qMasters) && (
            <>
              <Line dataKey="qMastersBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line
                dataKey="qMasters"
                stroke="var(--chart-qmasters)"
                strokeWidth={2.5}
                dot={{ fill: 'var(--chart-qmasters)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-qmasters)', style: { cursor: 'pointer' } }}
                name="qMasters"
                connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}

          {showQScoresBrush && (
            <Brush key="q-scores-brush" dataKey="timestamp" height={20} y={500 - 20} stroke="var(--text-disabled)" fill="var(--chart-grid)" fillOpacity={0.6}
              tickFormatter={(timestamp) => new Date(timestamp).getFullYear().toString()}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
        <div className="flex items-center space-x-2">
          <div className="w-4 h-0.5 bg-[var(--chart-qpoints)]"></div>
          <span className="text-sm text-app-secondary">Q-Points</span>
        </div>
        {legendFlags.hasQYouth && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-qyouth)]"></div>
            <span className="text-sm text-app-secondary">Q-Youth</span>
          </div>
        )}
        {legendFlags.hasQMasters && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-qmasters)]"></div>
            <span className="text-sm text-app-secondary">Q-Masters</span>
          </div>
        )}
      </div>
    </div>
  );
}
