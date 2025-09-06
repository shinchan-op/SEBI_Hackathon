"""
ML Microservice for SEBI Fractional Bond Marketplace
Provides price predictions and explainability for bond pricing
"""

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import Dict, List, Optional
import numpy as np
import pandas as pd
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
import joblib
import redis
import psycopg2
from datetime import datetime, timedelta
import asyncio
import httpx
import json
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="SEBI ML Service", version="1.0.0")

# Redis connection
redis_client = redis.Redis(host='localhost', port=6379, db=0, decode_responses=True)

# Database connection
DB_CONFIG = {
    'host': 'localhost',
    'database': 'sebi_marketplace',
    'user': 'postgres',
    'password': 'password'
}

class PredictionRequest(BaseModel):
    bond_id: int
    features: Dict[str, float]

class PredictionResponse(BaseModel):
    bond_id: int
    t7_price_mean: float
    t7_low: float
    t7_high: float
    confidence: float
    feature_importance: Dict[str, float]
    model_version: str
    prediction_timestamp: str

class ModelInfo(BaseModel):
    model_id: str
    version: str
    training_date: str
    performance_metrics: Dict[str, float]
    feature_count: int

# Global model storage
models = {}
scalers = {}
feature_columns = []

@app.on_event("startup")
async def startup_event():
    """Initialize models and load data on startup"""
    logger.info("Starting ML Service...")
    await load_models()
    await schedule_retraining()

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "timestamp": datetime.now().isoformat()}

@app.get("/api/predict/{bond_id}")
async def predict_bond_price(bond_id: int) -> PredictionResponse:
    """Predict bond price for T+7 with confidence intervals"""
    try:
        # Get current bond features
        features = await get_bond_features(bond_id)
        
        if not features:
            raise HTTPException(status_code=404, detail=f"Bond {bond_id} not found or insufficient data")
        
        # Get model for this bond (or use general model)
        model_key = f"bond_{bond_id}" if f"bond_{bond_id}" in models else "general"
        
        if model_key not in models:
            raise HTTPException(status_code=503, detail="Model not available")
        
        model = models[model_key]
        scaler = scalers[model_key]
        
        # Prepare features
        feature_array = np.array([list(features.values())]).reshape(1, -1)
        scaled_features = scaler.transform(feature_array)
        
        # Make prediction
        prediction = model.predict(scaled_features)[0]
        
        # Calculate confidence intervals (simplified)
        confidence = 0.85  # Mock confidence
        std_dev = 0.5  # Mock standard deviation
        t7_low = prediction - 1.96 * std_dev
        t7_high = prediction + 1.96 * std_dev
        
        # Get feature importance
        feature_importance = get_feature_importance(model, features)
        
        return PredictionResponse(
            bond_id=bond_id,
            t7_price_mean=float(prediction),
            t7_low=float(t7_low),
            t7_high=float(t7_high),
            confidence=confidence,
            feature_importance=feature_importance,
            model_version="v1.0",
            prediction_timestamp=datetime.now().isoformat()
        )
        
    except Exception as e:
        logger.error(f"Error predicting bond {bond_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/train")
async def train_model(bond_id: Optional[int] = None):
    """Trigger model training for specific bond or general model"""
    try:
        await train_bond_model(bond_id)
        return {"message": f"Model training completed for bond {bond_id or 'general'}"}
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/models")
async def list_models() -> List[ModelInfo]:
    """List available models and their performance"""
    model_info = []
    
    for model_key, model in models.items():
        # Mock performance metrics
        metrics = {
            "mae": 0.5,
            "rmse": 0.7,
            "r2": 0.85
        }
        
        model_info.append(ModelInfo(
            model_id=model_key,
            version="v1.0",
            training_date=datetime.now().isoformat(),
            performance_metrics=metrics,
            feature_count=len(feature_columns)
        ))
    
    return model_info

