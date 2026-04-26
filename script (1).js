/* ============================================================
   CorrelX — Stock Correlation Dashboard
   script.js — Complete Application Logic
   ============================================================ */

'use strict';

// ══════════════════════════════════════════════
// CONSTANTS & CONFIG
// ══════════════════════════════════════════════

const COLORS = ['#00D4FF', '#FFB800', '#00E5A0', '#FF4B6E', '#A78BFA'];
const RANGE_DAYS = { '1M': 30, '6M': 180, '1Y': 365 };

const DEFAULT_STOCKS = ['AAPL', 'MSFT', 'GOOGL'];

// ══════════════════════════════════════════════
// APPLICATION STATE
// ══════════════════════════════════════════════

const state = {
  stocks: [...DEFAULT_STOCKS],
  timeRange: '1Y',
  apiKey: '',
  demoMode: false,
  normalize: false,
  scatterX: 0,
  scatterY: 1,
  priceData: {},      // { symbol: { date: price } }
  alignedPrices: {},  // { symbol: price[] }
  commonDates: [],
  correlationMatrix: [],
  regressionData: {},
  riskData: {},
  hasResults: false,
};

// ══════════════════════════════════════════════
// DOM ELEMENTS
// ══════════════════════════════════════════════

const $ = id => document.getElementById(id);

const DOM = {
  loadingOverlay:   $('loadingOverlay'),
  loadingText:      $('loadingText'),
  apiKeyInput:      $('apiKeyInput'),
  apiToggleBtn:     $('apiToggleBtn'),
  demoModeBtn:      $('demoModeBtn'),
  tagsContainer:    $('tagsContainer'),
  stockInput:       $('stockInput'),
  timeRangeCtrl:    $('timeRangeCtrl'),
  normalizeToggle:  $('normalizeToggle'),
  scatterX:         $('scatterX'),
  scatterY:         $('scatterY'),
  analyzeBtn:       $('analyzeBtn'),
  exportBtn:        $('exportBtn'),
  themeToggle:      $('themeToggle'),
  themeIcon:        $('themeIcon'),
  themeLabel:       $('themeLabel'),
  sidebarToggle:    $('sidebarToggle'),
  sidebar:          $('sidebar'),
  lastUpdated:      $('lastUpdated'),
  statusPill:       $('statusPill'),
  statusText:       $('statusText'),
  statusDot:        document.querySelector('.status-dot'),
  demoBadge:        $('demoBadge'),
  statStocks:       $('statStocks'),
  statPoints:       $('statPoints'),
  statAvgCorr:      $('statAvgCorr'),
  statDateRange:    $('statDateRange'),
  emptyState:       $('emptyState'),
  errorToast:       $('errorToast'),
  toastMsg:         $('toastMsg'),
  toastClose:       $('toastClose'),
  priceCard:        $('priceCard'),
  heatmapCard:      $('heatmapCard'),
  riskCard:         $('riskCard'),
  scatterCard:      $('scatterCard'),
  insightsCard:     $('insightsCard'),
  regressCard:      $('regressCard'),
  riskGrid:         $('riskGrid'),
  insightsList:     $('insightsList'),
  regressionTableBody: $('regressionTableBody'),
  scatterStats:     $('scatterStats'),
  showRegression:   $('showRegression'),
};

// ══════════════════════════════════════════════
// MATH UTILITIES
// ══════════════════════════════════════════════

function mean(arr) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function stdDev(arr) {
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

function pearsonCorrelation(x, y) {
  if (x.length !== y.length || x.length === 0) return 0;
  const mx = mean(x), my = mean(y);
  const sx = stdDev(x), sy = stdDev(y);
  if (sx === 0 || sy === 0) return 1; // identical series
  let num = 0;
  for (let i = 0; i < x.length; i++) num += (x[i] - mx) * (y[i] - my);
  return Math.max(-1, Math.min(1, num / (x.length * sx * sy)));
}

function linearRegression(y) {
  const n = y.length;
  const xs = Array.from({ length: n }, (_, i) => i);
  const mx = (n - 1) / 2;
  const my = mean(y);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - mx) * (y[i] - my);
    den += (xs[i] - mx) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = my - slope * mx;
  const predicted = xs.map(xi => slope * xi + intercept);
  const ssTot = y.reduce((s, yi) => s + (yi - my) ** 2, 0);
  const ssRes = y.reduce((s, yi, i) => s + (yi - predicted[i]) ** 2, 0);
  const rSquared = ssTot !== 0 ? Math.max(0, 1 - ssRes / ssTot) : 0;
  return { slope, intercept, predicted, rSquared };
}

function calculateReturns(prices) {
  const returns = [];
  for (let i = 1; i < prices.length; i++) {
    if (prices[i - 1] !== 0) returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
  }
  return returns;
}

function annualizedVolatility(prices) {
  const returns = calculateReturns(prices);
  if (returns.length === 0) return 0;
  return stdDev(returns) * Math.sqrt(252);
}

