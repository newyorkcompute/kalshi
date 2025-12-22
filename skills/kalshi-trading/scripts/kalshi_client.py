#!/usr/bin/env python3
"""
Kalshi API Client

A ready-to-use client for interacting with Kalshi prediction markets.
This script can be executed directly or imported as a module.

Usage:
    # As a script - list open markets
    python kalshi_client.py markets --limit 10
    
    # As a script - get specific market
    python kalshi_client.py market PRES-2024-DEM
    
    # As a module
    from kalshi_client import KalshiClient
    client = KalshiClient()
    markets = client.get_markets(limit=10)
"""

import os
import sys
import time
import json
import base64
import argparse
from typing import Optional, Dict, List, Any

try:
    import requests
    from cryptography.hazmat.primitives import hashes, serialization
    from cryptography.hazmat.primitives.asymmetric import padding
except ImportError:
    print("Required packages not installed. Run:")
    print("  pip install requests cryptography")
    sys.exit(1)


class KalshiClient:
    """Client for Kalshi Trade API v2."""
    
    DEFAULT_BASE_URL = "https://api.elections.kalshi.com/trade-api/v2"
    DEMO_BASE_URL = "https://demo-api.kalshi.co/trade-api/v2"
    
    def __init__(
        self,
        api_key: Optional[str] = None,
        private_key_pem: Optional[str] = None,
        base_url: Optional[str] = None,
        demo: bool = False
    ):
        """
        Initialize Kalshi client.
        
        Args:
            api_key: Kalshi API key ID (or set KALSHI_API_KEY env var)
            private_key_pem: RSA private key in PEM format (or set KALSHI_PRIVATE_KEY)
            base_url: API base URL (default: production)
            demo: Use demo environment instead of production
        """
        self.api_key = api_key or os.environ.get("KALSHI_API_KEY")
        self.private_key_pem = private_key_pem or os.environ.get("KALSHI_PRIVATE_KEY")
        
        if demo:
            self.base_url = self.DEMO_BASE_URL
        else:
            self.base_url = base_url or self.DEFAULT_BASE_URL
        
        self._private_key = None
        if self.private_key_pem:
            self._private_key = serialization.load_pem_private_key(
                self.private_key_pem.encode(),
                password=None
            )
    
    def _get_auth_headers(self, method: str, path: str) -> Dict[str, str]:
        """Generate authenticated headers."""
        if not self.api_key or not self._private_key:
            raise ValueError("API key and private key required for authenticated requests")
        
        timestamp = str(int(time.time() * 1000))
        message = f"{timestamp}{method}{path}"
        
        signature = self._private_key.sign(
            message.encode(),
            padding.PKCS1v15(),
            hashes.SHA256()
        )
        
        return {
            "KALSHI-ACCESS-KEY": self.api_key,
            "KALSHI-ACCESS-SIGNATURE": base64.b64encode(signature).decode(),
            "KALSHI-ACCESS-TIMESTAMP": timestamp,
            "Content-Type": "application/json"
        }
    
    def _request(
        self,
        method: str,
        path: str,
        params: Optional[Dict] = None,
        json_data: Optional[Dict] = None,
        authenticated: bool = False
    ) -> Dict[str, Any]:
        """Make API request."""
        url = f"{self.base_url}{path}"
        headers = {"Content-Type": "application/json"}
        
        if authenticated:
            headers = self._get_auth_headers(method, path)
        
        response = requests.request(
            method=method,
            url=url,
            headers=headers,
            params=params,
            json=json_data
        )
        
        response.raise_for_status()
        return response.json()
    
    # ==================== Public Endpoints ====================
    
    def get_markets(
        self,
        limit: int = 100,
        status: str = "open",
        cursor: Optional[str] = None,
        event_ticker: Optional[str] = None
    ) -> List[Dict]:
        """Get list of markets."""
        params = {"limit": limit, "status": status}
        if cursor:
            params["cursor"] = cursor
        if event_ticker:
            params["event_ticker"] = event_ticker
        
        result = self._request("GET", "/markets", params=params)
        return result.get("markets", [])
    
    def get_market(self, ticker: str) -> Dict:
        """Get details for a specific market."""
        result = self._request("GET", f"/markets/{ticker}")
        return result.get("market", {})
    
    def get_orderbook(self, ticker: str, depth: Optional[int] = None) -> Dict:
        """Get orderbook for a market."""
        params = {}
        if depth:
            params["depth"] = depth
        result = self._request("GET", f"/markets/{ticker}/orderbook", params=params)
        return result.get("orderbook", {})
    
    def get_trades(
        self,
        ticker: str,
        limit: int = 100,
        cursor: Optional[str] = None
    ) -> List[Dict]:
        """Get recent trades for a market."""
        params = {"limit": limit}
        if cursor:
            params["cursor"] = cursor
        result = self._request("GET", f"/markets/{ticker}/trades", params=params)
        return result.get("trades", [])
    
    def get_events(
        self,
        limit: int = 100,
        status: str = "open",
        cursor: Optional[str] = None
    ) -> List[Dict]:
        """Get list of events."""
        params = {"limit": limit, "status": status}
        if cursor:
            params["cursor"] = cursor
        result = self._request("GET", "/events", params=params)
        return result.get("events", [])
    
    def get_event(self, event_ticker: str) -> Dict:
        """Get details for a specific event."""
        result = self._request("GET", f"/events/{event_ticker}")
        return result.get("event", {})
    
    # ==================== Authenticated Endpoints ====================
    
    def get_balance(self) -> Dict:
        """Get account balance (requires authentication)."""
        return self._request("GET", "/portfolio/balance", authenticated=True)
    
    def get_positions(
        self,
        ticker: Optional[str] = None,
        settlement_status: str = "unsettled"
    ) -> List[Dict]:
        """Get current positions (requires authentication)."""
        params = {"settlement_status": settlement_status}
        if ticker:
            params["ticker"] = ticker
        result = self._request("GET", "/portfolio/positions", params=params, authenticated=True)
        return result.get("market_positions", [])
    
    def get_orders(
        self,
        ticker: Optional[str] = None,
        status: str = "resting"
    ) -> List[Dict]:
        """Get orders (requires authentication)."""
        params = {"status": status}
        if ticker:
            params["ticker"] = ticker
        result = self._request("GET", "/portfolio/orders", params=params, authenticated=True)
        return result.get("orders", [])
    
    def create_order(
        self,
        ticker: str,
        side: str,
        action: str,
        count: int,
        price: int,
        order_type: str = "limit"
    ) -> Dict:
        """
        Create an order (requires authentication).
        
        Args:
            ticker: Market ticker
            side: "yes" or "no"
            action: "buy" or "sell"
            count: Number of contracts
            price: Price in cents (1-99)
            order_type: "limit" or "market"
        """
        payload = {
            "ticker": ticker,
            "side": side,
            "action": action,
            "type": order_type,
            "count": count
        }
        
        if order_type == "limit":
            if side == "yes":
                payload["yes_price"] = price
            else:
                payload["no_price"] = price
        
        result = self._request("POST", "/portfolio/orders", json_data=payload, authenticated=True)
        return result.get("order", {})
    
    def cancel_order(self, order_id: str) -> Dict:
        """Cancel an order (requires authentication)."""
        result = self._request("DELETE", f"/portfolio/orders/{order_id}", authenticated=True)
        return result.get("order", {})


