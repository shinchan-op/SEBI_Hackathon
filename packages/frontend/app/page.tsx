'use client';

import { useState, useEffect } from 'react';
import { Header } from '@/components/Header';
import { BondCard } from '@/components/BondCard';
import { OrderBook } from '@/components/OrderBook';
import { PriceChart } from '@/components/PriceChart';
import { useWebSocket } from '@/hooks/useWebSocket';
import { Bond, BondQuote } from '@/types/bond';

export default function HomePage() {
  const [bonds, setBonds] = useState<Bond[]>([]);
  const [selectedBond, setSelectedBond] = useState<Bond | null>(null);
  const [bondQuote, setBondQuote] = useState<BondQuote | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { socket, isConnected } = useWebSocket();

  useEffect(() => {
    fetchBonds();
  }, []);

  useEffect(() => {
    if (selectedBond) {
      fetchBondQuote(selectedBond.id);
    }
  }, [selectedBond]);

  useEffect(() => {
    if (socket && isConnected) {
      socket.on('bond.quote.updated', (data: { bondId: number; quote: BondQuote }) => {
        if (selectedBond && data.bondId === selectedBond.id) {
          setBondQuote(data.quote);
        }
      });

      socket.on('bond.price.updated', (data: { bondId: number; price: number }) => {
        setBonds(prevBonds => 
          prevBonds.map(bond => 
            bond.id === data.bondId 
              ? { ...bond, lastTradedPrice: data.price }
              : bond
          )
        );
      });

      return () => {
        socket.off('bond.quote.updated');
        socket.off('bond.price.updated');
      };
    }
  }, [socket, isConnected, selectedBond]);

  const fetchBonds = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/bonds?limit=20');
      if (!response.ok) {
        throw new Error('Failed to fetch bonds');
      }
      const data = await response.json();
      setBonds(data.bonds || []);
      if (data.bonds && data.bonds.length > 0) {
        setSelectedBond(data.bonds[0]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchBondQuote = async (bondId: number) => {
    try {
      const response = await fetch(`/api/bonds/${bondId}/quote`);
      if (!response.ok) {
        throw new Error('Failed to fetch bond quote');
      }
      const quote = await response.json();
      setBondQuote(quote);
    } catch (err) {
      console.error('Error fetching bond quote:', err);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Loading Bonds</h2>
            <p className="text-gray-600 mb-4">{error}</p>
            <button 
              onClick={fetchBonds}
              className="btn btn-primary"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header />
      
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Market Overview */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Fractional Bond Marketplace
          </h1>
          <p className="text-gray-600">
            Trade fractional bonds with transparent pricing and enhanced liquidity
          </p>
        </div>

        {/* Connection Status */}
        <div className="mb-6">
          <div className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            isConnected 
              ? 'bg-success-100 text-success-800' 
              : 'bg-danger-100 text-danger-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              isConnected ? 'bg-success-500' : 'bg-danger-500'
            }`}></div>
            {isConnected ? 'Connected' : 'Disconnected'}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Bonds List */}
          <div className="lg:col-span-1">
            <div className="card">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Available Bonds
              </h2>
              <div className="space-y-3">
                {bonds.map((bond) => (
                  <BondCard
                    key={bond.id}
                    bond={bond}
                    isSelected={selectedBond?.id === bond.id}
                    onClick={() => setSelectedBond(bond)}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Bond Details & Trading */}
          <div className="lg:col-span-2">
            {selectedBond ? (
              <div className="space-y-6">
                {/* Bond Quote */}
                {bondQuote && (
                  <div className="card">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      {selectedBond.name} - Live Quote
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Fair Price</p>
                        <p className="text-2xl font-bold text-primary-600">
                          ₹{bondQuote.fractionQuote.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Yield</p>
                        <p className="text-2xl font-bold text-gray-900">
                          {bondQuote.yieldFair.toFixed(2)}%
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">T+7 Prediction</p>
                        <p className="text-2xl font-bold text-success-600">
                          ₹{bondQuote.predictive.t7PriceMean.toFixed(2)}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Confidence</p>
                        <p className="text-2xl font-bold text-warning-600">
                          {((bondQuote.predictive.t7High - bondQuote.predictive.t7Low) / bondQuote.predictive.t7PriceMean * 100).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Price Chart */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Price Chart & Predictions
                  </h3>
                  <PriceChart bond={selectedBond} quote={bondQuote} />
                </div>

                {/* Order Book */}
                <div className="card">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Order Book
                  </h3>
                  <OrderBook bondId={selectedBond.id} />
                </div>
              </div>
            ) : (
              <div className="card text-center py-12">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Select a Bond
                </h3>
                <p className="text-gray-600">
                  Choose a bond from the list to view details and start trading
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