function normalizeToBase(prices, base = 100) {
  if (prices.length === 0 || prices[0] === 0) return prices;
  return prices.map(p => (p / prices[0]) * base);
}

// ══════════════════════════════════════════════
// RISK CLASSIFICATION
// ══════════════════════════════════════════════

function classifyRisk(vol) {
  if (vol < 0.15) return { label: 'LOW',    cls: 'risk-low',    icon: '▼', emoji: '🟢' };
  if (vol < 0.30) return { label: 'MEDIUM', cls: 'risk-medium', icon: '◆', emoji: '🟡' };
  return              { label: 'HIGH',   cls: 'risk-high',   icon: '▲', emoji: '🔴' };
}

// ══════════════════════════════════════════════
// API DATA FETCHING
// ══════════════════════════════════════════════

async function fetchStockData(symbol, apiKey) {
  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY_ADJUSTED&symbol=${symbol}&outputsize=full&apikey=${apiKey}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`HTTP ${resp.status} for ${symbol}`);
  const data = await resp.json();

  if (data['Note'] || data['Information']) {
    throw new Error('API rate limit reached. Please wait or use Demo Mode.');
  }

  const ts = data['Time Series (Daily)'] || data['Time Series (Daily Adjusted)'];
  if (!ts) {
    throw new Error(`No price data found for "${symbol}". Check the ticker symbol.`);
  }
  return ts;
}

function processTimeSeries(timeSeries, days) {
  const sorted = Object.keys(timeSeries).sort();
  const relevant = days ? sorted.slice(-days) : sorted;
  const result = {};
  relevant.forEach(date => {
    const entry = timeSeries[date];
    const close = parseFloat(entry['5. adjusted close'] || entry['4. close']);
    if (!isNaN(close)) result[date] = close;
  });
  return result;
}

async function fetchAllStocks() {
  const { stocks, timeRange, apiKey } = state;
  const days = RANGE_DAYS[timeRange] || 365;
  const rawData = {};

  for (let i = 0; i < stocks.length; i++) {
    const sym = stocks[i];
    setLoadingText(`Fetching ${sym} (${i + 1}/${stocks.length})…`);

    // Rate limiting: 5 req/min on free tier
    if (i > 0) await sleep(14000);

    const ts = await fetchStockData(sym, apiKey);
    rawData[sym] = processTimeSeries(ts, days * 1.5); // overfetch, then trim
  }

  return rawData;
}

// ══════════════════════════════════════════════
// DEMO DATA GENERATOR
// ══════════════════════════════════════════════

function generateDemoData(symbols, days) {
  const businessDays = [];
  const today = new Date();
  let count = 0;
  for (let offset = 0; businessDays.length < days && count < days * 2; offset++, count++) {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    if (d.getDay() !== 0 && d.getDay() !== 6) {
      businessDays.unshift(d.toISOString().split('T')[0]);
    }
  }

  // Generate correlated market factor
  const marketReturns = Array.from({ length: businessDays.length }, () =>
    (Math.random() - 0.487) * 0.018 + (Math.random() - 0.5) * 0.008
  );

  // Stock params [beta, idioVol, startPrice]
  const params = [
    [1.05, 0.008, 185],
    [0.92, 0.007, 415],
    [1.12, 0.009, 148],
    [1.35, 0.013, 82],
    [0.75, 0.006, 340],
  ];

  const priceData = {};
  symbols.forEach((sym, idx) => {
    const [beta, idio, startPrice] = params[idx % params.length];
    let price = startPrice;
    const prices = {};
    businessDays.forEach((date, i) => {
      const mktRet = marketReturns[i];
      const idioRet = (Math.random() - 0.5) * idio * 2;
      const totalRet = beta * mktRet + idioRet;
      price *= (1 + totalRet);
      price = Math.max(price, 1); // floor
      prices[date] = parseFloat(price.toFixed(2));
    });
    priceData[sym] = prices;
  });

  return priceData;
}

// ══════════════════════════════════════════════
// CORRELATION MATRIX
// ══════════════════════════════════════════════

function buildCorrelationMatrix(alignedPrices, stocks) {
  const n = stocks.length;
  const matrix = [];

  for (let i = 0; i < n; i++) {
    const row = [];
    const ri = calculateReturns(alignedPrices[stocks[i]]);
    for (let j = 0; j < n; j++) {
      if (i === j) { row.push(1.0); continue; }
      const rj = calculateReturns(alignedPrices[stocks[j]]);
      row.push(parseFloat(pearsonCorrelation(ri, rj).toFixed(4)));
    }
    matrix.push(row);
  }
  return matrix;
}

// ══════════════════════════════════════════════
// INSIGHT GENERATION
// ══════════════════════════════════════════════

