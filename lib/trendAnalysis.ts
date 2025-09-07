/**
 * Trend Analysis Library for Performance Consistency Metrics
 * 
 * This library provides automated trend line selection and detrended consistency 
 * calculations to properly assess athlete performance consistency by separating 
 * systematic improvement/decline from random variation.
 */

export type TrendType = 'linear' | 'quadratic' | 'exponential' | 'logarithmic' | 'power' | 'flat';

export interface TrendModel {
  type: TrendType;
  rSquared: number;
  residualSumSquares: number;
  aic: number;
  coefficients: number[];
  predict: (x: number) => number;
  description: string;
}

export interface TrendAnalysisResult {
  bestModel: TrendModel;
  allModels: TrendModel[];
  detrended: {
    residuals: number[];
    consistencyScore: number;
    coefficientOfVariation: number;
  };
  trend: {
    type: TrendType;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    direction: 'improving' | 'declining' | 'stable';
    description: string;
  };
}

/**
 * Calculate coefficient of determination (R²)
 */
function calculateRSquared(actual: number[], predicted: number[]): number {
  if (actual.length !== predicted.length || actual.length === 0) return 0;
  
  const actualMean = actual.reduce((sum, val) => sum + val, 0) / actual.length;
  const totalSumSquares = actual.reduce((sum, val) => sum + Math.pow(val - actualMean, 2), 0);
  
  if (totalSumSquares === 0) return 1; // Perfect fit if no variance
  
  const residualSumSquares = actual.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  
  return Math.max(0, 1 - (residualSumSquares / totalSumSquares));
}

/**
 * Calculate Akaike Information Criterion (AIC) for model comparison
 */
function calculateAIC(residualSumSquares: number, numParameters: number, numDataPoints: number): number {
  if (numDataPoints <= numParameters || residualSumSquares <= 0) return Infinity;
  
  const logLikelihood = -0.5 * numDataPoints * Math.log(2 * Math.PI * residualSumSquares / numDataPoints) - 0.5 * residualSumSquares / (residualSumSquares / numDataPoints);
  return 2 * numParameters - 2 * logLikelihood;
}

/**
 * Linear regression: y = a + bx
 */
