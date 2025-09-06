# SEBI Bond Trading Platform

A comprehensive bond trading platform built with NestJS backend and modern web frontend, featuring real-time trading, portfolio management, and market analytics.

## 🚀 Quick Start

1. **Start the Platform**
   ```bash
   # Open the platform launcher
   open start-platform.html
   ```

2. **Start the Backend**
   ```bash
   cd packages/backend
   npm install
   npm run start:dev
   ```

3. **Access the Platform**
   - **Client Portal**: For investors and traders
   - **Exchange Portal**: For market makers and administrators
   - **Backend API**: http://localhost:3001

## 📁 Project Structure

```
SEBI/
├── packages/
│   ├── backend/          # NestJS API server
│   ├── frontend/         # Next.js web application (optional)
│   └── ml-service/       # Python ML service
├── client-frontend.html  # Client trading interface
├── exchange-frontend.html # Exchange operations interface
├── start-platform.html   # Platform launcher
├── monitoring/           # Prometheus configuration
└── scripts/             # Deployment scripts
```

## 🏗️ Architecture

### Backend (NestJS)
- **Authentication**: JWT-based auth with guards
- **Database**: SQLite with TypeORM
- **Real-time**: WebSocket support for live updates
- **APIs**: RESTful endpoints for all operations

### Frontend (HTML/JS)
- **Client Portal**: Trading, portfolio, and market analysis
- **Exchange Portal**: Market operations and administration
- **Charts**: Chart.js for interactive data visualization
- **Responsive**: Mobile-friendly design

## 🔧 Features

### Client Portal
- **Market Overview**: Live bond prices and market statistics
- **Trading Interface**: Place buy/sell orders with real-time validation
- **Portfolio Management**: Track investments and performance
- **Order History**: View and manage all orders
- **Interactive Charts**: Price trends, order book, and portfolio analysis

### Exchange Portal
- **Dashboard**: System metrics and performance overview
- **Market Maker Tools**: Performance tracking and analytics
- **Order Management**: View and manage all orders
- **Analytics**: Comprehensive market analysis and risk metrics
- **Administration**: System configuration and controls

## 📊 Key Features

### Trading
- Real-time order placement and execution
- Interactive order book visualization
- Portfolio tracking with performance metrics
- Order history and status tracking

### Market Data
- Live price feeds with interactive charts
- Historical data analysis
- Market statistics and trends
- Risk metrics and analytics

### Administration
- System monitoring and health checks
- Order management and oversight
- Market maker performance tracking
- Emergency controls and system configuration

## 🚀 Getting Started

1. **Open the Platform Launcher**
   - Double-click `start-platform.html` or open in your browser
   - Choose between Client Portal or Exchange Portal

2. **Start the Backend**
   ```bash
   cd packages/backend
   npm install
   npm run start:dev
   ```

3. **Begin Trading**
   - Use the Client Portal for trading and portfolio management
   - Use the Exchange Portal for market operations and administration

## 📈 Interactive Charts

All interfaces feature interactive charts powered by Chart.js:
- **Price Charts**: Real-time bond price trends
- **Order Book**: Visual representation of buy/sell orders
- **Portfolio Analysis**: Investment performance tracking
- **Market Analytics**: Volume, trends, and risk metrics
- **Performance Metrics**: Market maker and system performance

## 🔒 Security

- JWT authentication
- Input validation and sanitization
- SQL injection prevention
- CORS configuration
- Rate limiting and error handling

## 📝 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/profile` - Get user profile

### Bonds
- `GET /api/bonds` - List all bonds
- `GET /api/bonds/:id` - Get bond details
- `POST /api/bonds` - Create new bond
- `PUT /api/bonds/:id` - Update bond
- `DELETE /api/bonds/:id` - Delete bond

### Orders
- `GET /api/orders` - List orders
- `POST /api/orders` - Place order
- `PUT /api/orders/:id` - Update order
- `DELETE /api/orders/:id` - Cancel order

### Portfolio
- `GET /api/portfolio` - Get portfolio
- `POST /api/portfolio/buy` - Buy bond
- `POST /api/portfolio/sell` - Sell bond

## 🚀 Deployment

### Docker
```bash
docker-compose up -d
```

### Manual
```bash
# Backend
cd packages/backend
npm run build
npm run start:prod

# Frontend (if using Next.js)
cd packages/frontend
npm run build
npm run start
```

## 📈 Monitoring

- **Prometheus**: Metrics collection
- **Grafana**: Dashboard visualization
- **Health Checks**: System status monitoring
- **Real-time Updates**: Live data feeds

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📞 Support

For support and questions, please contact the development team.