function generateInsights(stocks, correlMatrix, regrData, riskData) {
  const insights = [];

  // Pairwise correlation insights
  for (let i = 0; i < stocks.length; i++) {
    for (let j = i + 1; j < stocks.length; j++) {
      const r = correlMatrix[i][j];
      const abs = Math.abs(r);
      const sign = r > 0 ? 'positive' : 'negative';
      const a = stocks[i], b = stocks[j];

      if (abs >= 0.85) {
        insights.push({
          type: r > 0 ? 'positive' : 'negative',
          emoji: r > 0 ? '🔗' : '↔️',
          text: `<strong>${a} & ${b}</strong> have a very strong ${sign} correlation (r = ${r.toFixed(3)}). They tend to move almost in lockstep — holding both offers <strong>minimal diversification benefit</strong>.`,
        });
      } else if (abs >= 0.6) {
        insights.push({
          type: 'neutral',
          emoji: '📊',
          text: `<strong>${a} & ${b}</strong> show moderate ${sign} correlation (r = ${r.toFixed(3)}). Some co-movement exists, suggesting exposure to <strong>shared market or sector factors</strong>.`,
        });
      } else if (abs >= 0.35) {
        insights.push({
          type: 'info',
          emoji: '🔀',
          text: `<strong>${a} & ${b}</strong> display weak correlation (r = ${r.toFixed(3)}). This pairing offers <strong>moderate diversification</strong> within a portfolio.`,
        });
      } else {
        insights.push({
          type: 'positive',
          emoji: '✅',
          text: `<strong>${a} & ${b}</strong> are nearly uncorrelated (r = ${r.toFixed(3)}). This is an <strong>excellent diversification pair</strong> — their returns move largely independently.`,
        });
      }
    }
  }

  // Regression / trend insights
  stocks.forEach(sym => {
    const { slope, rSquared } = regrData[sym];
    const prices = state.alignedPrices[sym];
    const lastPrice = prices[prices.length - 1];
    const slopePct = ((slope / lastPrice) * 252 * 100).toFixed(1);

    if (slope > 0 && rSquared > 0.6) {
      insights.push({
        type: 'positive',
        emoji: '📈',
        text: `<strong>${sym}</strong> shows a strong upward trend with R² = ${rSquared.toFixed(3)}. The regression implies an annualized drift of <strong>+${slopePct}%</strong>, indicating consistent growth over this period.`,
      });
    } else if (slope < 0 && rSquared > 0.5) {
      insights.push({
        type: 'negative',
        emoji: '📉',
        text: `<strong>${sym}</strong> is in a declining trend (R² = ${rSquared.toFixed(3)}). The regression implies an annualized drift of <strong>${slopePct}%</strong>. Consider monitoring for a reversal signal.`,
      });
    } else {
      insights.push({
        type: 'neutral',
        emoji: '〰️',
        text: `<strong>${sym}</strong> shows a weak or sideways trend (R² = ${rSquared.toFixed(3)}). Price movement appears more <strong>mean-reverting or cyclical</strong> than directional over this period.`,
      });
    }
  });

  // Risk insights
  const highRisk = stocks.filter(s => riskData[s] && riskData[s].label === 'HIGH');
  const lowRisk  = stocks.filter(s => riskData[s] && riskData[s].label === 'LOW');

  if (highRisk.length > 0) {
    insights.push({
      type: 'negative',
      emoji: '⚠️',
      text: `<strong>${highRisk.join(', ')}</strong> ${highRisk.length > 1 ? 'carry' : 'carries'} high annualized volatility (>30%). These stocks may experience <strong>significant price swings</strong> — suitable for higher risk tolerance.`,
    });
  }

  if (lowRisk.length > 0) {
    insights.push({
      type: 'positive',
      emoji: '🛡️',
      text: `<strong>${lowRisk.join(', ')}</strong> ${lowRisk.length > 1 ? 'exhibit' : 'exhibits'} low volatility (<15%), suggesting <strong>relative price stability</strong> and potentially lower portfolio risk.`,
    });
  }

  // Average correlation portfolio insight
  let corrSum = 0, corrCount = 0;
  for (let i = 0; i < stocks.length; i++) {
    for (let j = i + 1; j < stocks.length; j++) {
      corrSum += correlMatrix[i][j];
      corrCount++;
    }
  }

  if (corrCount > 0) {
    const avgCorr = corrSum / corrCount;
    if (avgCorr > 0.7) {
      insights.push({
        type: 'neutral',
        emoji: '🗂️',
        text: `The average pairwise correlation of <strong>${avgCorr.toFixed(3)}</strong> is high. This portfolio is <strong>highly concentrated</strong> — adding less-correlated assets would improve diversification.`,
      });
    } else if (avgCorr < 0.3) {
      insights.push({
        type: 'positive',
        emoji: '🎯',
        text: `The average pairwise correlation of <strong>${avgCorr.toFixed(3)}</strong> is low — this portfolio is <strong>well-diversified</strong>, which may reduce overall portfolio variance.`,
      });
    }
  }

  return insights;
}

