/**
 * Charts Module with Lazy Loading and Consensus Dotplot
 * Provides Chart.js initialization with IntersectionObserver
 * Implements consensus visualization as scatter plot with jitter
 */

import type { ChartData, ConsensusData, ChartConfig } from '../types';
import { themeManager } from '../utils/themeManager';

declare const Chart: any;
declare const ChartDataLabels: any;

interface PendingChart {
  canvasId: string;
  chartData: ChartData;
  chartType: 'bar' | 'histogram' | 'pie' | 'scatter' | 'consensus';
  config?: any;
}

class ChartManager {
  private observer: IntersectionObserver | null = null;
  private pendingCharts: Map<string, PendingChart> = new Map();
  private activeCharts: Map<string, any> = new Map();
  private chartJsLoaded = false;
  private chartJsLoadPromise: Promise<void> | null = null;

  constructor() {
    this.initializeObserver();
  }

  /**
   * Initialize intersection observer for lazy loading
   */
  private initializeObserver(): void {
    if (typeof window === 'undefined' || !window.IntersectionObserver) return;

    this.observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const canvas = entry.target as HTMLCanvasElement;
            const pending = this.pendingCharts.get(canvas.id);
            
            if (pending) {
              this.initializeChart(pending);
              this.pendingCharts.delete(canvas.id);
              this.observer?.unobserve(canvas);
            }
          }
        });
      },
      {
        rootMargin: '100px',
        threshold: 0.01
      }
    );
  }

  /**
   * Load Chart.js dynamically
   */
  async loadChartJS(): Promise<void> {
    if (this.chartJsLoaded) return;
    if (this.chartJsLoadPromise) return this.chartJsLoadPromise;

    this.chartJsLoadPromise = new Promise((resolve, reject) => {
      if (typeof window !== 'undefined' && (window as any).Chart) {
        this.chartJsLoaded = true;
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = '/assets/vendor/chart.min.js';
      
      script.onload = () => {
        // Load datalabels plugin
        const pluginScript = document.createElement('script');
        pluginScript.src = '/assets/vendor/chartjs-plugin-datalabels.min.js';
        
        pluginScript.onload = () => {
          this.chartJsLoaded = true;
          if ((window as any).ChartDataLabels) {
            (window as any).Chart.register((window as any).ChartDataLabels);
          }
          resolve();
        };
        
        pluginScript.onerror = () => {
          // Try CDN fallback for plugin
          pluginScript.src = 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2';
          pluginScript.onload = () => {
            this.chartJsLoaded = true;
            if ((window as any).ChartDataLabels) {
              (window as any).Chart.register((window as any).ChartDataLabels);
            }
            resolve();
          };
          pluginScript.onerror = () => {
            console.warn('ChartDataLabels plugin not available');
            this.chartJsLoaded = true;
            resolve();
          };
        };
        
        document.head.appendChild(pluginScript);
      };

      script.onerror = () => {
        // Fallback to CDN
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js';
        script.onload = () => {
          this.chartJsLoaded = true;
          resolve();
        };
        script.onerror = () => reject(new Error('Failed to load Chart.js'));
      };

      document.head.appendChild(script);
    });

    return this.chartJsLoadPromise;
  }

  /**
   * Observe canvas for lazy loading
   */
  observeChart(canvasId: string, chartData: ChartData, chartType: string = 'auto'): void {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    // Determine chart type
    let type: PendingChart['chartType'] = 'bar';
    if (chartType === 'consensus') {
      type = 'consensus';
    } else if (chartData.chartType) {
      type = chartData.chartType as PendingChart['chartType'];
    }

    // Store pending chart
    this.pendingCharts.set(canvasId, {
      canvasId,
      chartData,
      chartType: type
    });

    // Check if already in viewport
    const rect = canvas.getBoundingClientRect();
    const inViewport = rect.top < window.innerHeight && rect.bottom > 0;

    if (inViewport) {
      this.initializeChart(this.pendingCharts.get(canvasId)!);
      this.pendingCharts.delete(canvasId);
    } else if (this.observer) {
      this.observer.observe(canvas);
    }
  }

  /**
   * Initialize a chart
   */
  private async initializeChart(pending: PendingChart): Promise<void> {
    await this.loadChartJS();

    const canvas = document.getElementById(pending.canvasId) as HTMLCanvasElement;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Destroy existing chart if any
    this.destroyChart(pending.canvasId);

    let chart: any;
    
    switch (pending.chartType) {
      case 'consensus':
        // Special handling for consensus dotplot
        chart = await this.createConsensusDotplot(ctx, pending.chartData, pending.canvasId);
        break;
      case 'bar':
      case 'histogram':
        chart = this.createBarChart(ctx, pending.chartData, pending.canvasId);
        break;
      case 'pie':
        chart = this.createPieChart(ctx, pending.chartData, pending.canvasId);
        break;
      case 'scatter':
        chart = this.createScatterChart(ctx, pending.chartData, pending.canvasId);
        break;
      default:
        console.warn(`Unknown chart type: ${pending.chartType}`);
        return;
    }

    if (chart) {
      this.activeCharts.set(pending.canvasId, chart);
    }
  }

  /**
   * Create consensus dotplot (scatter with jitter)
   */
  private async createConsensusDotplot(
    ctx: CanvasRenderingContext2D,
    data: any,
    canvasId: string
  ): Promise<any> {
    // Extract consensus data
    const consensusData = data as ConsensusData;
    const points: any[] = [];

    // Generate jittered points for each response
    if (consensusData.mcqDistribution) {
      // For MCQ, create points for each choice
      Object.entries(consensusData.mcqDistribution.distribution).forEach(([choice, count]) => {
        const choiceValue = choice.charCodeAt(0) - 65; // A=0, B=1, etc.
        for (let i = 0; i < (count as number); i++) {
          points.push({
            x: choiceValue,
            y: this.getJitteredY(),
            label: `Choice ${choice}`,
            backgroundColor: this.getChoiceColor(choice)
          });
        }
      });
    } else if (consensusData.frqDistribution) {
      // For FRQ, create points for each score
      consensusData.frqDistribution.scores.forEach((scoreData: any) => {
        for (let i = 0; i < scoreData.count; i++) {
          points.push({
            x: scoreData.score,
            y: this.getJitteredY(),
            label: `Score ${scoreData.score}`,
            backgroundColor: themeManager.getScatterPointColor()
          });
        }
      });
    }

    // Create scatter chart configuration
    const config = {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Individual Responses',
          data: points,
          backgroundColor: points.map(p => p.backgroundColor || themeManager.getScatterPointColor()),
          borderColor: themeManager.isDarkMode() ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
          borderWidth: 1,
          pointRadius: 6,
          pointHoverRadius: 8,
          pointStyle: 'circle'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          title: {
            display: true,
            text: 'Consensus Distribution (Individual Responses)',
            color: themeManager.getTextColor(),
            font: {
              size: 14,
              weight: 'bold'
            }
          },
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context: any) => {
                const point = context.raw;
                if (consensusData.mcqDistribution) {
                  const choice = String.fromCharCode(65 + Math.round(point.x));
                  return `Choice ${choice}`;
                } else {
                  return `Value: ${point.x.toFixed(2)}`;
                }
              }
            }
          },
          datalabels: {
            display: false // Too cluttered for dotplot
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: consensusData.mcqDistribution ? 'Answer Choice' : 'Response Value',
              color: themeManager.getTextColor()
            },
            grid: {
              display: true,
              color: themeManager.getGridColor()
            },
            ticks: {
              color: themeManager.getTextColor(),
              callback: function(value: any) {
                if (consensusData.mcqDistribution) {
                  return String.fromCharCode(65 + Math.round(value));
                }
                return value;
              }
            },
            min: consensusData.mcqDistribution ? -0.5 : undefined,
            max: consensusData.mcqDistribution ? 4.5 : undefined // Up to E
          },
          y: {
            type: 'linear',
            title: {
              display: false
            },
            grid: {
              display: false
            },
            ticks: {
              display: false
            },
            min: -0.5,
            max: 0.5
          }
        },
        animation: {
          duration: 800,
          easing: 'easeInOutQuart'
        }
      }
    };

    // Add reference line at y=0
    config.data.datasets.push({
      type: 'line',
      label: 'Baseline',
      data: [
        { x: config.options.scales.x.min ?? -1, y: 0 },
        { x: config.options.scales.x.max ?? 5, y: 0 }
      ],
      borderColor: themeManager.isDarkMode() ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      borderDash: [5, 5],
      borderWidth: 1,
      pointRadius: 0,
      fill: false,
      tension: 0
    } as any);

    return new (window as any).Chart(ctx, config);
  }

  /**
   * Get jittered Y position for dotplot
   */
  private getJitteredY(): number {
    // Random jitter between -0.3 and 0.3
    return (Math.random() - 0.5) * 0.6;
  }

  /**
   * Get color for choice
   */
  private getChoiceColor(choice: string): string {
    const colors = themeManager.getChartColors(5);
    const index = choice.charCodeAt(0) - 65;
    return colors[index % colors.length];
  }

  /**
   * Create bar chart
   */
  private createBarChart(
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    canvasId: string
  ): any {
    const config = chartData.chartConfig || {};
    const colorPalette = themeManager.getChartColors(chartData.series?.length || 1);

    const datasets = (chartData.series || []).map((series, index) => ({
      label: series.name,
      data: series.values,
      backgroundColor: colorPalette[index % colorPalette.length],
      borderColor: colorPalette[index % colorPalette.length],
      borderWidth: 1
    }));

    const chartConfig = {
      type: 'bar',
      data: {
        labels: chartData.xLabels || [],
        datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
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
        },
        scales: {
          x: {
            title: {
              display: true,
              text: config.xAxis?.title || 'Category',
              color: themeManager.getTextColor()
            },
            grid: {
              display: false
            },
            ticks: {
              color: themeManager.getTextColor()
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: config.yAxis?.title || 'Value',
              color: themeManager.getTextColor()
            },
            grid: {
              display: true,
              color: themeManager.getGridColor()
            },
            ticks: {
              color: themeManager.getTextColor()
            }
          }
        }
      }
    };

    return new (window as any).Chart(ctx, chartConfig);
  }

  /**
   * Create pie chart
   */
  private createPieChart(
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    canvasId: string
  ): any {
    const seriesData = chartData.series?.[0]?.values || [];
    const labels = seriesData.map((item: any) => item.name);
    const values = seriesData.map((item: any) => item.value);
    const colors = themeManager.getChartColors(values.length);

    const chartConfig = {
      type: 'pie',
      data: {
        labels,
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
            display: chartData.chartConfig?.showPointLabels === true,
            color: themeManager.getTextColor(),
            formatter: (value: number, context: any) => {
              const total = values.reduce((a: number, b: number) => a + b, 0);
              const percentage = ((value / total) * 100).toFixed(1);
              return percentage + '%';
            }
          }
        }
      }
    };

    return new (window as any).Chart(ctx, chartConfig);
  }

  /**
   * Create scatter chart
   */
  private createScatterChart(
    ctx: CanvasRenderingContext2D,
    chartData: ChartData,
    canvasId: string
  ): any {
    const config = chartData.chartConfig || {};
    
    const chartConfig = {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Data Points',
          data: chartData.points || [],
          backgroundColor: themeManager.getScatterPointColor(),
          borderColor: themeManager.getScatterPointColor(),
          pointRadius: 4,
          pointHoverRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          datalabels: {
            display: config.showPointLabels === true,
            align: 'top',
            color: themeManager.getTextColor()
          }
        },
        scales: {
          x: {
            type: 'linear',
            position: 'bottom',
            title: {
              display: true,
              text: config.xAxis?.title || 'X Variable',
              color: themeManager.getTextColor()
            },
            grid: {
              display: true,
              color: themeManager.getGridColor()
            },
            ticks: {
              color: themeManager.getTextColor()
            }
          },
          y: {
            title: {
              display: true,
              text: config.yAxis?.title || 'Y Variable',
              color: themeManager.getTextColor()
            },
            grid: {
              display: true,
              color: themeManager.getGridColor()
            },
            ticks: {
              color: themeManager.getTextColor()
            }
          }
        }
      }
    };

    return new (window as any).Chart(ctx, chartConfig);
  }

  /**
   * Render consensus display with dotplot
   */
  async renderConsensusDisplay(
    consensusData: ConsensusData,
    canvasId: string
  ): Promise<void> {
    // Create canvas if it doesn't exist
    let canvas = document.getElementById(canvasId) as HTMLCanvasElement;
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = canvasId;
      canvas.style.width = '100%';
      canvas.style.maxHeight = '300px';
    }

    // Use observeChart for lazy loading
    this.observeChart(canvasId, consensusData as any, 'consensus');
  }

  /**
   * Destroy a chart
   */
  destroyChart(canvasId: string): void {
    const chart = this.activeCharts.get(canvasId);
    if (chart && typeof chart.destroy === 'function') {
      chart.destroy();
      this.activeCharts.delete(canvasId);
    }
  }

  /**
   * Destroy all charts
   */
  destroyAll(): void {
    this.activeCharts.forEach((chart, id) => {
      if (chart && typeof chart.destroy === 'function') {
        chart.destroy();
      }
    });
    this.activeCharts.clear();
    this.pendingCharts.clear();
  }

  /**
   * Clean up observer
   */
  destroy(): void {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }
    this.destroyAll();
  }
}

// Create singleton instance
export const chartManager = new ChartManager();

// Export convenience functions
export function observeChart(canvasId: string, chartData: ChartData): void {
  chartManager.observeChart(canvasId, chartData);
}

export async function renderConsensusDotplot(
  consensusData: ConsensusData,
  canvasId: string
): Promise<void> {
  return chartManager.renderConsensusDisplay(consensusData, canvasId);
}

export function destroyChart(canvasId: string): void {
  chartManager.destroyChart(canvasId);
}

export function destroyAllCharts(): void {
  chartManager.destroyAll();
}

// Auto-load Chart.js on DOM ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      chartManager.loadChartJS().catch(console.warn);
    });
  } else {
    chartManager.loadChartJS().catch(console.warn);
  }
}