def main():
    """CLI entry point."""
    parser = argparse.ArgumentParser(description="Kalshi API Client")
    subparsers = parser.add_subparsers(dest="command", help="Available commands")
    
    # Markets command
    markets_parser = subparsers.add_parser("markets", help="List markets")
    markets_parser.add_argument("--limit", type=int, default=10, help="Number of results")
    markets_parser.add_argument("--status", default="open", help="Market status filter")
    
    # Market command
    market_parser = subparsers.add_parser("market", help="Get market details")
    market_parser.add_argument("ticker", help="Market ticker")
    
    # Orderbook command
    orderbook_parser = subparsers.add_parser("orderbook", help="Get orderbook")
    orderbook_parser.add_argument("ticker", help="Market ticker")
    
    # Balance command
    subparsers.add_parser("balance", help="Get account balance (requires auth)")
    
    # Positions command
    subparsers.add_parser("positions", help="Get positions (requires auth)")
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    client = KalshiClient()
    
    if args.command == "markets":
        result = client.get_markets(limit=args.limit, status=args.status)
        for market in result:
            print(f"{market['ticker']}: {market['title']}")
            print(f"  Yes: {market.get('yes_bid', 'N/A')}¢ - {market.get('yes_ask', 'N/A')}¢")
            print()
    
    elif args.command == "market":
        result = client.get_market(args.ticker)
        print(json.dumps(result, indent=2))
    
    elif args.command == "orderbook":
        result = client.get_orderbook(args.ticker)
        print(json.dumps(result, indent=2))
    
    elif args.command == "balance":
        result = client.get_balance()
        balance_dollars = result.get("balance", 0) / 100
        print(f"Balance: ${balance_dollars:.2f}")
    
    elif args.command == "positions":
        result = client.get_positions()
        for pos in result:
            print(f"{pos['ticker']}: {pos['position']} contracts")


if __name__ == "__main__":
    main()

