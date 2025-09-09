# SEBI Bond Trading Platform

A comprehensive bond trading platform built with NestJS backend and modern web frontend, featuring real-time trading, portfolio management, and market analytics.

<img width="1133" height="838" alt="image" src="https://github.com/user-attachments/assets/2b108686-5110-48a5-afcc-d14f22810197" />

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

<img width="1431" height="848" alt="image" src="https://github.com/user-attachments/assets/590aa2a4-3645-454d-880c-2afe214251a1" />

### Exchange Portal
- **Dashboard**: System metrics and performance overview
- **Market Maker Tools**: Performance tracking and analytics
- **Order Management**: View and manage all orders
- **Analytics**: Comprehensive market analysis and risk metrics
- **Administration**: System configuration and controls

<img width="1511" height="709" alt="image" src="https://github.com/user-attachments/assets/31b75d9f-65ac-48c9-b585-718d2bb8993a" />

## 📊 Key Features

### Trading
- Real-time order placement and execution
- Interactive order book visualization
- Portfolio tracking with performance metrics
- Order history and status tracking

<img width="1095" height="738" alt="image" src="https://github.com/user-attachments/assets/1481ea42-c362-4305-83a6-731d1bc09e76" />
<img width="1112" height="706" alt="image" src="https://github.com/user-attachments/assets/90f2ef00-72c1-4146-b3b4-bfd96f27b674" />
<img width="1093" height="752" alt="image" src="https://github.com/user-attachments/assets/098389d3-8416-42d5-ae63-cb34cc52d661" />
<img width="1097" height="778" alt="image" src="https://github.com/user-attachments/assets/174b0bc9-bcbc-45e3-9f7e-a1ae1aaa8c6c" />

### Market Data
- Live price feeds with interactive charts
- Historical data analysis
- Market statistics and trends
- Risk metrics and analytics

<img width="1092" height="821" alt="image" src="https://github.com/user-attachments/assets/39f09810-23ce-430e-80da-35051e5815ae" />



### Administration
- System monitoring and health checks
- Order management and oversight
- Market maker performance tracking
- Emergency controls and system configuration

<img width="1093" height="663" alt="image" src="https://github.com/user-attachments/assets/2c47d452-35af-444d-852a-1f262dd92ff6" />
<img width="1104" height="735" alt="image" src="https://github.com/user-attachments/assets/a8f2c096-1652-4354-87cf-1c7805e395f8" />
<img width="1089" height="853" alt="image" src="https://github.com/user-attachments/assets/e3bc4e71-0edd-4209-9a88-3da2a539a379" />
<img width="1090" height="547" alt="image" src="https://github.com/user-attachments/assets/ed7ffa67-1048-4c77-ad3e-ce0a432c7f91" />


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
