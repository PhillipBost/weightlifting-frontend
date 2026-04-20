"use client";

import React, { useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Brush, ReferenceLine
} from 'recharts';
import { Activity } from 'lucide-react';

interface GamxChartProps {
  chartData: any[];
  athlete: any;
  legendFlags: {
    hasGamxTotal: boolean;
    hasGamxS: boolean;
    hasGamxJ: boolean;
    hasGamxU: boolean;
    hasGamxA: boolean;
    hasGamxMasters: boolean;
  };
}

export default function GamxChart({ chartData, athlete, legendFlags }: GamxChartProps) {
  const [autoScaleGamx, setAutoScaleGamx] = useState(true);
  const [showGamxBrush, setShowGamxBrush] = useState(false);
  const [gamxMouseX, setGamxMouseX] = useState<number | null>(null);
  const [showGamxTotal, setShowGamxTotal] = useState(true);
  const [showGamxS, setShowGamxS] = useState(true);
  const [showGamxJ, setShowGamxJ] = useState(true);
  const [showGamxU, setShowGamxU] = useState(false);
  const [showGamxA, setShowGamxA] = useState(false);
  const [showGamxMasters, setShowGamxMasters] = useState(false);

  return (
    <div className="chart-container">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-4">
        <h3 className="text-lg font-semibold text-app-primary flex items-center">
          <Activity className="h-5 w-5 mr-2" />
          {athlete.athlete_name} GAMX Scores
        </h3>

        {/* Controls Container */}
        <div className="flex flex-col sm:items-end gap-2 w-full sm:w-auto">
          {/* Chart Controls & Toggles Row */}
          <div className="flex flex-col sm:flex-row sm:justify-end sm:items-center mb-4 gap-4">
            {/* Toggles */}
            <div className="flex flex-wrap gap-1 border border-app-secondary rounded-lg p-1 w-fit justify-end">
              {legendFlags.hasGamxTotal && (
                <button
                  onClick={() => setShowGamxTotal(!showGamxTotal)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxTotal ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-Total
                </button>
              )}
              {legendFlags.hasGamxS && (
                <button
                  onClick={() => setShowGamxS(!showGamxS)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxS ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-S
                </button>
              )}
              {legendFlags.hasGamxJ && (
                <button
                  onClick={() => setShowGamxJ(!showGamxJ)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxJ ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-J
                </button>
              )}
              {legendFlags.hasGamxU && (
                <button
                  onClick={() => setShowGamxU(!showGamxU)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxU ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-U
                </button>
              )}
              {legendFlags.hasGamxA && (
                <button
                  onClick={() => setShowGamxA(!showGamxA)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxA ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-A
                </button>
              )}
              {legendFlags.hasGamxMasters && (
                <button
                  onClick={() => setShowGamxMasters(!showGamxMasters)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out ${showGamxMasters ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  GAMX-Masters
                </button>
              )}
            </div>

            {/* Chart Controls (Auto Scale, Zoom) */}
            <div className="flex justify-end w-full sm:w-auto">
              <div className="flex space-x-1 border-app-secondary rounded-lg p-1">
                <button
                  onClick={() => setAutoScaleGamx(!autoScaleGamx)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out whitespace-nowrap ${autoScaleGamx ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  Auto Scale
                </button>
                <button
                  onClick={() => setShowGamxBrush(!showGamxBrush)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-all duration-300 ease-in-out whitespace-nowrap ${showGamxBrush ? 'bg-accent-primary text-white' : 'bg-app-surface text-app-secondary hover:bg-app-hover'}`}
                >
                  Zoom
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="text-sm text-app-muted mb-4">
        <span className="font-bold text-blue-500">G</span>eneralized{' '}
        <span className="font-bold text-blue-500">A</span>dditive{' '}
        <span className="font-bold text-blue-500">M</span>odel adjusted for se
        <span className="font-bold text-blue-500">X</span> (<span className="font-bold text-blue-500">GAMX</span>) scores.
      </p>

      <ResponsiveContainer width="100%" height={500}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 50, left: 20, bottom: 20 }}
          onMouseMove={(e) => {
            if (e && e.activeLabel && !showGamxBrush) {
              setGamxMouseX(Number(e.activeLabel));
            }
          }}
          onMouseLeave={() => setGamxMouseX(null)}
        >
          {gamxMouseX && !showGamxBrush && (
            <ReferenceLine x={gamxMouseX} stroke="var(--text-muted)" strokeWidth={1} strokeDasharray="2 2" strokeOpacity={0.6} />
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
            tickFormatter={(value) => value.toFixed(0)}
            domain={autoScaleGamx ? ['dataMin - 10', 'dataMax + 10'] : [0, 'dataMax + 5']}
            allowDataOverflow={true}
            label={{
              value: 'Score',
              angle: -90,
              position: 'insideLeft',
              style: { textAnchor: 'middle', fill: 'var(--chart-axis)', fontSize: '12px' }
            }}
          />
          {!showGamxBrush && (
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
              wrapperStyle={{ zIndex: 9999, backgroundColor: 'rgba(0, 0, 0, 0.1)', borderRadius: '12px', padding: '4px' }}
              formatter={(value: any, name: string) => {
                if (!value && value !== 0) return ['-', name];
                if (typeof value === 'number') return [value.toFixed(0), name];
                return [String(value), name];
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

          {showGamxTotal && chartData.some(d => d.gamxTotal) && (
            <>
              <Line dataKey="gamxTotalBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxTotal" stroke="var(--chart-gamx-total)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-total)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-total)', style: { cursor: 'pointer' } }}
                name="GAMX-Total" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
          {showGamxS && chartData.some(d => d.gamxS) && (
            <>
              <Line dataKey="gamxSBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxS" stroke="var(--chart-gamx-s)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-s)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-s)', style: { cursor: 'pointer' } }}
                name="GAMX-S" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
          {showGamxJ && chartData.some(d => d.gamxJ) && (
            <>
              <Line dataKey="gamxJBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxJ" stroke="var(--chart-gamx-j)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-j)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-j)', style: { cursor: 'pointer' } }}
                name="GAMX-J" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
          {showGamxU && chartData.some(d => d.gamxU) && (
            <>
              <Line dataKey="gamxUBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxU" stroke="var(--chart-gamx-u)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-u)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-u)', style: { cursor: 'pointer' } }}
                name="GAMX-U" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
          {showGamxA && chartData.some(d => d.gamxA) && (
            <>
              <Line dataKey="gamxABackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxA" stroke="var(--chart-gamx-a)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-a)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-a)', style: { cursor: 'pointer' } }}
                name="GAMX-A" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}
          {showGamxMasters && chartData.some(d => d.gamxMasters) && (
            <>
              <Line dataKey="gamxMastersBackground" stroke="var(--chart-stroke)" strokeWidth={3} dot={false} activeDot={false} legendType="none" hide={true} />
              <Line dataKey="gamxMasters" stroke="var(--chart-gamx-masters)" strokeWidth={2.5}
                dot={{ fill: 'var(--chart-gamx-masters)', stroke: 'var(--chart-stroke)', strokeWidth: 0.5, r: 5, style: { cursor: 'pointer' } }}
                activeDot={{ r: 8, stroke: 'var(--chart-stroke)', strokeWidth: 2, fill: 'var(--chart-gamx-masters)', style: { cursor: 'pointer' } }}
                name="GAMX-Masters" connectNulls={false}
                isAnimationActive={false}
              />
            </>
          )}

          {showGamxBrush && (
            <Brush key="gamx-brush" dataKey="timestamp" height={20} y={500 - 20} stroke="var(--text-disabled)" fill="var(--chart-grid)" fillOpacity={0.6}
              tickFormatter={(timestamp) => new Date(timestamp).getFullYear().toString()}
            />
          )}
        </LineChart>
      </ResponsiveContainer>

      <div className="flex flex-wrap justify-center gap-6 mt-4 pt-4 border-t border-app-secondary">
        {legendFlags.hasGamxTotal && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-total)]"></div>
            <span className="text-sm text-app-secondary">GAMX-Total</span>
          </div>
        )}
        {legendFlags.hasGamxS && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-s)]"></div>
            <span className="text-sm text-app-secondary">GAMX-S</span>
          </div>
        )}
        {legendFlags.hasGamxJ && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-j)]"></div>
            <span className="text-sm text-app-secondary">GAMX-J</span>
          </div>
        )}
        {legendFlags.hasGamxU && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-u)]"></div>
            <span className="text-sm text-app-secondary">GAMX-U</span>
          </div>
        )}
        {legendFlags.hasGamxA && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-a)]"></div>
            <span className="text-sm text-app-secondary">GAMX-A</span>
          </div>
        )}
        {legendFlags.hasGamxMasters && (
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-[var(--chart-gamx-masters)]"></div>
            <span className="text-sm text-app-secondary">GAMX-Masters</span>
          </div>
        )}
      </div>
    </div>
  );
}
