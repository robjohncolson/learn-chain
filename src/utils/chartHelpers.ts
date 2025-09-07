/**
 * Chart Helpers for Quiz Renderer
 * Provides Chart.js initialization and configuration utilities
 * Extracted from quiz_renderer.html chart rendering logic
 */

import type { ChartData, ChartConfig, Theme } from '../types';
import { themeManager } from './themeManager';

// Chart.js types (will be loaded dynamically)
declare const Chart: any;
declare const ChartDataLabels: any;

/**
 * Chart instance manager
 */
class ChartInstanceManager {
  private instances: Map<string, any> = new Map();
  
  /**
   * Register a chart instance
   */
  register(id: string, chart: any): void {
    // Destroy existing instance if present
    if (this.instances.has(id)) {
      this.destroy(id);
    }
    this.instances.set(id, chart);
  }
  
  /**
   * Get a chart instance
   */
  get(id: string): any {
    return this.instances.get(id);
  }
  
  /**
   * Destroy a chart instance
   */
  destroy(id: string): void {
    const chart = this.instances.get(id);
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
      this.instances.delete(id);
    }
  }
  
  /**
   * Destroy all chart instances
   */
  destroyAll(): void {
    this.instances.forEach((chart, id) => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.instances.clear();
  }
  
  /**
   * Re-render all charts (for theme changes)
   */
  rerenderAll(): void {
    // Store chart configs before destroying
    const configs: Array<{id: string, config: any}> = [];
    
    this.instances.forEach((chart, id) => {
      if (chart && chart.config) {
        configs.push({ id, config: chart.config });
      }
    });
    
    // Destroy all
    this.destroyAll();
    
    // Recreate with new theme
    configs.forEach(({ id, config }) => {
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Update colors for new theme
          updateChartColorsForTheme(config);
          const newChart = new (window as any).Chart(ctx, config);
          this.register(id, newChart);
        }
      }
    });
  }
}

export const chartManager = new ChartInstanceManager();

/**
 * Create bar or histogram chart
 */
export function createBarChart(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  canvasId: string
): any {
  const config = chartData.chartConfig || {};
  const colorPalette = themeManager.getChartColors(chartData.series?.length || 1);
  
  const datasets = (chartData.series || []).map((series, index) => {
    const color = colorPalette[index % colorPalette.length] || '#36A2EB';
    return {
      label: series.name,
      data: series.values,
      backgroundColor: color,
      borderColor: color,
      borderWidth: 1
    };
  });
  
  // Configure for histogram vs bar
  const isHistogram = chartData.chartType === 'histogram';
  const categoryPercentage = isHistogram ? 1.0 : 0.8;
  const barPercentage = isHistogram ? 1.0 : 0.9;
  
  // Handle orientation
  const orientation = config.orientation || 'vertical';
  const isHorizontal = orientation === 'horizontal';
  
  // Handle stacking
  const isStacked = config.stacked === true;
  
  // Grid configuration
  let showHorizontalGrid = true;
  let showVerticalGrid = false;
  
  if (config.gridLines !== undefined) {
    if (typeof config.gridLines === 'boolean') {
      showHorizontalGrid = config.gridLines;
      showVerticalGrid = false;
    } else if (typeof config.gridLines === 'object') {
      showHorizontalGrid = config.gridLines.horizontal !== false;
      showVerticalGrid = config.gridLines.vertical === true;
    }
  }
  
  const chartConfig = {
    type: 'bar',
    data: {
      labels: chartData.xLabels || [],
      datasets: datasets
    },
    options: {
      indexAxis: isHorizontal ? 'y' : 'x',
      responsive: true,
      maintainAspectRatio: false,
      categoryPercentage,
      barPercentage,
      scales: {
        x: {
          stacked: isStacked,
          title: {
            display: true,
            text: config.xAxis?.title || 'Category',
            color: themeManager.getTextColor()
          },
          grid: {
            display: isHorizontal ? showVerticalGrid : showVerticalGrid,
            color: themeManager.getGridColor()
          },
          ticks: {
            color: themeManager.getTextColor()
          }
        },
        y: {
          stacked: isStacked,
          beginAtZero: true,
          min: config.yAxis?.min,
          max: config.yAxis?.max,
          title: {
            display: true,
            text: config.yAxis?.title || 'Value',
            color: themeManager.getTextColor()
          },
          grid: {
            display: isHorizontal ? showHorizontalGrid : showHorizontalGrid,
            color: themeManager.getGridColor()
          },
          ticks: {
            stepSize: config.yAxis?.tickInterval,
            color: themeManager.getTextColor()
          }
        }
      },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: themeManager.getTextColor()
          }
        },
        datalabels: {
          display: config.showPointLabels === true,
          color: themeManager.getTextColor()
        }
      }
    }
  };
  
  const chart = new (window as any).Chart(ctx, chartConfig);
  chartManager.register(canvasId, chart);
  return chart;
}