// ══════════════════════════════════════════════
// CHART RENDERING
// ══════════════════════════════════════════════

function getPlotlyBase() {
  const isDark = document.documentElement.dataset.theme !== 'light';
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor:  'transparent',
    font: {
      family: 'DM Mono, monospace',
      color:  isDark ? '#7FA3C4' : '#3B5A78',
      size:   11,
    },
    margin: { t: 20, r: 20, b: 50, l: 60, pad: 0 },
  };
}

function getAxisStyle(title = '') {
  const isDark = document.documentElement.dataset.theme !== 'light';
  return {
    title,
    color:       isDark ? '#7FA3C4' : '#3B5A78',
    gridcolor:   isDark ? 'rgba(0,212,255,0.07)' : 'rgba(0,100,180,0.07)',
    zerolinecolor: isDark ? 'rgba(0,212,255,0.15)' : 'rgba(0,100,180,0.15)',
    tickfont: { family: 'DM Mono, monospace', size: 10 },
  };
}

// ── Price Chart ──
function renderPriceChart() {
  const { alignedPrices, commonDates, stocks, regressionData } = state;
  const showReg = DOM.showRegression.checked;
  const useNorm = state.normalize;
  const traces = [];

  stocks.forEach((sym, idx) => {
    let prices = alignedPrices[sym];
    if (useNorm) prices = normalizeToBase(prices);

    traces.push({
      type: 'scatter',
      mode: 'lines',
      name: sym,
      x: commonDates,
      y: prices,
      line: { color: COLORS[idx % COLORS.length], width: 2 },
      hovertemplate: `<b>${sym}</b><br>Date: %{x}<br>Price: $%{y:.2f}<extra></extra>`,
    });

    if (showReg) {
      let predicted = regressionData[sym].predicted;
      if (useNorm) {
        const raw = alignedPrices[sym];
        predicted = predicted.map(p => (p / raw[0]) * 100);
      }
      traces.push({
        type: 'scatter',
        mode: 'lines',
        name: `${sym} Trend`,
        x: commonDates,
        y: predicted,
        line: { color: COLORS[idx % COLORS.length], width: 1.5, dash: 'dot' },
        opacity: 0.55,
        showlegend: false,
        hoverinfo: 'skip',
      });
    }
  });

  const layout = {
    ...getPlotlyBase(),
    margin: { t: 20, r: 20, b: 50, l: 65, pad: 0 },
    xaxis: { ...getAxisStyle(), type: 'date', tickformat: '%b %y' },
    yaxis: { ...getAxisStyle(useNorm ? 'Normalized (base 100)' : 'Price (USD)') },
    legend: {
      bgcolor:     'transparent',
      bordercolor: 'rgba(0,212,255,0.15)',
      borderwidth: 1,
      font:        { family: 'DM Mono', size: 11 },
      x: 0, y: 1,
    },
    hovermode: 'x unified',
  };

  Plotly.react('priceChart', traces, layout, { responsive: true, displayModeBar: false });
}

// ── Correlation Heatmap ──
function renderHeatmap() {
  const { correlationMatrix, stocks } = state;
  const isDark = document.documentElement.dataset.theme !== 'light';

  const z    = correlationMatrix;
  const text = correlationMatrix.map(row => row.map(v => v.toFixed(3)));

  const colorscale = isDark
    ? [[0, '#FF4B6E'], [0.25, '#5B1A28'], [0.5, '#0E1C2C'], [0.75, '#0A3550'], [1, '#00D4FF']]
    : [[0, '#D63055'], [0.25, '#F5B8C5'], [0.5, '#EFF3F8'], [0.75, '#B0D4EF'], [1, '#0090CC']];

  const trace = {
    type: 'heatmap',
    z, x: stocks, y: stocks,
    text, texttemplate: '%{text}',
    textfont: { family: 'DM Mono', size: 12, color: isDark ? '#E4EEF8' : '#0D1F30' },
    colorscale,
    zmin: -1, zmax: 1,
    showscale: false,
    hovertemplate: '<b>%{y} × %{x}</b><br>r = %{z:.4f}<extra></extra>',
    xgap: 3, ygap: 3,
  };

  const layout = {
    ...getPlotlyBase(),
    margin: { t: 10, r: 10, b: 60, l: 70, pad: 0 },
    xaxis: {
      ...getAxisStyle(),
      tickfont: { family: 'DM Mono', size: 11, color: isDark ? '#E4EEF8' : '#0D1F30' },
      side: 'bottom',
    },
    yaxis: {
      ...getAxisStyle(),
      tickfont: { family: 'DM Mono', size: 11, color: isDark ? '#E4EEF8' : '#0D1F30' },
      autorange: 'reversed',
    },
  };

  Plotly.react('heatmapChart', [trace], layout, { responsive: true, displayModeBar: false });
}