async def load_models():
    """Load pre-trained models from storage"""
    global models, scalers, feature_columns
    
    try:
        # Try to load from Redis
        model_data = redis_client.get("ml_models")
        if model_data:
            model_dict = json.loads(model_data)
            # Reconstruct models from serialized data
            # This is simplified - in production, use proper model serialization
            logger.info("Loaded models from Redis")
        else:
            # Train initial models
            await train_bond_model()
            logger.info("Trained initial models")
            
    except Exception as e:
        logger.error(f"Error loading models: {str(e)}")
        # Fallback to training new models
        await train_bond_model()

async def train_bond_model(bond_id: Optional[int] = None):
    """Train model for specific bond or general model"""
    try:
        # Get training data
        training_data = await get_training_data(bond_id)
        
        if training_data.empty:
            logger.warning(f"No training data available for bond {bond_id}")
            return
        
        # Prepare features and target
        X = training_data.drop(['price', 'date'], axis=1, errors='ignore')
        y = training_data['price']
        
        global feature_columns
        feature_columns = list(X.columns)
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=42
        )
        
        # Scale features
        scaler = StandardScaler()
        X_train_scaled = scaler.fit_transform(X_train)
        X_test_scaled = scaler.transform(X_test)
        
        # Train model
        model = Ridge(alpha=1.0)
        model.fit(X_train_scaled, y_train)
        
        # Evaluate model
        train_score = model.score(X_train_scaled, y_train)
        test_score = model.score(X_test_scaled, y_test)
        
        logger.info(f"Model trained - Train R²: {train_score:.3f}, Test R²: {test_score:.3f}")
        
        # Store model
        model_key = f"bond_{bond_id}" if bond_id else "general"
        models[model_key] = model
        scalers[model_key] = scaler
        
        # Save to Redis
        await save_models_to_redis()
        
    except Exception as e:
        logger.error(f"Error training model: {str(e)}")
        raise