/**
 * Create pie chart
 */
export function createPieChart(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  canvasId: string
): any {
  const config = chartData.chartConfig || {};
  const seriesData = chartData.series?.[0]?.values || [];
  
  const labels = seriesData.map((item: any) => item.name);
  const values = seriesData.map((item: any) => item.value);
  const colors = themeManager.getChartColors(values.length);
  
  const chartConfig = {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: values,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: themeManager.isDarkMode() ? '#2d2d2d' : '#fff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            padding: 20,
            usePointStyle: true,
            color: themeManager.getTextColor()
          }
        },
        datalabels: {
          display: config.showPointLabels === true,
          color: themeManager.getTextColor(),
          formatter: function(value: number, context: any) {
            const total = values.reduce((a: number, b: number) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return percentage + '%';
          }
        },
        tooltip: {
          callbacks: {
            label: function(context: any) {
              const total = values.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((context.parsed / total) * 100).toFixed(1);
              return `${context.label}: ${context.parsed} (${percentage}%)`;
            }
          }
        }
      }
    }
  };
  
  const chart = new (window as any).Chart(ctx, chartConfig);
  chartManager.register(canvasId, chart);
  return chart;
}

/**
 * Create scatter plot
 */
export function createScatterChart(
  ctx: CanvasRenderingContext2D,
  chartData: ChartData,
  canvasId: string
): any {
  const config = chartData.chartConfig || {};
  const datasets = [{
    label: 'Data Points',
    data: chartData.points || [],
    backgroundColor: themeManager.getScatterPointColor(),
    borderColor: themeManager.getScatterPointColor(),
    pointRadius: 4,
    pointHoverRadius: 6
  }];
  
  // Add regression line if requested
  if (config.regressionLine && chartData.points) {
    const regressionData = calculateRegressionLine(chartData.points);
    if (regressionData) {
      datasets.push({
        label: 'Regression Line',
        type: 'line' as any,
        data: regressionData,
        borderColor: config.regressionLineColor || themeManager.getTextColor(),
        borderDash: config.regressionLineDash || [],
        borderWidth: 2,
        fill: false,
        pointRadius: 0,
        tension: 0,
        order: 0
      } as any);
    }
  }
  
  // Add reference line at y=0 if requested
  if (config.referenceLineAtZero) {
    const xMin = config.xAxis?.min ?? Math.min(...(chartData.points || []).map((p: any) => p.x));
    const xMax = config.xAxis?.max ?? Math.max(...(chartData.points || []).map((p: any) => p.x));
    
    datasets.push({
      label: 'Reference Line y=0',
      type: 'line' as any,
      data: [{ x: xMin, y: 0 }, { x: xMax, y: 0 }],
      borderColor: '#CC0000',
      borderDash: [6, 4],
      borderWidth: 2,
      fill: false,
      pointRadius: 0,
      order: 0
    } as any);
  }
  
  const chartConfig = {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          position: 'bottom',
          min: config.xAxis?.min,
          max: config.xAxis?.max,
          title: {
            display: true,
            text: config.xAxis?.title || 'X Variable',
            color: themeManager.getTextColor()
          },
          grid: {
            display: typeof config.gridLines === 'object' ? config.gridLines.vertical !== false : true,
            color: themeManager.getGridColor()
          },
          ticks: {
            stepSize: config.xAxis?.tickInterval,
            color: themeManager.getTextColor()
          }
        },
        y: {
          min: config.yAxis?.min,
          max: config.yAxis?.max,
          title: {
            display: true,
            text: config.yAxis?.title || 'Y Variable',
            color: themeManager.getTextColor()
          },
          grid: {
            display: typeof config.gridLines === 'object' ? config.gridLines.horizontal !== false : true,
            color: themeManager.getGridColor()
          },
          ticks: {
            stepSize: config.yAxis?.tickInterval,
            color: themeManager.getTextColor()
          }
        }
      },
      plugins: {
        legend: {
          display: datasets.length > 1,
          labels: {
            color: themeManager.getTextColor()
          }
        },
        datalabels: {
          display: config.showPointLabels === true,
          align: 'top',
          anchor: 'center',
          color: themeManager.getTextColor(),
          formatter: (value: any) => {
            if (value.label !== undefined) return value.label;
            if (config.showPointLabels) {
              return `(${value.x}, ${value.y})`;
            }
            return '';
          }
        }
      }
    }
  };
  
  const chart = new (window as any).Chart(ctx, chartConfig);
  chartManager.register(canvasId, chart);
  return chart;
}

