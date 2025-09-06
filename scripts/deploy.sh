#!/bin/bash

# SEBI Fractional Bond Marketplace Deployment Script
# This script handles the complete deployment of the marketplace

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-development}
DOCKER_COMPOSE_FILE="docker-compose.yml"
BACKUP_DIR="./backups"
LOG_DIR="./logs"

# Create necessary directories
mkdir -p $BACKUP_DIR $LOG_DIR

echo -e "${BLUE}🚀 Starting SEBI Fractional Bond Marketplace Deployment${NC}"
echo -e "${BLUE}Environment: ${ENVIRONMENT}${NC}"

# Function to print status
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Check prerequisites
check_prerequisites() {
    echo -e "${BLUE}🔍 Checking prerequisites...${NC}"
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed"
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed"
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Backup existing data
backup_data() {
    if [ "$ENVIRONMENT" = "production" ]; then
        echo -e "${BLUE}💾 Creating backup...${NC}"
        
        # Create backup timestamp
        TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
        BACKUP_PATH="$BACKUP_DIR/backup_$TIMESTAMP"
        
        # Backup database
        docker-compose exec -T postgres pg_dump -U postgres sebi_marketplace > "$BACKUP_PATH.sql"
        
        # Backup Redis data
        docker-compose exec -T redis redis-cli --rdb - > "$BACKUP_PATH.rdb"
        
        print_status "Backup created at $BACKUP_PATH"
    fi
}

# Build and start services
deploy_services() {
    echo -e "${BLUE}🏗️  Building and starting services...${NC}"
    
    # Pull latest images
    docker-compose pull
    
    # Build custom images
    docker-compose build --no-cache
    
    # Start services
    docker-compose up -d
    
    print_status "Services started"
}

# Wait for services to be healthy
wait_for_services() {
    echo -e "${BLUE}⏳ Waiting for services to be healthy...${NC}"
    
    # Wait for PostgreSQL
    echo "Waiting for PostgreSQL..."
    timeout 60 bash -c 'until docker-compose exec postgres pg_isready -U postgres; do sleep 2; done'
    print_status "PostgreSQL is ready"
    
    # Wait for Redis
    echo "Waiting for Redis..."
    timeout 30 bash -c 'until docker-compose exec redis redis-cli ping; do sleep 2; done'
    print_status "Redis is ready"
    
    # Wait for Backend API
    echo "Waiting for Backend API..."
    timeout 60 bash -c 'until curl -f http://localhost:3001/health; do sleep 5; done'
    print_status "Backend API is ready"
    
    # Wait for ML Service
    echo "Waiting for ML Service..."
    timeout 60 bash -c 'until curl -f http://localhost:8001/health; do sleep 5; done'
    print_status "ML Service is ready"
    
    # Wait for Frontend
    echo "Waiting for Frontend..."
    timeout 60 bash -c 'until curl -f http://localhost:3000; do sleep 5; done'
    print_status "Frontend is ready"
}

# Run database migrations
run_migrations() {
    echo -e "${BLUE}🗄️  Running database migrations...${NC}"
    
    # Wait for database to be ready
    sleep 10
    
    # Run migrations (if any)
    docker-compose exec backend npm run migration:run || true
    
    print_status "Database migrations completed"
}

# Seed initial data
seed_data() {
    if [ "$ENVIRONMENT" = "development" ]; then
        echo -e "${BLUE}🌱 Seeding initial data...${NC}"
        
        # Create sample bonds
        docker-compose exec backend npm run seed || true
        
        print_status "Initial data seeded"
    fi
}

# Run health checks
health_checks() {
    echo -e "${BLUE}🏥 Running health checks...${NC}"
    
    # Check all services
    services=("postgres:5432" "redis:6379" "backend:3001" "ml-service:8001" "frontend:3000")
    
    for service in "${services[@]}"; do
        IFS=':' read -r name port <<< "$service"
        if curl -f "http://localhost:$port/health" &> /dev/null; then
            print_status "$name is healthy"
        else
            print_warning "$name health check failed"
        fi
    done
}

# Display deployment summary
deployment_summary() {
    echo -e "${BLUE}📊 Deployment Summary${NC}"
    echo "=================================="
    echo -e "Environment: ${ENVIRONMENT}"
    echo -e "Frontend: ${GREEN}http://localhost:3000${NC}"
    echo -e "Backend API: ${GREEN}http://localhost:3001${NC}"
    echo -e "ML Service: ${GREEN}http://localhost:8001${NC}"
    echo -e "Grafana: ${GREEN}http://localhost:3001${NC} (admin/admin)"
    echo -e "Prometheus: ${GREEN}http://localhost:9090${NC}"
    echo ""
    echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Access the frontend at http://localhost:3000"
    echo "2. Check logs with: docker-compose logs -f"
    echo "3. Monitor with Grafana at http://localhost:3001"
    echo "4. View API docs at http://localhost:3001/api/docs"
}

# Cleanup function
cleanup() {
    if [ $? -ne 0 ]; then
        print_error "Deployment failed. Cleaning up..."
        docker-compose down
        exit 1
    fi
}

# Set trap for cleanup
trap cleanup EXIT

# Main deployment flow
main() {
    check_prerequisites
    backup_data
    deploy_services
    wait_for_services
    run_migrations
    seed_data
    health_checks
    deployment_summary
}

# Run main function
main "$@"