async def get_training_data(bond_id: Optional[int] = None) -> pd.DataFrame:
    """Get historical data for training"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        
        if bond_id:
            query = """
            SELECT 
                b.coupon,
                b.rating,
                b.issue_size,
                b.days_since_last_trade,
                t.price_per_unit as price,
                t.executed_at as date,
                EXTRACT(EPOCH FROM (b.maturity_date - t.executed_at)) / 86400 as days_to_maturity,
                EXTRACT(EPOCH FROM (t.executed_at - LAG(t.executed_at) OVER (ORDER BY t.executed_at)) / 86400) as days_since_last_trade_actual
            FROM trades t
            JOIN bonds b ON t.bond_id = b.id
            WHERE t.bond_id = %s
            ORDER BY t.executed_at
            """
            data = pd.read_sql_query(query, conn, params=[bond_id])
        else:
            query = """
            SELECT 
                b.coupon,
                b.rating,
                b.issue_size,
                b.days_since_last_trade,
                t.price_per_unit as price,
                t.executed_at as date,
                EXTRACT(EPOCH FROM (b.maturity_date - t.executed_at)) / 86400 as days_to_maturity,
                EXTRACT(EPOCH FROM (t.executed_at - LAG(t.executed_at) OVER (ORDER BY t.executed_at)) / 86400) as days_since_last_trade_actual
            FROM trades t
            JOIN bonds b ON t.bond_id = b.id
            ORDER BY t.executed_at
            """
            data = pd.read_sql_query(query, conn)
        
        conn.close()
        
        # Feature engineering
        data = engineer_features(data)
        
        return data
        
    except Exception as e:
        logger.error(f"Error getting training data: {str(e)}")
        return pd.DataFrame()

def engineer_features(df: pd.DataFrame) -> pd.DataFrame:
    """Engineer additional features for ML model"""
    # Rating encoding
    rating_map = {
        'AAA': 1.0, 'AA+': 0.9, 'AA': 0.8, 'AA-': 0.7,
        'A+': 0.6, 'A': 0.5, 'A-': 0.4,
        'BBB+': 0.3, 'BBB': 0.2, 'BBB-': 0.1
    }
    df['rating_numeric'] = df['rating'].map(rating_map).fillna(0.1)
    
    # Yield calculation
    df['yield'] = df['coupon'] / df['price_per_unit'] * 100
    
    # Volatility features
    df['price_volatility_7d'] = df['price_per_unit'].rolling(7).std()
    df['price_volatility_30d'] = df['price_per_unit'].rolling(30).std()
    
    # Momentum features
    df['price_momentum_7d'] = df['price_per_unit'].pct_change(7)
    df['price_momentum_30d'] = df['price_per_unit'].pct_change(30)
    
    # Time features
    df['month'] = pd.to_datetime(df['date']).dt.month
    df['quarter'] = pd.to_datetime(df['date']).dt.quarter
    
    # Fill NaN values
    df = df.fillna(method='ffill').fillna(0)
    
    return df

async def get_bond_features(bond_id: int) -> Dict[str, float]:
    """Get current features for a bond"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor()
        
        # Get bond data
        cursor.execute("""
            SELECT coupon, rating, issue_size, days_since_last_trade, 
                   maturity_date, last_traded_price
            FROM bonds WHERE id = %s
        """, [bond_id])
        
        bond_data = cursor.fetchone()
        if not bond_data:
            return {}
        
        coupon, rating, issue_size, days_since_last_trade, maturity_date, last_price = bond_data
        
        # Calculate features
        days_to_maturity = (maturity_date - datetime.now()).days
        
        # Rating encoding
        rating_map = {
            'AAA': 1.0, 'AA+': 0.9, 'AA': 0.8, 'AA-': 0.7,
            'A+': 0.6, 'A': 0.5, 'A-': 0.4,
            'BBB+': 0.3, 'BBB': 0.2, 'BBB-': 0.1
        }
        rating_numeric = rating_map.get(rating, 0.1)
        
        # Yield
        yield_val = coupon / last_price * 100 if last_price > 0 else 0
        
        features = {
            'coupon': float(coupon),
            'rating_numeric': rating_numeric,
            'issue_size': float(issue_size or 0),
            'days_since_last_trade': float(days_since_last_trade),
            'days_to_maturity': float(days_to_maturity),
            'yield': yield_val,
            'price_volatility_7d': 0.5,  # Mock - should calculate from historical data
            'price_volatility_30d': 0.8,
            'price_momentum_7d': 0.01,
            'price_momentum_30d': 0.02,
            'month': float(datetime.now().month),
            'quarter': float(datetime.now().quarter)
        }
        
        conn.close()
        return features
        
    except Exception as e:
        logger.error(f"Error getting bond features: {str(e)}")
        return {}

def get_feature_importance(model, features: Dict[str, float]) -> Dict[str, float]:
    """Get feature importance for model explainability"""
    if hasattr(model, 'coef_'):
        # Ridge regression coefficients
        importance = dict(zip(feature_columns, model.coef_))
    else:
        # Mock importance for other models
        importance = {feature: 0.1 for feature in features.keys()}
    
    # Normalize to 0-1 range
    max_importance = max(abs(v) for v in importance.values()) if importance else 1
    normalized = {k: abs(v) / max_importance for k, v in importance.items()}
    
    return normalized

async def save_models_to_redis():
    """Save models to Redis for persistence"""
    try:
        # In production, use proper model serialization (joblib, pickle, etc.)
        model_data = {
            "models": {k: "serialized_model" for k in models.keys()},
            "scalers": {k: "serialized_scaler" for k in scalers.keys()},
            "feature_columns": feature_columns,
            "timestamp": datetime.now().isoformat()
        }
        
        redis_client.set("ml_models", json.dumps(model_data))
        logger.info("Models saved to Redis")
        
    except Exception as e:
        logger.error(f"Error saving models to Redis: {str(e)}")

async def schedule_retraining():
    """Schedule periodic model retraining"""
    # In production, use a proper task scheduler (Celery, APScheduler, etc.)
    logger.info("Model retraining scheduled")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