/**
 * Calculate regression line for scatter plot
 */
function calculateRegressionLine(points: Array<{x: number, y: number}>): Array<{x: number, y: number}> | null {
  if (!points || points.length < 2) return null;
  
  // Calculate least-squares regression
  let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
  const n = points.length;
  
  points.forEach(p => {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
  });
  
  const denominator = n * sumXX - sumX * sumX;
  if (denominator === 0) return null;
  
  const slope = (n * sumXY - sumX * sumY) / denominator;
  const intercept = (sumY - slope * sumX) / n;
  
  // Find x range
  const xs = points.map(p => p.x);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  
  return [
    { x: minX, y: slope * minX + intercept },
    { x: maxX, y: slope * maxX + intercept }
  ];
}

/**
 * Update chart colors for theme change
 */
function updateChartColorsForTheme(config: any): void {
  if (!config) return;
  
  // Update text colors
  const textColor = themeManager.getTextColor();
  const gridColor = themeManager.getGridColor();
  
  if (config.options?.scales) {
    for (const scale of Object.values(config.options.scales)) {
      const s = scale as any;
      if (s.title?.color) s.title.color = textColor;
      if (s.ticks?.color) s.ticks.color = textColor;
      if (s.grid?.color) s.grid.color = gridColor;
    }
  }
  
  if (config.options?.plugins?.legend?.labels) {
    config.options.plugins.legend.labels.color = textColor;
  }
  
  if (config.options?.plugins?.datalabels) {
    config.options.plugins.datalabels.color = textColor;
  }
  
  // Update dataset colors
  if (config.data?.datasets) {
    const newColors = themeManager.getChartColors(config.data.datasets.length);
    config.data.datasets.forEach((dataset: any, index: number) => {
      if (dataset.backgroundColor) {
        dataset.backgroundColor = newColors[index % newColors.length];
      }
      if (dataset.borderColor) {
        dataset.borderColor = newColors[index % newColors.length];
      }
    });
  }
}

/**
 * Load Chart.js library dynamically
 */
export async function loadChartJS(): Promise<void> {
  if (typeof window !== 'undefined' && (window as any).Chart) {
    return; // Already loaded
  }
  
  const script = document.createElement('script');
  script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
  
  return new Promise((resolve, reject) => {
    script.onload = () => {
      // Also load datalabels plugin
      const pluginScript = document.createElement('script');
      pluginScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2';
      pluginScript.onload = () => resolve();
      pluginScript.onerror = reject;
      document.head.appendChild(pluginScript);
    };
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

/**
 * Initialize a chart from ChartData
 */
export async function initializeChart(
  canvasId: string,
  chartData: ChartData
): Promise<void> {
  // Ensure Chart.js is loaded
  await loadChartJS();
  
  const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
  if (!canvas) return;
  
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  
  // Register datalabels plugin if available
  if ((window as any).ChartDataLabels) {
    (window as any).Chart.register((window as any).ChartDataLabels);
  }
  
  // Create chart based on type
  switch (chartData.chartType) {
    case 'bar':
    case 'histogram':
      createBarChart(ctx, chartData, canvasId);
      break;
      
    case 'pie':
      createPieChart(ctx, chartData, canvasId);
      break;
      
    case 'scatter':
      createScatterChart(ctx, chartData, canvasId);
      break;
      
    // Add other chart types as needed
    default:
      console.warn(`Chart type ${chartData.chartType} not yet implemented`);
  }
}

/**
 * Subscribe to theme changes and update charts
 */
themeManager.subscribe(() => {
  chartManager.rerenderAll();
});