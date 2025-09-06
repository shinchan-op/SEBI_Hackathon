# 🏛️ SEBI Fractional Bond Marketplace - Live Demo

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- PostgreSQL running (via Docker or local installation)

### 1. Start Database
```bash
# Using Docker (recommended)
docker-compose up -d postgres redis

# Or start PostgreSQL locally on port 5432
# Database: sebi_marketplace
# User: postgres
# Password: password
```

### 2. Start Backend API
```bash
# Install dependencies
npm install

# Start the server
node simple-demo.js
```

The API will be available at: http://localhost:3001

### 3. Open Frontend
Open `demo-frontend.html` in your web browser or serve it with a local server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js
npx serve .
```

Then visit: http://localhost:8000/demo-frontend.html

## 🎯 Demo Features

### ✅ Working Features
- **Live API Status**: Real-time connection monitoring
- **Bond Marketplace**: Browse available government and corporate bonds
- **Live Pricing**: Real-time bond pricing with clean/dirty price calculations
- **Portfolio Management**: View current positions and P&L
- **ML Predictions**: AI-powered price predictions with confidence intervals
- **Responsive UI**: Modern, mobile-friendly interface

### 📊 API Endpoints
- `GET /health` - System health check
- `GET /api/bonds` - List all available bonds
- `GET /api/bonds/:id` - Get specific bond details
- `GET /api/quote/:id` - Get live pricing for a bond
- `GET /api/orderbook/:id` - Get order book data
- `GET /api/portfolio` - Get portfolio overview

### 🎨 UI Components
- **Bond Cards**: Interactive bond listings with click-to-price
- **Live Pricing Panel**: Real-time price updates and ML predictions
- **Portfolio Dashboard**: Comprehensive portfolio overview
- **Status Indicators**: Real-time API connection status

## 🔧 Technical Architecture

### Backend (Express.js)
- **Framework**: Express.js with CORS enabled
- **Database**: PostgreSQL with connection pooling
- **Pricing Engine**: PV-based calculations with ML predictions
- **API Design**: RESTful endpoints with JSON responses

### Frontend (Vanilla HTML/JS)
- **Framework**: Pure HTML5, CSS3, and JavaScript
- **Styling**: Modern CSS with gradients and glassmorphism
- **API Integration**: Fetch API with error handling
- **Responsive Design**: Mobile-first approach

### Data Flow
1. **User Interaction** → Frontend JavaScript
2. **API Calls** → Express.js Backend
3. **Data Processing** → Pricing calculations
4. **Response** → JSON data to frontend
5. **UI Update** → Real-time display updates

## 🎮 How to Use the Demo

1. **Open the Frontend**: Load `demo-frontend.html` in your browser
2. **Check Status**: Verify the API is online (green indicator)
3. **Browse Bonds**: Click on any bond to view live pricing
4. **View Portfolio**: See your current positions and P&L
5. **Refresh Data**: Use refresh buttons to get latest data

## 📈 Sample Data

The demo includes realistic sample data:
- **Government Bonds**: GOI 2029, 2031, 2033
- **Corporate Bonds**: SBI, HDFC Bank
- **Pricing Data**: Live clean/dirty prices, spreads, ML predictions
- **Portfolio**: Sample positions with P&L calculations

## 🔍 Key Features Demonstrated

### 1. Fractional Bond Trading
- Bonds with ₹1,000 minimum fractional units
- Real-time pricing for fractional amounts
- Transparent fee structure

### 2. AI-Powered Pricing
- ML predictions for T+7 price movements
- Confidence intervals and explainability
- Fair value calculations

### 3. Portfolio Management
- Real-time P&L tracking
- Position sizing and risk management
- Cash balance monitoring

### 4. Market Transparency
- Live bid/ask spreads
- Order book depth visualization
- Pricing breakdown and methodology

## 🚀 Next Steps

This demo showcases the core functionality of the SEBI Fractional Bond Marketplace. The full production system would include:

- **Authentication**: User login and KYC verification
- **Order Management**: Place and manage buy/sell orders
- **SIP Integration**: Systematic investment plans
- **Repo/Lending**: Bond lending and borrowing
- **Market Making**: Automated liquidity provision
- **Compliance**: Real-time surveillance and reporting

## 🛠️ Troubleshooting

### API Not Responding
- Check if PostgreSQL is running
- Verify the backend server is started
- Check console for error messages

### Database Connection Issues
- Ensure PostgreSQL is running on port 5432
- Verify database credentials
- Check if database `sebi_marketplace` exists

### Frontend Issues
- Open browser developer tools
- Check for CORS errors
- Verify API endpoints are accessible

## 📞 Support

For issues or questions about this demo:
1. Check the browser console for errors
2. Verify all services are running
3. Review the API health endpoint
4. Check the project documentation

---

**🎉 Enjoy exploring the future of fractional bond trading!**
