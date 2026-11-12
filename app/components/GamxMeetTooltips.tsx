'use client';

import React from 'react';
import { MetricTooltip } from './MetricTooltip';
import { GAMX_DEFINITIONS } from '@/lib/utils/gamxDefinitions';

const columnDescriptions: Record<keyof typeof GAMX_DEFINITIONS, string> = {
  total: 'Age Range: 15–40. Evaluates competition Total (Snatch + Clean & Jerk), adjusted for body mass (minimum 40 kg) and sex. Based on IWF Senior World Championships.',
  s: 'Age Range: 15–40. Evaluates the best Snatch, adjusted for body mass and sex. Based on IWF Senior World Championships.',
  j: 'Age Range: 15–40. Evaluates the best Clean & Jerk, adjusted for body mass and sex. Based on IWF Senior World Championships.',
  u: 'Age Range: 7–17. Evaluates competition Total, adjusted for body mass (minimum 25 kg), sex, and age. Based on USAW national championships.',
  a: 'Age Range: 13–40. Evaluates competition Total, adjusted for body mass (minimum 30 kg), sex, and age. Based on IWF Youth, Junior, and Senior World Championships.',
  masters: 'Age Range: 30+. Evaluates competition Total, adjusted for body mass, sex, and age. Based on IMWA World Masters Championships.'
};

export function GamxMeetColumnTooltip({ metric, children }: { metric: keyof typeof GAMX_DEFINITIONS; children: React.ReactNode }) {
  return (
    <MetricTooltip title={GAMX_DEFINITIONS[metric].title} description={columnDescriptions[metric]} showIcon={false}>
      {children}
    </MetricTooltip>
  );
}

export function GamxMeetHeading() {
  return (
    <>
      Overall Rankings by{' '}
      <MetricTooltip
        inline
        iconSize="h-3 w-3"
        className="[&_svg]:opacity-40"
        title="GAMX"
        description={
          <>
            <p className="text-sm text-app-muted mb-4"><span className="font-bold text-blue-500">G</span>eneralized <span className="font-bold text-blue-500">A</span>dditive <span className="font-bold text-blue-500">M</span>odel adjusted for se<span className="font-bold text-blue-500">X</span> (<span className="font-bold text-blue-500">GAMX</span>) scores.</p>
            <p className="mb-2">GAMX compares weightlifting performances across body mass and sex, and age where applicable. A two-lift total is the best snatch plus the best clean &amp; jerk.</p>
            <p className="mb-2"><strong>How it&apos;s calculated:</strong> GAMX points = M + z-score × SD, where M = 1000 and SD = 100. The z-score measures the distance from the reference mean in standard deviations; 1000 points is the median.</p>
            <p className="mb-1">The reference tables for different age groups are based on:</p>
            <ul className="list-disc pl-5">
              <li>IWF World Championships and Olympics, 2019 to 2025</li>
              <li>IMWA World Master Championships 2018 to 2025</li>
              <li>USAW American Open and National Championships 2018 to 2025</li>
            </ul>
            <p className="mt-2"><a href="https://huebner.shinyapps.io/GAMX/" target="_blank" rel="noopener noreferrer" className="text-accent-primary hover:underline">GAMX calculator</a></p>
          </>
        }
      >
        GAMX
      </MetricTooltip>
    </>
  );
}