// ── Scatter Plot ──
function renderScatterPlot() {
  const { alignedPrices, stocks } = state;
  const xi = state.scatterX;
  const yi = state.scatterY;

  if (xi === yi || !stocks[xi] || !stocks[yi]) return;

  const symX = stocks[xi], symY = stocks[yi];
  const xPrices = alignedPrices[symX];
  const yPrices = alignedPrices[symY];
  const isDark  = document.documentElement.dataset.theme !== 'light';

  // Regression on scatter
  const { slope, intercept, rSquared } = linearRegression(yPrices.map((y, i) => {
    const mx = mean(xPrices);
    const sx = stdDev(xPrices);
    // Regression of Y on X
    return y;
  }));

  // Proper linear regression of Y on X
  const n = xPrices.length;
  const mx = mean(xPrices), my = mean(yPrices);
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (xPrices[i] - mx) * (yPrices[i] - my);
    den += (xPrices[i] - mx) ** 2;
  }
  const sl = den !== 0 ? num / den : 0;
  const ic = my - sl * mx;

  const xSorted = [...xPrices].sort((a, b) => a - b);
  const xMin = xSorted[0], xMax = xSorted[xSorted.length - 1];

  const corrVal = pearsonCorrelation(xPrices, yPrices);
  const r2 = corrVal ** 2;

  const traces = [
    {
      type: 'scatter',
      mode: 'markers',
      name: 'Observations',
      x: xPrices,
      y: yPrices,
      marker: {
        color: COLORS[0],
        size: 5,
        opacity: 0.6,
      },
      hovertemplate: `${symX}: $%{x:.2f}<br>${symY}: $%{y:.2f}<extra></extra>`,
    },
    {
      type: 'scatter',
      mode: 'lines',
      name: 'Regression Line',
      x: [xMin, xMax],
      y: [sl * xMin + ic, sl * xMax + ic],
      line: { color: COLORS[1], width: 2, dash: 'dash' },
      hoverinfo: 'skip',
    },
  ];

  const layout = {
    ...getPlotlyBase(),
    margin: { t: 10, r: 20, b: 60, l: 65, pad: 0 },
    xaxis: { ...getAxisStyle(`${symX} Price (USD)`) },
    yaxis: { ...getAxisStyle(`${symY} Price (USD)`) },
    legend: {
      bgcolor: 'transparent',
      bordercolor: 'rgba(0,212,255,0.15)',
      borderwidth: 1,
      font: { family: 'DM Mono', size: 10 },
    },
    hovermode: 'closest',
  };

  Plotly.react('scatterChart', traces, layout, { responsive: true, displayModeBar: false });

  // Update scatter stats
  DOM.scatterStats.innerHTML = `
    <div class="scatter-stat">
      <div class="scatter-stat-label">Pearson r</div>
      <div class="scatter-stat-value" style="color:${corrVal > 0 ? 'var(--accent-green)' : 'var(--accent-red)'}">${corrVal.toFixed(4)}</div>
    </div>
    <div class="scatter-stat">
      <div class="scatter-stat-label">R² (fit)</div>
      <div class="scatter-stat-value">${r2.toFixed(4)}</div>
    </div>
    <div class="scatter-stat">
      <div class="scatter-stat-label">Slope</div>
      <div class="scatter-stat-value">${sl.toFixed(4)}</div>
    </div>
    <div class="scatter-stat">
      <div class="scatter-stat-label">Intercept</div>
      <div class="scatter-stat-value">${ic.toFixed(2)}</div>
    </div>
  `;
}

// ── Risk Cards ──
function renderRiskCards() {
  const { stocks, riskData } = state;
  DOM.riskGrid.innerHTML = stocks.map((sym, i) => {
    const r = riskData[sym];
    if (!r) return '';
    return `
      <div class="risk-item" style="animation-delay:${i * 0.07}s">
        <div class="risk-item-left">
          <div>
            <div class="risk-symbol">${sym}</div>
            <div class="risk-vol">σ = ${(r.vol * 100).toFixed(1)}% ann.</div>
          </div>
        </div>
        <span class="risk-badge ${r.cls}">${r.icon} ${r.label}</span>
      </div>
    `;
  }).join('');
}