function fitLinearModel(xValues: number[], yValues: number[]): TrendModel {
  const n = xValues.length;
  
  if (n < 2) {
    return {
      type: 'linear',
      rSquared: 0,
      residualSumSquares: 0,
      aic: Infinity,
      coefficients: [0, 0],
      predict: () => 0,
      description: 'Insufficient data for linear model'
    };
  }
  
  const xMean = xValues.reduce((sum, val) => sum + val, 0) / n;
  const yMean = yValues.reduce((sum, val) => sum + val, 0) / n;
  
  let numerator = 0;
  let denominator = 0;
  
  for (let i = 0; i < n; i++) {
    const xDiff = xValues[i] - xMean;
    const yDiff = yValues[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }
  
  const slope = denominator === 0 ? 0 : numerator / denominator;
  const intercept = yMean - slope * xMean;
  
  const predict = (x: number) => intercept + slope * x;
  const predicted = xValues.map(predict);
  const rSquared = calculateRSquared(yValues, predicted);
  const residualSumSquares = yValues.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const aic = calculateAIC(residualSumSquares, 2, n);
  
  return {
    type: 'linear',
    rSquared,
    residualSumSquares,
    aic,
    coefficients: [intercept, slope],
    predict,
    description: slope > 0 ? 'Linear improvement' : slope < 0 ? 'Linear decline' : 'Stable performance'
  };
}

/**
 * Quadratic regression: y = a + bx + cx²
 */
function fitQuadraticModel(xValues: number[], yValues: number[]): TrendModel {
  const n = xValues.length;
  
  if (n < 3) {
    return {
      type: 'quadratic',
      rSquared: 0,
      residualSumSquares: Infinity,
      aic: Infinity,
      coefficients: [0, 0, 0],
      predict: () => 0,
      description: 'Insufficient data for quadratic model'
    };
  }
  
  // Set up matrix equations for least squares: X^T * X * coeffs = X^T * y
  const matrix = Array(3).fill(0).map(() => Array(3).fill(0));
  const vector = Array(3).fill(0);
  
  for (let i = 0; i < n; i++) {
    const x = xValues[i];
    const y = yValues[i];
    const x2 = x * x;
    const x3 = x2 * x;
    const x4 = x3 * x;
    
    // Fill symmetric matrix
    matrix[0][0] += 1;
    matrix[0][1] += x;
    matrix[0][2] += x2;
    matrix[1][1] += x2;
    matrix[1][2] += x3;
    matrix[2][2] += x4;
    
    vector[0] += y;
    vector[1] += x * y;
    vector[2] += x2 * y;
  }
  
  // Complete symmetric matrix
  matrix[1][0] = matrix[0][1];
  matrix[2][0] = matrix[0][2];
  matrix[2][1] = matrix[1][2];
  
  // Solve using Gaussian elimination (simplified for 3x3)
  try {
    // Forward elimination
    for (let k = 0; k < 2; k++) {
      for (let i = k + 1; i < 3; i++) {
        const factor = matrix[i][k] / matrix[k][k];
        for (let j = k; j < 3; j++) {
          matrix[i][j] -= factor * matrix[k][j];
        }
        vector[i] -= factor * vector[k];
      }
    }
    
    // Back substitution
    const coeffs = Array(3).fill(0);
    for (let i = 2; i >= 0; i--) {
      coeffs[i] = vector[i];
      for (let j = i + 1; j < 3; j++) {
        coeffs[i] -= matrix[i][j] * coeffs[j];
      }
      coeffs[i] /= matrix[i][i];
    }
    
    const [a, b, c] = coeffs;
    const predict = (x: number) => a + b * x + c * x * x;
    const predicted = xValues.map(predict);
    const rSquared = calculateRSquared(yValues, predicted);
    const residualSumSquares = yValues.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
    const aic = calculateAIC(residualSumSquares, 3, n);
    
    let description = 'Quadratic trend';
    if (Math.abs(c) < 0.01) {
      description = 'Nearly linear trend';
    } else if (c > 0) {
      description = 'Accelerating improvement';
    } else {
      description = 'Decelerating improvement';
    }
    
    return {
      type: 'quadratic',
      rSquared,
      residualSumSquares,
      aic,
      coefficients: [a, b, c],
      predict,
      description
    };
  } catch (error) {
    // Fallback to linear if quadratic fails
    return fitLinearModel(xValues, yValues);
  }
}

/**
 * Logarithmic regression: y = a + b*ln(x)
 * Note: Requires positive x values
 */
function fitLogarithmicModel(xValues: number[], yValues: number[]): TrendModel {
  const n = xValues.length;
  
  if (n < 2 || xValues.some(x => x <= 0)) {
    return {
      type: 'logarithmic',
      rSquared: 0,
      residualSumSquares: Infinity,
      aic: Infinity,
      coefficients: [0, 0],
      predict: () => 0,
      description: 'Invalid data for logarithmic model'
    };
  }
  
  // Transform x values to ln(x)
  const lnXValues = xValues.map(x => Math.log(x));
  const linearModel = fitLinearModel(lnXValues, yValues);
  
  const [a, b] = linearModel.coefficients;
  const predict = (x: number) => x > 0 ? a + b * Math.log(x) : 0;
  const predicted = xValues.map(predict);
  const rSquared = calculateRSquared(yValues, predicted);
  const residualSumSquares = yValues.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const aic = calculateAIC(residualSumSquares, 2, n);
  
  return {
    type: 'logarithmic',
    rSquared,
    residualSumSquares,
    aic,
    coefficients: [a, b],
    predict,
    description: 'Early rapid improvement that plateaus'
  };
}

/**
 * Exponential regression: y = a*e^(bx)
 * Note: Requires positive y values
 */
function fitExponentialModel(xValues: number[], yValues: number[]): TrendModel {
  const n = xValues.length;
  
  if (n < 2 || yValues.some(y => y <= 0)) {
    return {
      type: 'exponential',
      rSquared: 0,
      residualSumSquares: Infinity,
      aic: Infinity,
      coefficients: [0, 0],
      predict: () => 0,
      description: 'Invalid data for exponential model'
    };
  }
  
  // Transform y values to ln(y) and fit linear model
  const lnYValues = yValues.map(y => Math.log(y));
  const linearModel = fitLinearModel(xValues, lnYValues);
  
  const [lnA, b] = linearModel.coefficients;
  const a = Math.exp(lnA);
  const predict = (x: number) => a * Math.exp(b * x);
  const predicted = xValues.map(predict);
  const rSquared = calculateRSquared(yValues, predicted);
  const residualSumSquares = yValues.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const aic = calculateAIC(residualSumSquares, 2, n);
  
  return {
    type: 'exponential',
    rSquared,
    residualSumSquares,
    aic,
    coefficients: [a, b],
    predict,
    description: b > 0 ? 'Exponential improvement' : 'Exponential decline'
  };
}

/**
 * Power regression: y = ax^b
 * Note: Requires positive x and y values
 */
function fitPowerModel(xValues: number[], yValues: number[]): TrendModel {
  const n = xValues.length;
  
  if (n < 2 || xValues.some(x => x <= 0) || yValues.some(y => y <= 0)) {
    return {
      type: 'power',
      rSquared: 0,
      residualSumSquares: Infinity,
      aic: Infinity,
      coefficients: [0, 0],
      predict: () => 0,
      description: 'Invalid data for power model'
    };
  }
  
  // Transform to log-log space: ln(y) = ln(a) + b*ln(x)
  const lnXValues = xValues.map(x => Math.log(x));
  const lnYValues = yValues.map(y => Math.log(y));
  const linearModel = fitLinearModel(lnXValues, lnYValues);
  
  const [lnA, b] = linearModel.coefficients;
  const a = Math.exp(lnA);
  const predict = (x: number) => x > 0 ? a * Math.pow(x, b) : 0;
  const predicted = xValues.map(predict);
  const rSquared = calculateRSquared(yValues, predicted);
  const residualSumSquares = yValues.reduce((sum, val, i) => sum + Math.pow(val - predicted[i], 2), 0);
  const aic = calculateAIC(residualSumSquares, 2, n);
  
  return {
    type: 'power',
    rSquared,
    residualSumSquares,
    aic,
    coefficients: [a, b],
    predict,
    description: 'Power law scaling'
  };
}

/**
 * Flat model: y = constant (mean)
 */
function fitFlatModel(xValues: number[], yValues: number[]): TrendModel {
  const n = yValues.length;
  
  if (n === 0) {
    return {
      type: 'flat',
      rSquared: 0,
      residualSumSquares: 0,
      aic: Infinity,
      coefficients: [0],
      predict: () => 0,
      description: 'No data'
    };
  }
  
  const mean = yValues.reduce((sum, val) => sum + val, 0) / n;
  const predict = () => mean;
  const predicted = xValues.map(predict);
  const rSquared = calculateRSquared(yValues, predicted);
  const residualSumSquares = yValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0);
  const aic = calculateAIC(residualSumSquares, 1, n);
  
  return {
    type: 'flat',
    rSquared,
    residualSumSquares,
    aic,
    coefficients: [mean],
    predict,
    description: 'Stable performance'
  };
}

