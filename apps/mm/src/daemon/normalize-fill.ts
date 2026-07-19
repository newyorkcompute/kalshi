/**
 * Normalize Kalshi fill payloads (REST / WebSocket).
 * New API fields use count_fp and *_price_dollars; legacy integer fields are often absent.
 */

export interface RawFillData {
  order_id: string;
  market_ticker?: string;
  ticker?: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count?: number;
  count_fp?: string | number;
  yes_price?: number;
  no_price?: number;
  yes_price_dollars?: string | number;
  no_price_dollars?: string | number;
  created_time?: string;
  is_taker?: boolean;
  trade_id?: string;
  fill_id?: string;
}

export interface NormalizedFill {
  orderId: string;
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  count: number;
  priceCents: number;
  yesPriceCents: number;
  noPriceCents: number;
}

/** Price in cents from legacy cents field or dollar string/number. */
export function fillPriceCents(
  cents: number | undefined,
  dollars: string | number | undefined
): number {
  if (cents != null && Number.isFinite(cents)) {
    return cents;
  }
  if (dollars === undefined || dollars === "") {
    return NaN;
  }
  const parsed = typeof dollars === "string" ? parseFloat(dollars) : dollars;
  if (!Number.isFinite(parsed)) {
    return NaN;
  }
  return Math.round(parsed * 100);
}

export function normalizeFillCount(
  count?: number,
  count_fp?: string | number
): number {
  if (count_fp != null && count_fp !== "") {
    const parsed =
      typeof count_fp === "string" ? parseFloat(count_fp) : count_fp;
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (count != null && Number.isFinite(count)) {
    return count;
  }
  return NaN;
}

/**
 * Returns normalized fill fields, or null if count/price are missing or invalid.
 */
export function normalizeFill(data: RawFillData): NormalizedFill | null {
  const count = normalizeFillCount(data.count, data.count_fp);
  const yesPriceCents = fillPriceCents(
    data.yes_price,
    data.yes_price_dollars
  );
  const noPriceCents = fillPriceCents(data.no_price, data.no_price_dollars);
  const priceCents = data.side === "yes" ? yesPriceCents : noPriceCents;

  if (!Number.isFinite(count) || count <= 0) {
    return null;
  }
  if (!Number.isFinite(priceCents) || priceCents <= 0) {
    return null;
  }

  const ticker = data.market_ticker || data.ticker || "";
  if (!ticker) {
    return null;
  }

  return {
    orderId: data.order_id,
    ticker,
    side: data.side,
    action: data.action,
    count,
    priceCents,
    yesPriceCents,
    noPriceCents,
  };
}

export interface RawMarketPosition {
  ticker: string;
  position?: number;
  position_fp?: string | number;
  market_exposure?: number;
  market_exposure_dollars?: string | number;
}

export interface NormalizedMarketPosition {
  ticker: string;
  /** Signed contracts: positive = YES, negative = NO */
  position: number;
  /** Absolute exposure in cents (for cost basis) */
  exposureCents: number;
}

export function normalizeMarketPosition(
  p: RawMarketPosition
): NormalizedMarketPosition {
  let position: number;
  if (p.position_fp != null && p.position_fp !== "") {
    const parsed =
      typeof p.position_fp === "string"
        ? parseFloat(p.position_fp)
        : p.position_fp;
    position = Number.isFinite(parsed) ? parsed : (p.position ?? 0);
  } else {
    position = p.position ?? 0;
  }

  let exposureCents: number;
  if (
    p.market_exposure_dollars != null &&
    p.market_exposure_dollars !== ""
  ) {
    const dollars =
      typeof p.market_exposure_dollars === "string"
        ? parseFloat(p.market_exposure_dollars)
        : p.market_exposure_dollars;
    exposureCents = Number.isFinite(dollars)
      ? Math.round(Math.abs(dollars) * 100)
      : Math.abs(p.market_exposure ?? 0);
  } else {
    exposureCents = Math.abs(p.market_exposure ?? 0);
  }

  return { ticker: p.ticker, position, exposureCents };
}

export function isFiniteQuoteField(value: number): boolean {
  return Number.isFinite(value);
}