// ── Regression Table ──
function renderRegressionTable() {
  const { stocks, regressionData, riskData, alignedPrices } = state;

  DOM.regressionTableBody.innerHTML = stocks.map((sym, idx) => {
    const reg = regressionData[sym];
    const risk = riskData[sym];
    const prices = alignedPrices[sym];
    const lastPrice = prices[prices.length - 1];

    const slopePerDay = reg.slope;
    const slopeUp = slopePerDay >= 0;
    const proj30 = lastPrice + slopePerDay * 30;

    const r2pct = (reg.rSquared * 100).toFixed(1);

    return `
      <tr style="animation-delay:${idx * 0.08}s">
        <td class="td-symbol">
          <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${COLORS[idx % COLORS.length]};margin-right:8px;"></span>
          ${sym}
        </td>
        <td class="${slopeUp ? 'td-slope-up' : 'td-slope-down'}">
          ${slopeUp ? '+' : ''}${slopePerDay.toFixed(4)}
        </td>
        <td>
          <div class="td-r2">
            <span>${reg.rSquared.toFixed(3)}</span>
            <div class="r2-bar-bg"><div class="r2-bar" style="width:${r2pct}%"></div></div>
          </div>
        </td>
        <td>
          <span class="td-trend ${slopeUp ? 'up' : 'down'}">
            ${slopeUp ? '▲ Bullish' : '▼ Bearish'}
          </span>
        </td>
        <td>$${proj30.toFixed(2)} <span style="font-size:0.7rem;color:var(--text-muted)">(+30d)</span></td>
        <td>${risk ? (risk.vol * 100).toFixed(1) + '%' : '—'}</td>
        <td><span class="risk-badge ${risk ? risk.cls : ''}">${risk ? risk.icon + ' ' + risk.label : '—'}</span></td>
      </tr>
    `;
  }).join('');
}

// ── Insights Panel ──
function renderInsights(insights) {
  DOM.insightsList.innerHTML = insights.map((ins, i) => `
    <div class="insight-item ${ins.type}" style="animation-delay:${i * 0.06}s">
      <span class="insight-emoji">${ins.emoji}</span>
      <p class="insight-text">${ins.text}</p>
    </div>
  `).join('');
}

// ── Update Stats Bar ──
function updateStatsBar() {
  const { stocks, commonDates, correlationMatrix } = state;

  DOM.statStocks.textContent    = stocks.length;
  DOM.statPoints.textContent    = commonDates.length.toLocaleString();

  let corrSum = 0, corrCount = 0;
  for (let i = 0; i < stocks.length; i++) {
    for (let j = i + 1; j < stocks.length; j++) {
      corrSum += correlationMatrix[i][j];
      corrCount++;
    }
  }

  DOM.statAvgCorr.textContent = corrCount > 0
    ? (corrSum / corrCount).toFixed(3)
    : '—';

  if (commonDates.length > 1) {
    const first = commonDates[0];
    const last  = commonDates[commonDates.length - 1];
    DOM.statDateRange.textContent = `${first} → ${last}`;
  }

  DOM.lastUpdated.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// ── Populate Scatter Selects ──
function populateScatterSelects() {
  const { stocks } = state;
  [DOM.scatterX, DOM.scatterY].forEach((sel, si) => {
    const val = sel.value;
    sel.innerHTML = stocks.map((s, i) => `<option value="${i}">${s}</option>`).join('');
    sel.value = si === 0 ? '0' : (stocks.length > 1 ? '1' : '0');
  });
  state.scatterX = parseInt(DOM.scatterX.value);
  state.scatterY = parseInt(DOM.scatterY.value);
}

// ══════════════════════════════════════════════
// MAIN ANALYZE FLOW
// ══════════════════════════════════════════════

async function analyze() {
  if (state.stocks.length < 2) {
    showToast('Please add at least 2 stock symbols.');
    return;
  }

  showLoading(true);
  setStatus('loading', 'Fetching…');

  try {
    let rawData;

    if (state.demoMode || !state.apiKey.trim()) {
      setLoadingText('Generating demo market data…');
      await sleep(800);
      const days = RANGE_DAYS[state.timeRange] || 365;
      rawData = generateDemoData(state.stocks, days);
    } else {
      rawData = await fetchAllStocks();
    }

    setLoadingText('Aligning date series…');
    await sleep(200);

    state.priceData = rawData;

    // Find common dates across all stocks
    const dateSets = state.stocks.map(s => new Set(Object.keys(rawData[s] || {})));
    const firstSet = dateSets[0];
    const commonDates = Array.from(firstSet)
      .filter(d => dateSets.every(set => set.has(d)))
      .sort();

    if (commonDates.length < 5) {
      throw new Error('Insufficient overlapping data. Try different stocks or time range.');
    }

    state.commonDates = commonDates;

    // Build aligned price arrays
    const aligned = {};
    state.stocks.forEach(sym => {
      aligned[sym] = commonDates.map(d => rawData[sym][d]);
    });
    state.alignedPrices = aligned;

    setLoadingText('Computing correlations…');
    await sleep(100);
    state.correlationMatrix = buildCorrelationMatrix(aligned, state.stocks);

    setLoadingText('Running regressions…');
    await sleep(100);
    const regrData = {};
    const riskData = {};
    state.stocks.forEach(sym => {
      const prices = aligned[sym];
      regrData[sym] = linearRegression(prices);
      const vol = annualizedVolatility(prices);
      riskData[sym] = { vol, ...classifyRisk(vol) };
    });
    state.regressionData = regrData;
    state.riskData = riskData;

    setLoadingText('Generating insights…');
    await sleep(100);
    const insights = generateInsights(state.stocks, state.correlationMatrix, regrData, riskData);

    // Render all charts
    setLoadingText('Rendering charts…');
    await sleep(100);

    populateScatterSelects();
    showAllCards();

    await sleep(50);

    renderPriceChart();
    renderHeatmap();
    renderRiskCards();
    renderScatterPlot();
    renderRegressionTable();
    renderInsights(insights);
    updateStatsBar();

    state.hasResults = true;
    DOM.exportBtn.disabled = false;

    setStatus('live', state.demoMode ? 'Demo Mode' : 'Live Data');

  } catch (err) {
    console.error(err);
    showToast(err.message || 'An unexpected error occurred.');
    setStatus('error', 'Error');
  } finally {
    showLoading(false);
  }
}

// ══════════════════════════════════════════════
// UI HELPERS
// ══════════════════════════════════════════════

function showLoading(show) {
  DOM.loadingOverlay.classList.toggle('hidden', !show);
}

function setLoadingText(text) {
  DOM.loadingText.textContent = text;
}

function setStatus(type, label) {
  DOM.statusText.textContent = label;
  DOM.statusDot.className = 'status-dot' + (type !== 'ready' ? ` ${type}` : '');
}

function showToast(msg) {
  DOM.toastMsg.textContent = msg;
  DOM.errorToast.classList.remove('hidden');
  setTimeout(() => DOM.errorToast.classList.add('hidden'), 6000);
}

function showAllCards() {
  DOM.emptyState.classList.add('hidden');
  const cards = [
    DOM.priceCard, DOM.heatmapCard, DOM.riskCard,
    DOM.scatterCard, DOM.insightsCard, DOM.regressCard,
  ];
  cards.forEach((c, i) => {
    c.classList.remove('hidden');
    c.style.animationDelay = `${i * 0.05}s`;
  });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ══════════════════════════════════════════════
// TAG INPUT — STOCK SELECTION
// ══════════════════════════════════════════════

function addStock(sym) {
  sym = sym.trim().toUpperCase().replace(/[^A-Z0-9.]/g, '');
  if (!sym || state.stocks.includes(sym)) return;
  if (state.stocks.length >= 5) { showToast('Maximum 5 stocks allowed.'); return; }
  state.stocks.push(sym);
  renderTags();
  saveToStorage();
}

function removeStock(sym) {
  state.stocks = state.stocks.filter(s => s !== sym);
  renderTags();
  saveToStorage();
}

function renderTags() {
  DOM.tagsContainer.innerHTML = state.stocks.map(sym => `
    <span class="tag">
      ${sym}
      <button class="tag-remove" data-sym="${sym}" aria-label="Remove ${sym}">✕</button>
    </span>
  `).join('');

  DOM.tagsContainer.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => removeStock(btn.dataset.sym));
  });
}

