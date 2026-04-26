# CorrelX — Stock Correlation & Regression Dashboard

> A production-grade financial analytics dashboard for visualizing stock correlations, regression trends, and portfolio risk in real-time.

![CorrelX Dashboard](https://placeholder.com/screenshots/dashboard-dark.png)

---

## 📌 Overview

**CorrelX** is a fully client-side web application that provides institutional-quality correlation and regression analysis for equity portfolios. Built for portfolio managers, quant enthusiasts, and developers wanting to explore market relationships — without needing a backend.

It computes Pearson correlations, linear regressions, annualized volatility, and generates smart, data-driven financial insights entirely in the browser.

---

## ✨ Features

| Feature | Description |
|---|---|
| 📈 **Multi-Stock Selection** | Analyze 2–5 stocks simultaneously with tag-based input |
| 🔥 **Correlation Heatmap** | Full Pearson matrix with interactive Plotly heatmap |
| 📉 **Regression Trends** | Per-stock linear regression with R², slope, and 30-day projection |
| 🔵 **Scatter Plot** | Pair-wise scatter with regression line and correlation stats |
| ⚠️ **Risk Classifier** | Annualized volatility bucketed into Low / Medium / High |
| 💡 **Smart Insights** | Dynamic, human-readable insights generated from actual data |
| ⚖️ **Price Normalization** | Rebase all prices to 100 for fair multi-stock comparison |
| 🌙 **Dark / Light Mode** | Full theme toggle with chart re-rendering |
| ⬇️ **CSV Export** | Download aligned price data + correlation matrix as CSV |
| 💾 **State Persistence** | Selected stocks and time range saved to localStorage |
| 🎮 **Demo Mode** | Realistic correlated market data generated in-browser — no API key needed |

---

## 🖥️ Screenshots

| Dark Mode Dashboard | Light Mode |
|---|---|
| ![Dark](https://placeholder.com/screenshots/dark.png) | ![Light](https://placeholder.com/screenshots/light.png) |

| Correlation Heatmap | Smart Insights |
|---|---|
| ![Heatmap](https://placeholder.com/screenshots/heatmap.png) | ![Insights](https://placeholder.com/screenshots/insights.png) |

---

## 🛠️ Tech Stack

- **HTML5** — Semantic layout, accessible markup
- **CSS3** — Custom properties, grid/flexbox, CSS animations, responsive design
- **Vanilla JavaScript (ES2022)** — No framework dependencies
- **[Plotly.js 2.26](https://plotly.com/javascript/)** — Interactive charting (heatmap, scatter, line)
- **[Alpha Vantage API](https://www.alphavantage.co/)** — Free-tier stock price data
- **Google Fonts** — Syne (display), DM Sans (body), DM Mono (data)

---

## 🚀 Getting Started

### Option 1: Open Directly (No Server Needed)

```bash
git clone https://github.com/yourusername/correlx-dashboard.git
cd correlx-dashboard
open index.html     # macOS
start index.html    # Windows
xdg-open index.html # Linux
```

The dashboard auto-loads in **Demo Mode** using simulated market data — no API key required.

### Option 2: Serve Locally (Recommended)

```bash
# Using Python
python3 -m http.server 8080

# Using Node.js
npx serve .

# Using VS Code
# Install "Live Server" extension → Right-click index.html → "Open with Live Server"
```

Then visit: **http://localhost:8080**

---

## 🔑 API Key Setup (Alpha Vantage)

To use **real market data**:

1. Visit [alphavantage.co/support/#api-key](https://www.alphavantage.co/support/#api-key)
2. Sign up for a **free API key** (instant, no credit card)
3. Paste the key into the **API Key** field in the sidebar
4. Click **Analyze ⚡**

> **Note:** The free tier allows **5 requests/minute** and **25 requests/day**. For 5 stocks, the app automatically waits 14 seconds between requests to avoid rate limiting.

### Supported Symbols

| Exchange | Example Tickers |
|---|---|
| **NYSE / NASDAQ** | AAPL, MSFT, GOOGL, AMZN, TSLA, META |
| **Indian (NYSE ADR)** | INFY (Infosys), WIT (Wipro), HDB (HDFC Bank), IBN (ICICI Bank) |
| **ETFs** | SPY, QQQ, VTI, GLD |

---

## 📁 Project Structure

```
stock-dashboard/
├── index.html      — App shell, all markup and card structure
├── style.css       — Complete styling with CSS variables and theming
├── script.js       — Application logic, analysis, chart rendering
└── README.md       — This file
```

---

## 📊 Analysis Methods

### Pearson Correlation Coefficient

```
r(X,Y) = Σ[(Xᵢ - X̄)(Yᵢ - Ȳ)] / (n · σX · σY)
```

Applied to **daily returns** (not raw prices) for stationarity. Ranges from −1 to +1.

### Linear Regression

```
Y = slope × t + intercept
```

Regressed over time index. Reports R² goodness-of-fit, slope ($/day), and extrapolated 30-day price projection.

### Annualized Volatility

```
σ_ann = σ_daily × √252
```

Standard deviation of daily log-returns, annualized to ~252 trading days per year.

**Classification:**
- 🟢 **Low** — σ < 15% (e.g., defensive stocks, blue chips)
- 🟡 **Medium** — 15% ≤ σ < 30% (typical large-cap equities)
- 🔴 **High** — σ ≥ 30% (growth stocks, volatile assets)

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl / ⌘ + Enter` | Run analysis |
| `Enter` in stock field | Add stock tag |
| `Backspace` in empty field | Remove last stock |

---

## 🔮 Planned Future Improvements

- [ ] **Rolling Correlation** — 30/60-day sliding window correlation chart
- [ ] **Portfolio Optimizer** — Minimum-variance weights via Markowitz
- [ ] **Beta Calculation** — vs SPY / custom benchmark
- [ ] **Multi-period Comparison** — Overlay correlation across time periods
- [ ] **More Data Sources** — Yahoo Finance, Polygon.io, Finnhub support
- [ ] **Sharpe Ratio** — Risk-adjusted return metric per stock
- [ ] **React/Vue Port** — Component-based rewrite for scalability
- [ ] **Backend API** — Node/Python server to bypass API rate limits
- [ ] **News Overlay** — Financial events correlated with price movements
- [ ] **PWA Support** — Offline capability and mobile install

---

## 📄 License

MIT License — free to use, modify, and distribute.

---

## 🙏 Acknowledgements

- [Alpha Vantage](https://www.alphavantage.co/) for free market data API
- [Plotly.js](https://plotly.com/javascript/) for powerful browser-based charting
- [Google Fonts](https://fonts.google.com/) — Syne, DM Sans, DM Mono

---

*Built with ❤️ for the quantitative finance community.*