/**
 * Analyze performance trend and calculate detrended consistency
 */
export function analyzeTrend(competitionData: Array<{ date: string; total: number }>): TrendAnalysisResult {
  if (competitionData.length < 2) {
    throw new Error('Insufficient data for trend analysis (minimum 2 data points required)');
  }
  
  // Sort by date and prepare data
  const sortedData = [...competitionData]
    .filter(d => d.total > 0) // Filter out invalid totals
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  if (sortedData.length < 2) {
    throw new Error('Insufficient valid data points for trend analysis');
  }
  
  // Convert to numeric arrays (use competition index as x-axis for simplicity)
  const xValues = sortedData.map((_, index) => index + 1);
  const yValues = sortedData.map(d => d.total);
  
  // Fit all models
  const models: TrendModel[] = [
    fitFlatModel(xValues, yValues),
    fitLinearModel(xValues, yValues),
    fitQuadraticModel(xValues, yValues),
  ];
  
  // Add advanced models only if data is suitable
  if (xValues.every(x => x > 0)) {
    models.push(fitLogarithmicModel(xValues, yValues));
  }
  
  if (yValues.every(y => y > 0)) {
    models.push(fitExponentialModel(xValues, yValues));
    
    if (xValues.every(x => x > 0)) {
      models.push(fitPowerModel(xValues, yValues));
    }
  }
  
  // Select best model based on AIC (lower is better), with R² as tiebreaker
  const validModels = models.filter(m => isFinite(m.aic) && isFinite(m.rSquared));
  
  if (validModels.length === 0) {
    throw new Error('No valid models could be fit to the data');
  }
  
  const bestModel = validModels.reduce((best, current) => {
    if (current.aic < best.aic) return current;
    if (Math.abs(current.aic - best.aic) < 0.1 && current.rSquared > best.rSquared) return current;
    return best;
  });
  
  // Calculate residuals and detrended consistency
  const predicted = xValues.map(x => bestModel.predict(x));
  const residuals = yValues.map((y, i) => y - predicted[i]);
  
  // Calculate detrended CV
  const residualMean = residuals.reduce((sum, val) => sum + Math.abs(val), 0) / residuals.length;
  const residualStdDev = Math.sqrt(
    residuals.reduce((sum, val) => sum + Math.pow(val, 2), 0) / residuals.length
  );
  
  const originalMean = yValues.reduce((sum, val) => sum + val, 0) / yValues.length;
  const detrended_cv = originalMean > 0 ? (residualStdDev / originalMean) * 100 : 0;
  const consistencyScore = Math.max(0, 100 - detrended_cv);
  
  // Determine trend characteristics
  let direction: 'improving' | 'declining' | 'stable' = 'stable';
  let strength: 'strong' | 'moderate' | 'weak' | 'none' = 'none';
  
  if (bestModel.type === 'linear') {
    const slope = bestModel.coefficients[1];
    if (Math.abs(slope) > 5) {
      direction = slope > 0 ? 'improving' : 'declining';
      strength = Math.abs(slope) > 15 ? 'strong' : Math.abs(slope) > 10 ? 'moderate' : 'weak';
    }
  } else if (bestModel.type !== 'flat') {
    const firstPrediction = bestModel.predict(xValues[0]);
    const lastPrediction = bestModel.predict(xValues[xValues.length - 1]);
    const change = lastPrediction - firstPrediction;
    
    if (Math.abs(change) > 5) {
      direction = change > 0 ? 'improving' : 'declining';
      strength = Math.abs(change) > 30 ? 'strong' : Math.abs(change) > 15 ? 'moderate' : 'weak';
    }
  }
  
  // Strong R² reinforces strength assessment
  if (bestModel.rSquared > 0.8 && strength !== 'none') {
    strength = 'strong';
  } else if (bestModel.rSquared < 0.3) {
    strength = strength === 'strong' ? 'moderate' : 'weak';
  }
  
  const trendDescription = strength === 'none' ? 
    'No clear trend' : 
    `${strength} ${direction} trend (${bestModel.description})`;
  
  return {
    bestModel,
    allModels: models,
    detrended: {
      residuals,
      consistencyScore: Math.round(consistencyScore),
      coefficientOfVariation: Math.round(detrended_cv * 10) / 10
    },
    trend: {
      type: bestModel.type,
      strength,
      direction,
      description: trendDescription
    }
  };
}

