#!/usr/bin/env node
/**
 * Dependency Bundler Script
 * Downloads and bundles Chart.js and MathJax for offline use
 * Run with: npx ts-node src/utils/bundler.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';

// Define vendor directory
const VENDOR_DIR = path.join(__dirname, '../../assets/vendor');
const PUBLIC_VENDOR_DIR = path.join(__dirname, '../../public/assets/vendor');

// CDN URLs for dependencies
const DEPENDENCIES = {
  'chart.min.js': 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js',
  'chartjs-plugin-datalabels.min.js': 'https://cdn.jsdelivr.net/npm/chartjs-plugin-datalabels@2.2.0/dist/chartjs-plugin-datalabels.min.js',
  'mathjax/tex-mml-chtml.js': 'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js'
};

// Additional MathJax files that might be needed
const MATHJAX_EXTRAS = [
  'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/input/tex/extensions/all-packages.js',
  'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/output/chtml/fonts/woff-v2/MathJax_Main-Regular.woff',
  'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/output/chtml/fonts/woff-v2/MathJax_Math-Italic.woff',
  'https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/output/chtml/fonts/woff-v2/MathJax_Size2-Regular.woff'
];

/**
 * Ensure directory exists
 */
function ensureDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
    console.log(`✅ Created directory: ${dirPath}`);
  }
}

/**
 * Download file from URL
 */
async function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`📥 Downloading: ${url}`);
    
    https.get(url, (response) => {
      if (response.statusCode === 302 || response.statusCode === 301) {
        // Handle redirect
        const redirectUrl = response.headers.location;
        if (redirectUrl) {
          downloadFile(redirectUrl, destPath).then(resolve).catch(reject);
          return;
        }
      }
      
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: ${response.statusCode}`));
        return;
      }

      const fileStream = createWriteStream(destPath);
      response.pipe(fileStream);

      fileStream.on('finish', () => {
        fileStream.close();
        console.log(`✅ Downloaded: ${path.basename(destPath)}`);
        resolve();
      });

      fileStream.on('error', (err) => {
        fs.unlinkSync(destPath);
        reject(err);
      });
    }).on('error', reject);
  });
}

/**
 * Create HTML test page
 */
function createTestPage(): void {
  const testHtml = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Vendor Dependencies Test</title>
    <script src="/assets/vendor/chart.min.js"></script>
    <script src="/assets/vendor/chartjs-plugin-datalabels.min.js"></script>
    <script src="/assets/vendor/mathjax/tex-mml-chtml.js"></script>
</head>
<body>
    <h1>Vendor Dependencies Test</h1>
    
    <h2>MathJax Test</h2>
    <p>Inline math: \\(x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\\)</p>
    <p>Display math: $$\\sum_{i=1}^{n} i = \\frac{n(n+1)}{2}$$</p>
    
    <h2>Chart.js Test</h2>
    <canvas id="testChart" width="400" height="200"></canvas>
    
    <script>
        // Test Chart.js
        if (typeof Chart !== 'undefined') {
            const ctx = document.getElementById('testChart').getContext('2d');
            new Chart(ctx, {
                type: 'bar',
                data: {
                    labels: ['A', 'B', 'C', 'D', 'E'],
                    datasets: [{
                        label: 'Test Data',
                        data: [12, 19, 3, 5, 2],
                        backgroundColor: 'rgba(75, 192, 192, 0.2)',
                        borderColor: 'rgba(75, 192, 192, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    scales: {
                        y: {
                            beginAtZero: true
                        }
                    }
                }
            });
            console.log('✅ Chart.js loaded successfully');
        } else {
            console.error('❌ Chart.js not loaded');
        }
        
        // Test MathJax
        if (typeof MathJax !== 'undefined') {
            console.log('✅ MathJax loaded successfully');
        } else {
            console.error('❌ MathJax not loaded');
        }
    </script>
</body>
</html>`;

  const testPath = path.join(__dirname, '../../test-vendor.html');
  fs.writeFileSync(testPath, testHtml);
  console.log(`✅ Created test page: test-vendor.html`);
}

/**
 * Update webpack config to copy vendor files
 */
function createWebpackCopyConfig(): void {
  const configAddition = `
// Add to webpack.config.js plugins array:
const CopyWebpackPlugin = require('copy-webpack-plugin');

plugins: [
  // ... other plugins
  new CopyWebpackPlugin({
    patterns: [
      {
        from: 'assets/vendor',
        to: 'assets/vendor'
      }
    ]
  })
]

// Remember to install: npm install --save-dev copy-webpack-plugin
`;

  const configPath = path.join(__dirname, '../../webpack.vendor.config.txt');
  fs.writeFileSync(configPath, configAddition);
  console.log(`✅ Created webpack config snippet: webpack.vendor.config.txt`);
}

/**
 * Main bundler function
 */
async function bundleDependencies(): Promise<void> {
  console.log('🚀 Starting dependency bundler...\n');

  // Create directories
  ensureDir(VENDOR_DIR);
  ensureDir(PUBLIC_VENDOR_DIR);
  ensureDir(path.join(VENDOR_DIR, 'mathjax'));
  ensureDir(path.join(PUBLIC_VENDOR_DIR, 'mathjax'));
  ensureDir(path.join(VENDOR_DIR, 'mathjax/output/chtml/fonts/woff-v2'));
  ensureDir(path.join(PUBLIC_VENDOR_DIR, 'mathjax/output/chtml/fonts/woff-v2'));

  // Download main dependencies
  for (const [filename, url] of Object.entries(DEPENDENCIES)) {
    const destPath = path.join(VENDOR_DIR, filename);
    const publicPath = path.join(PUBLIC_VENDOR_DIR, filename);
    
    try {
      await downloadFile(url, destPath);
      
      // Copy to public directory as well
      fs.copyFileSync(destPath, publicPath);
      console.log(`📋 Copied to public: ${filename}`);
    } catch (error) {
      console.error(`❌ Failed to download ${filename}:`, error);
    }
  }

  // Download MathJax extras (fonts)
  console.log('\n📥 Downloading MathJax fonts...');
  for (const url of MATHJAX_EXTRAS) {
    const filename = path.basename(url);
    const isFont = url.includes('fonts/woff-v2');
    const destDir = isFont 
      ? path.join(VENDOR_DIR, 'mathjax/output/chtml/fonts/woff-v2')
      : path.join(VENDOR_DIR, 'mathjax');
    const destPath = path.join(destDir, filename);
    
    try {
      await downloadFile(url, destPath);
      
      // Copy to public
      const publicDir = isFont
        ? path.join(PUBLIC_VENDOR_DIR, 'mathjax/output/chtml/fonts/woff-v2')
        : path.join(PUBLIC_VENDOR_DIR, 'mathjax');
      const publicPath = path.join(publicDir, filename);
      fs.copyFileSync(destPath, publicPath);
    } catch (error) {
      console.warn(`⚠️  Optional file ${filename} not downloaded:`, error);
    }
  }

  // Create test page
  createTestPage();

  // Create webpack config snippet
  createWebpackCopyConfig();

  console.log('\n✅ Dependency bundling complete!');
  console.log('\n📝 Next steps:');
  console.log('1. Update your build config to copy assets/vendor to dist/');
  console.log('2. Update script src paths in your HTML to use local files');
  console.log('3. Test with: open test-vendor.html in browser');
  console.log('4. For webpack, see webpack.vendor.config.txt');
}

// Run if executed directly
if (require.main === module) {
  bundleDependencies().catch(console.error);
}

export { bundleDependencies, downloadFile, ensureDir };