// ══════════════════════════════════════════════
// THEME
// ══════════════════════════════════════════════

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const isDark = theme === 'dark';
  DOM.themeIcon.textContent  = isDark ? '🌙' : '☀️';
  DOM.themeLabel.textContent = isDark ? 'Dark Mode' : 'Light Mode';
  localStorage.setItem('cx-theme', theme);

  // Re-render charts if results exist
  if (state.hasResults) {
    setTimeout(() => {
      renderPriceChart();
      renderHeatmap();
      renderScatterPlot();
    }, 50);
  }
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme;
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ══════════════════════════════════════════════
// CSV EXPORT
// ══════════════════════════════════════════════

function exportCSV() {
  if (!state.hasResults) return;
  const { stocks, commonDates, alignedPrices, correlationMatrix } = state;

  // Price data
  let csv = 'Date,' + stocks.join(',') + '\n';
  commonDates.forEach((date, i) => {
    const row = [date, ...stocks.map(s => alignedPrices[s][i].toFixed(4))];
    csv += row.join(',') + '\n';
  });

  csv += '\nCorrelation Matrix\n';
  csv += ',' + stocks.join(',') + '\n';
  correlationMatrix.forEach((row, i) => {
    csv += stocks[i] + ',' + row.map(v => v.toFixed(4)).join(',') + '\n';
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `correlx_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ══════════════════════════════════════════════
// LOCAL STORAGE
// ══════════════════════════════════════════════

function saveToStorage() {
  try {
    localStorage.setItem('cx-stocks', JSON.stringify(state.stocks));
    localStorage.setItem('cx-range',  state.timeRange);
  } catch (_) {}
}

function loadFromStorage() {
  try {
    const stocks = JSON.parse(localStorage.getItem('cx-stocks'));
    if (Array.isArray(stocks) && stocks.length >= 2) state.stocks = stocks;
    const range = localStorage.getItem('cx-range');
    if (range && RANGE_DAYS[range]) state.timeRange = range;
    const theme = localStorage.getItem('cx-theme') || 'dark';
    applyTheme(theme);
  } catch (_) {}
}

// ══════════════════════════════════════════════
// EVENT LISTENERS
// ══════════════════════════════════════════════

function bindEvents() {
  // Analyze
  DOM.analyzeBtn.addEventListener('click', analyze);

  // Export
  DOM.exportBtn.addEventListener('click', exportCSV);

  // Theme toggle
  DOM.themeToggle.addEventListener('click', toggleTheme);

  // Sidebar toggle (mobile)
  DOM.sidebarToggle.addEventListener('click', () => {
    DOM.sidebar.classList.toggle('open');
  });

  // Close sidebar on main click (mobile)
  document.querySelector('.main-content').addEventListener('click', () => {
    if (window.innerWidth <= 840) DOM.sidebar.classList.remove('open');
  });

  // API key toggle visibility
  DOM.apiToggleBtn.addEventListener('click', () => {
    const input = DOM.apiKeyInput;
    input.type = input.type === 'password' ? 'text' : 'password';
    DOM.apiToggleBtn.textContent = input.type === 'password' ? '👁' : '🙈';
  });

  // API key save
  DOM.apiKeyInput.addEventListener('input', () => {
    state.apiKey = DOM.apiKeyInput.value;
    state.demoMode = false;
    DOM.demoBadge.classList.add('hidden');
  });

  // Load saved API key if present
  const savedKey = localStorage.getItem('cx-api-key');
  if (savedKey) {
    DOM.apiKeyInput.value = savedKey;
    state.apiKey = savedKey;
  }

  DOM.apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('cx-api-key', state.apiKey);
  });

  // Demo mode
  DOM.demoModeBtn.addEventListener('click', () => {
    state.demoMode = true;
    DOM.demoBadge.classList.remove('hidden');
    showToast('Demo Mode active — using simulated market data.');
  });

  // Stock input — Enter to add
  DOM.stockInput.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addStock(DOM.stockInput.value);
      DOM.stockInput.value = '';
    }
    if (e.key === 'Backspace' && !DOM.stockInput.value && state.stocks.length > 0) {
      removeStock(state.stocks[state.stocks.length - 1]);
    }
  });

  DOM.stockInput.addEventListener('blur', () => {
    if (DOM.stockInput.value.trim()) {
      addStock(DOM.stockInput.value);
      DOM.stockInput.value = '';
    }
  });

  // Tag input wrap click focuses input
  document.getElementById('tagInputWrap').addEventListener('click', () => {
    DOM.stockInput.focus();
  });

  // Quick add buttons
  document.querySelectorAll('.quick-tag').forEach(btn => {
    btn.addEventListener('click', () => addStock(btn.dataset.sym));
  });

  // Time range
  DOM.timeRangeCtrl.addEventListener('click', e => {
    const btn = e.target.closest('.seg-btn');
    if (!btn) return;
    document.querySelectorAll('.seg-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.timeRange = btn.dataset.range;
    saveToStorage();
  });

  // Normalize toggle
  DOM.normalizeToggle.addEventListener('change', () => {
    state.normalize = DOM.normalizeToggle.checked;
    if (state.hasResults) renderPriceChart();
  });

  // Scatter pair selectors
  DOM.scatterX.addEventListener('change', () => {
    state.scatterX = parseInt(DOM.scatterX.value);
    if (state.hasResults) renderScatterPlot();
  });

  DOM.scatterY.addEventListener('change', () => {
    state.scatterY = parseInt(DOM.scatterY.value);
    if (state.hasResults) renderScatterPlot();
  });

  // Show regression toggle
  DOM.showRegression.addEventListener('change', () => {
    if (state.hasResults) renderPriceChart();
  });

  // Toast close
  DOM.toastClose.addEventListener('click', () => {
    DOM.errorToast.classList.add('hidden');
  });

  // Window resize — reflow Plotly
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      if (!state.hasResults) return;
      ['priceChart', 'heatmapChart', 'scatterChart'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el._fullLayout) Plotly.relayout(id, { autosize: true });
      });
    }, 200);
  });

  // Keyboard shortcut: Ctrl+Enter to analyze
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') analyze();
  });
}

// ══════════════════════════════════════════════
// INITIALIZATION
// ══════════════════════════════════════════════

function init() {
  loadFromStorage();
  renderTags();
  bindEvents();

  // Set active time range button
  document.querySelectorAll('.seg-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.range === state.timeRange);
  });

  // Start in demo mode if no API key
  if (!state.apiKey) {
    state.demoMode = true;
    DOM.demoBadge.classList.remove('hidden');
  }

  // Hide loading overlay initially
  DOM.loadingOverlay.classList.add('hidden');

  // Auto-analyze with demo data on load (nice UX)
  setTimeout(() => {
    if (state.stocks.length >= 2) analyze();
  }, 500);
}

document.addEventListener('DOMContentLoaded', init);