/**
 * Calculate both traditional and detrended consistency metrics for comparison
 */
export function calculateEnhancedConsistency(totals: number[], competitionData?: Array<{ date: string; total: number }>): {
  traditional: { score: number; coefficientOfVariation: number };
  detrended?: {
    score: number;
    coefficientOfVariation: number;
    trendType: TrendType;
    trendDescription: string;
    trendStrength: string;
  };
} {
  // Traditional calculation
  if (totals.length < 2) {
    return {
      traditional: { score: 100, coefficientOfVariation: 0 }
    };
  }
  
  const mean = totals.reduce((sum, val) => sum + val, 0) / totals.length;
  const variance = totals.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / totals.length;
  const standardDeviation = Math.sqrt(variance);
  const coefficientOfVariation = mean > 0 ? (standardDeviation / mean) * 100 : 0;
  const traditionalScore = Math.max(0, 100 - coefficientOfVariation);
  
  const traditional = {
    score: Math.round(traditionalScore),
    coefficientOfVariation: Math.round(coefficientOfVariation * 10) / 10
  };
  
  // Detrended calculation if we have date information
  if (competitionData && competitionData.length >= 2) {
    try {
      const trendAnalysis = analyzeTrend(competitionData);
      
      return {
        traditional,
        detrended: {
          score: trendAnalysis.detrended.consistencyScore,
          coefficientOfVariation: trendAnalysis.detrended.coefficientOfVariation,
          trendType: trendAnalysis.trend.type,
          trendDescription: trendAnalysis.trend.description,
          trendStrength: `${trendAnalysis.trend.strength} ${trendAnalysis.trend.direction}`
        }
      };
    } catch (error) {
      console.warn('Failed to calculate detrended consistency:', error);
      return { traditional };
    }
  }
  
  return { traditional };
}