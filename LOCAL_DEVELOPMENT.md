# Local Development Setup

## Quick Start

### Option 1: Automated Setup (Windows)
```bash
start-local.bat
```

### Option 2: Manual Setup

#### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL (or use Docker for database only)

#### 1. Start Database Services
```bash
# Start only database services with Docker
docker-compose up -d postgres redis

# Or install PostgreSQL locally and create database
createdb sebi_marketplace
```

#### 2. Backend Setup
```bash
cd packages/backend
npm install
npm run seed  # Seed sample data
npm run dev   # Start on http://localhost:3001
```

#### 3. Frontend Setup
```bash
cd packages/frontend
npm install
npm run dev  # Start on http://localhost:3000
```

#### 4. ML Service Setup
```bash
cd packages/ml-service
pip install -r requirements.txt
python src/main.py  # Start on http://localhost:8001
```

## Access Points

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **ML Service**: http://localhost:8001
- **API Health**: http://localhost:3001/health

## Features Available

### ✅ Working Features
- Bond listing and details
- Live pricing with PV calculations
- Order placement and matching
- Portfolio management
- SIP setup and management
- Repo/lending system
- Market maker management
- ML price predictions
- Compliance and surveillance

### 🔧 Development Notes
- Database auto-syncs in development mode
- Sample bonds are seeded automatically
- All services have hot reload enabled
- CORS is configured for local development

## Troubleshooting

### Database Connection Issues
```bash
# Check if PostgreSQL is running
docker-compose ps

# View database logs
docker-compose logs postgres

# Reset database
docker-compose down -v
docker-compose up -d postgres redis
```

### Port Conflicts
- Backend: Change PORT in packages/backend/.env
- Frontend: Change port in packages/frontend/package.json
- ML Service: Change port in packages/ml-service/src/main.py

### Dependencies Issues
```bash
# Clear npm cache
npm cache clean --force

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install
```

## Next Steps

1. **Test the Application**: Visit http://localhost:3000
2. **Explore APIs**: Check http://localhost:3001/health
3. **View Sample Data**: Bonds are automatically seeded
4. **Place Test Orders**: Use the frontend interface
5. **Monitor Logs**: Check console output for each service

## Production Deployment

For production deployment, use the Docker Compose setup:
```bash
docker-compose up -d
```

This will start all services with proper configuration for production use.
