# dash.md

## Overview
This project is a cryptocurrency token dashboard for the "Oeconomia" (OEC) token on the Binance Smart Chain (BSC) network. Its purpose is to provide comprehensive token analytics, real-time price tracking, holder statistics, transaction monitoring, and integration with popular DeFi platforms like PancakeSwap. The business vision is to create a professional trading interface with intuitive controls, transparent fee disclosure, industry-standard layout, and optimal screen space utilization, making it an essential tool for OEC token holders and traders. Key capabilities include a dynamic token system supporting all major cryptocurrencies, a three-tab lending interface, and integrated real-time charting with dynamic, token-specific brand colors.

## User Preferences
Preferred communication style: Simple, everyday language. Appreciates precise visual consistency and polished UI design details.
UI/UX preferences: Values polished, professional appearance with attention to detail. Prefers centered, sticky elements for important features like alerts and notices.

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter
- **State Management**: TanStack Query (React Query)
- **UI Components**: Custom components built with Radix UI primitives and shadcn/ui
- **Styling**: Tailwind CSS with custom crypto-themed design system, utilizing custom gradient color schemes.
- **Build Tool**: Vite
- **UI/UX Decisions**: Professional UI/UX for swap functionality, dynamic page titles, unified design system with consistent branding, comprehensive staking interface with distinct gradient color schemes, interactive ROI Calculator and Achievement system, clear visual distinction between DeFi position types, one-time popup modal for new visitors, and an advanced chart interface with responsive layout, collapsible sidebar, token-specific color mapping, and area chart with gradient fade effects.
- **Data Flow Architecture**: All frontend data exclusively sourced from Neon database via dedicated Netlify functions (token-coins-data.ts, token-data.ts, token-historical-data.ts) ensuring complete independence from Replit environment limitations.

### Backend Architecture
- **Runtime**: Node.js with Express.js server (converted to Netlify serverless functions for production)
- **Language**: TypeScript
- **API Design**: REST API with structured endpoints for token data, transactions, and network status.
- **Deployment**: Netlify for static site and serverless function deployment.

### Data Storage
- **Database ORM**: Drizzle ORM
- **Database Provider**: Neon Database (serverless PostgreSQL)
- **Session Storage**: PostgreSQL-based session storage
- **Data Persistence**: Persistent storage for tracked tokens, historical snapshots, user watchlists, and price alerts.

### System Design Choices
- **100% Authentic Data**: All charts use Live Coin Watch historical data (no synthetic prices)
- **Complete Token Coverage**: Authentic historical data for all 100+ tokens with full timeframe support
- **Production Independence**: Netlify functions handle all data operations independent of Replit
- **Automated Updates**: Hourly sync system maintains fresh authentic data across all tokens
- **Robust Error Handling**: Graceful API failure management with database cache fallback
- **Dynamic Token System**: Database-driven token routing supporting all Live Coin Watch tokens
- **Professional Accuracy**: Charts match TradingView precision using authentic market data
- **Complete Database Independence**: All frontend components (ETH chart, dashboard, token lists) exclusively use database cache via Netlify functions - zero Live Coin Watch API calls from frontend

## External Dependencies

### Crypto Data Sources
- **Live Coin Watch API**: Primary source for all authentic cryptocurrency market data and historical prices.
  - Real-time market data for 100+ tokens with database persistence
  - Authentic historical price data (1H, 1D, 7D, 30D timeframes) 
  - Production Netlify function integration for independent operation
  - Hourly automated updates for all tracked tokens
- **CoinGecko API**: Secondary market data source (deprecated in favor of Live Coin Watch).
- **PancakeSwap API**: DEX trading data and liquidity information.
- **Moralis API**: BSC blockchain data and token analytics.

### UI Libraries
- **Radix UI**: Accessible component primitives.
- **Recharts**: Interactive charting library.
- **Lucide Icons**: Icon library.
- **Tailwind CSS**: Utility-first CSS framework.

### Development Tools
- **Vite**: Build tool.
- **TypeScript**: Type safety across the stack.
- **ESBuild**: Fast bundling for production server code.
