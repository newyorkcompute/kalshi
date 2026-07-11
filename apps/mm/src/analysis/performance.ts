import { readdirSync, readFileSync } from "fs";
import { join } from "path";

export const DEFAULT_LOGS_DIR = join(process.cwd(), "logs");

export interface FillRecord {
  type: string;
  sessionId: string;
  timestamp: string;
  ticker: string;
  action: "buy" | "sell";
  side: "yes" | "no";
  count: number;
  price: number;
  isTaker: boolean;
  realizedPnL: number;
  sessionPnL: number;
  orderId?: string;
  fee?: number;
}

export interface SettlementRecord {
  ticker: string;
  marketResult: "yes" | "no" | string;
  yesCount: number;
  yesTotalCost: number;
  noCount: number;
  noTotalCost: number;
  revenue: number;
  settledTime: string;
}

export type CloseReason = "fills" | "settlement" | "open";

export interface RoundTrip {
  ticker: string;
  category: string;
  entryPriceCents: number;
  entryBucket: string;
  contracts: number;
  pnlCents: number;
  closeReason: CloseReason;
  openedAt: string;
  closedAt: string;
}

export interface BucketStats {
  bucket: string;
  markets: number;
  winRate: number;
  avgWinCents: number;
  avgLossCents: number;
  expectancyPerMarketCents: number;
  totalPnlCents: number;
}

export interface CategoryStats {
  category: string;
  markets: number;
  winRate: number;
  avgWinCents: number;
  avgLossCents: number;
  expectancyPerMarketCents: number;
  totalPnlCents: number;
}

export interface OverallStats {
  marketsTraded: number;
  winRate: number;
  avgWinCents: number;
  avgLossCents: number;
  expectancyPerMarketCents: number;
  expectancyPerContractCents: number;
  totalRealizedPnlCents: number;
  totalFeesCents: number;
  totalContracts: number;
}

export interface PerformanceReport {
  overall: OverallStats;
  byCategory: CategoryStats[];
  byEntryBucket: BucketStats[];
  topWins: Array<{ ticker: string; pnlCents: number }>;
  topLosses: Array<{ ticker: string; pnlCents: number }>;
  roundTrips: RoundTrip[];
  fillsLoaded: number;
  settlementsLoaded: number;
  warnings: string[];
}

interface Position {
  yes: number;
  no: number;
}

interface RoundTripBuilder {
  ticker: string;
  openedAt: string;
  closedAt: string;
  entryContracts: number;
  entryValue: number;
  realizedPnL: number;
  maxAbsExposure: number;
}

export function parseFillLogLine(line: string): FillRecord | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    if (raw.type !== "fill") return null;

    const ticker = String(raw.ticker ?? "");
    const action = raw.action;
    const side = raw.side;
    if (!ticker || (action !== "buy" && action !== "sell")) return null;
    if (side !== "yes" && side !== "no") return null;

    const count = Number(raw.count);
    const price = Number(raw.price);
    if (!Number.isFinite(count) || !Number.isFinite(price) || count <= 0) {
      return null;
    }

    const realized =
      raw.realizedPnL ?? raw.realizedFromFill ?? raw.realized_pnl ?? 0;

    return {
      type: "fill",
      sessionId: String(raw.sessionId ?? ""),
      timestamp: String(raw.timestamp ?? ""),
      ticker,
      action,
      side,
      count,
      price,
      isTaker: Boolean(raw.isTaker),
      realizedPnL: Number(realized) || 0,
      sessionPnL: Number(raw.sessionPnL ?? 0) || 0,
      orderId: raw.orderId ? String(raw.orderId) : undefined,
      fee: raw.fee !== undefined ? Number(raw.fee) || 0 : undefined,
    };
  } catch {
    return null;
  }
}

export function loadFillsFromDir(
  logsDir: string,
  since?: Date,
): { fills: FillRecord[]; filesRead: number } {
  let files: string[];
  try {
    files = readdirSync(logsDir).filter((f) => f.startsWith("fills-") && f.endsWith(".jsonl"));
  } catch {
    return { fills: [], filesRead: 0 };
  }

  const fills: FillRecord[] = [];
  for (const file of files.sort()) {
    const content = readFileSync(join(logsDir, file), "utf8");
    for (const line of content.split("\n")) {
      const fill = parseFillLogLine(line);
      if (!fill) continue;
      if (since && fill.timestamp) {
        const ts = Date.parse(fill.timestamp);
        if (Number.isFinite(ts) && ts < since.getTime()) continue;
      }
      fills.push(fill);
    }
  }

  return { fills, filesRead: files.length };
}

export function classifyMarketCategory(ticker: string): string {
  const upper = ticker.toUpperCase();
  const segments = ticker.split("-");
  const strikePart = segments[segments.length - 1] ?? "";

  if (upper.startsWith("KXHIGH") || upper.startsWith("KXLOWT")) {
    if (strikePart.toUpperCase().startsWith("B")) {
      return "weather-threshold-bracket";
    }
    if (strikePart.toUpperCase().startsWith("T")) {
      return "weather-threshold-strike";
    }
    return "weather-threshold";
  }

  return segments[0] ?? ticker;
}

export function entryPriceBucket(priceCents: number): string {
  if (priceCents <= 10) return "1-10¢";
  if (priceCents <= 30) return "11-30¢";
  if (priceCents <= 70) return "31-70¢";
  if (priceCents <= 90) return "71-90¢";
  return "91-99¢";
}

function netExposure(position: Position): number {
  return position.yes - position.no;
}

function absExposure(position: Position): number {
  return Math.abs(position.yes) + Math.abs(position.no);
}

function applyFill(position: Position, fill: FillRecord): void {
  const delta = fill.action === "buy" ? fill.count : -fill.count;
  if (fill.side === "yes") {
    position.yes += delta;
  } else {
    position.no += delta;
  }
}

function isOpeningFill(before: Position, fill: FillRecord): boolean {
  const beforeAbs = absExposure(before);
  const after = { yes: before.yes, no: before.no };
  applyFill(after, fill);
  return absExposure(after) > beforeAbs;
}

function finalizeRoundTrip(builder: RoundTripBuilder, closeReason: CloseReason): RoundTrip {
  const entryPrice =
    builder.entryContracts > 0
      ? Math.round(builder.entryValue / builder.entryContracts)
      : 0;

  return {
    ticker: builder.ticker,
    category: classifyMarketCategory(builder.ticker),
    entryPriceCents: entryPrice,
    entryBucket: entryPriceBucket(entryPrice),
    contracts: builder.maxAbsExposure,
    pnlCents: builder.realizedPnL,
    closeReason,
    openedAt: builder.openedAt,
    closedAt: builder.closedAt,
  };
}

export function reconstructRoundTrips(
  fills: FillRecord[],
  settlements: SettlementRecord[],
): RoundTrip[] {
  const settlementByTicker = new Map<string, SettlementRecord>();
  for (const s of settlements) {
    settlementByTicker.set(s.ticker, s);
  }

  const byTicker = new Map<string, FillRecord[]>();
  for (const fill of fills) {
    const list = byTicker.get(fill.ticker) ?? [];
    list.push(fill);
    byTicker.set(fill.ticker, list);
  }

  const roundTrips: RoundTrip[] = [];

  for (const [ticker, tickerFills] of byTicker) {
    const sorted = [...tickerFills].sort((a, b) =>
      a.timestamp.localeCompare(b.timestamp),
    );
    const position: Position = { yes: 0, no: 0 };
    let builder: RoundTripBuilder | null = null;

    for (const fill of sorted) {
      const before = { yes: position.yes, no: position.no };
      const beforeNet = netExposure(before);

      if (!builder && beforeNet === 0) {
        builder = {
          ticker,
          openedAt: fill.timestamp,
          closedAt: fill.timestamp,
          entryContracts: 0,
          entryValue: 0,
          realizedPnL: 0,
          maxAbsExposure: 0,
        };
      }

      if (builder && isOpeningFill(before, fill)) {
        builder.entryContracts += fill.count;
        builder.entryValue += fill.price * fill.count;
      }

      applyFill(position, fill);

      if (builder) {
        builder.realizedPnL += fill.realizedPnL;
        builder.closedAt = fill.timestamp;
        builder.maxAbsExposure = Math.max(
          builder.maxAbsExposure,
          absExposure(position),
        );
      }

      if (builder && netExposure(position) === 0) {
        roundTrips.push(finalizeRoundTrip(builder, "fills"));
        builder = null;
      }
    }

    if (builder) {
      const settlement = settlementByTicker.get(ticker);
      if (settlement) {
        const settlementPnl =
          settlement.revenue -
          settlement.yesTotalCost -
          settlement.noTotalCost;
        builder.realizedPnL = settlementPnl;
        builder.closedAt = settlement.settledTime || builder.closedAt;
        roundTrips.push(finalizeRoundTrip(builder, "settlement"));
      } else if (netExposure(position) !== 0) {
        roundTrips.push(finalizeRoundTrip(builder, "open"));
      }
    }
  }

  for (const settlement of settlements) {
    if (byTicker.has(settlement.ticker)) continue;
    const settlementPnl =
      settlement.revenue -
      settlement.yesTotalCost -
      settlement.noTotalCost;
    roundTrips.push({
      ticker: settlement.ticker,
      category: classifyMarketCategory(settlement.ticker),
      entryPriceCents: 0,
      entryBucket: entryPriceBucket(0),
      contracts:
        settlement.yesCount + settlement.noCount,
      pnlCents: settlementPnl,
      closeReason: "settlement",
      openedAt: settlement.settledTime,
      closedAt: settlement.settledTime,
    });
  }

  return roundTrips.sort((a, b) => a.closedAt.localeCompare(b.closedAt));
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function summarizeGroup(trips: RoundTrip[]): {
  markets: number;
  winRate: number;
  avgWinCents: number;
  avgLossCents: number;
  expectancyPerMarketCents: number;
  totalPnlCents: number;
} {
  const wins = trips.filter((t) => t.pnlCents > 0);
  const losses = trips.filter((t) => t.pnlCents < 0);
  const totalPnl = trips.reduce((sum, t) => sum + t.pnlCents, 0);

  return {
    markets: trips.length,
    winRate: trips.length > 0 ? wins.length / trips.length : 0,
    avgWinCents: wins.length > 0 ? mean(wins.map((t) => t.pnlCents)) : 0,
    avgLossCents: losses.length > 0 ? mean(losses.map((t) => t.pnlCents)) : 0,
    expectancyPerMarketCents: trips.length > 0 ? totalPnl / trips.length : 0,
    totalPnlCents: totalPnl,
  };
}

export function buildPerformanceReport(
  fills: FillRecord[],
  settlements: SettlementRecord[],
  warnings: string[] = [],
): PerformanceReport {
  const closedTrips = reconstructRoundTrips(fills, settlements).filter(
    (t) => t.closeReason !== "open",
  );

  const overallGroup = summarizeGroup(closedTrips);
  const totalContracts = closedTrips.reduce((sum, t) => sum + t.contracts, 0);
  const totalFees = fills.reduce((sum, f) => sum + (f.fee ?? 0), 0);

  const byCategoryMap = new Map<string, RoundTrip[]>();
  const byBucketMap = new Map<string, RoundTrip[]>();
  for (const trip of closedTrips) {
    const catList = byCategoryMap.get(trip.category) ?? [];
    catList.push(trip);
    byCategoryMap.set(trip.category, catList);

    const bucketList = byBucketMap.get(trip.entryBucket) ?? [];
    bucketList.push(trip);
    byBucketMap.set(trip.entryBucket, bucketList);
  }

  const byCategory: CategoryStats[] = [...byCategoryMap.entries()]
    .map(([category, trips]) => ({ category, ...summarizeGroup(trips) }))
    .sort((a, b) => b.markets - a.markets);

  const bucketOrder = ["1-10¢", "11-30¢", "31-70¢", "71-90¢", "91-99¢"];
  const byEntryBucket: BucketStats[] = [...byBucketMap.entries()]
    .map(([bucket, trips]) => ({ bucket, ...summarizeGroup(trips) }))
    .sort(
      (a, b) => bucketOrder.indexOf(a.bucket) - bucketOrder.indexOf(b.bucket),
    );

  const sortedByPnl = [...closedTrips].sort((a, b) => b.pnlCents - a.pnlCents);

  return {
    overall: {
      marketsTraded: overallGroup.markets,
      winRate: overallGroup.winRate,
      avgWinCents: overallGroup.avgWinCents,
      avgLossCents: overallGroup.avgLossCents,
      expectancyPerMarketCents: overallGroup.expectancyPerMarketCents,
      expectancyPerContractCents:
        totalContracts > 0 ? overallGroup.totalPnlCents / totalContracts : 0,
      totalRealizedPnlCents: overallGroup.totalPnlCents,
      totalFeesCents: totalFees,
      totalContracts,
    },
    byCategory,
    byEntryBucket,
    topWins: sortedByPnl
      .filter((t) => t.pnlCents > 0)
      .slice(0, 10)
      .map((t) => ({ ticker: t.ticker, pnlCents: t.pnlCents })),
    topLosses: sortedByPnl
      .filter((t) => t.pnlCents < 0)
      .slice(-10)
      .reverse()
      .map((t) => ({ ticker: t.ticker, pnlCents: t.pnlCents })),
    roundTrips: closedTrips,
    fillsLoaded: fills.length,
    settlementsLoaded: settlements.length,
    warnings,
  };
}

export function formatCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}$${(abs / 100).toFixed(2)}`;
}

export function formatPercent(rate: number): string {
  return `${(rate * 100).toFixed(1)}%`;
}

function pad(value: string, width: number): string {
  return value.length >= width ? value : value + " ".repeat(width - value.length);
}

export function formatReportTables(report: PerformanceReport): string {
  const lines: string[] = [];

  if (report.warnings.length > 0) {
    lines.push("Warnings:");
    for (const w of report.warnings) {
      lines.push(`  - ${w}`);
    }
    lines.push("");
  }

  lines.push(
    `Loaded ${report.fillsLoaded} fills, ${report.settlementsLoaded} settlements`,
  );
  lines.push("");

  lines.push("=== Overall ===");
  const o = report.overall;
  lines.push(`Markets traded:          ${o.marketsTraded}`);
  lines.push(`Win rate:                ${formatPercent(o.winRate)}`);
  lines.push(`Avg win:                 ${formatCents(o.avgWinCents)}`);
  lines.push(`Avg loss:                ${formatCents(o.avgLossCents)}`);
  lines.push(`Expectancy / market:     ${formatCents(o.expectancyPerMarketCents)}`);
  lines.push(`Expectancy / contract:   ${formatCents(o.expectancyPerContractCents)}`);
  lines.push(`Total realized P&L:      ${formatCents(o.totalRealizedPnlCents)}`);
  lines.push(`Total fees:              ${formatCents(o.totalFeesCents)}`);
  lines.push("");

  lines.push("=== By Market Category ===");
  const catHeader = [
    pad("Category", 28),
    pad("Mkts", 6),
    pad("Win%", 8),
    pad("E[mk]", 10),
    pad("Total P&L", 12),
  ].join("");
  lines.push(catHeader);
  for (const row of report.byCategory) {
    lines.push(
      [
        pad(row.category, 28),
        pad(String(row.markets), 6),
        pad(formatPercent(row.winRate), 8),
        pad(formatCents(row.expectancyPerMarketCents), 10),
        pad(formatCents(row.totalPnlCents), 12),
      ].join(""),
    );
  }
  lines.push("");

  lines.push("=== By Entry Price Bucket ===");
  const bucketHeader = [
    pad("Bucket", 28),
    pad("Mkts", 6),
    pad("Win%", 8),
    pad("E[mk]", 10),
    pad("Total P&L", 12),
  ].join("");
  lines.push(bucketHeader);
  for (const row of report.byEntryBucket) {
    lines.push(
      [
        pad(row.bucket, 28),
        pad(String(row.markets), 6),
        pad(formatPercent(row.winRate), 8),
        pad(formatCents(row.expectancyPerMarketCents), 10),
        pad(formatCents(row.totalPnlCents), 12),
      ].join(""),
    );
  }
  lines.push("");

  lines.push("=== Top 10 Wins ===");
  for (const w of report.topWins) {
    lines.push(`  ${w.ticker}: ${formatCents(w.pnlCents)}`);
  }
  lines.push("");

  lines.push("=== Top 10 Losses ===");
  for (const l of report.topLosses) {
    lines.push(`  ${l.ticker}: ${formatCents(l.pnlCents)}`);
  }

  return lines.join("\n");
}

export function normalizeSettlement(raw: {
  ticker?: string;
  market_result?: string;
  yes_count?: number;
  yes_total_cost?: number;
  no_count?: number;
  no_total_cost?: number;
  revenue?: number;
  settled_time?: string;
}): SettlementRecord | null {
  if (!raw.ticker) return null;
  return {
    ticker: raw.ticker,
    marketResult: raw.market_result ?? "",
    yesCount: raw.yes_count ?? 0,
    yesTotalCost: raw.yes_total_cost ?? 0,
    noCount: raw.no_count ?? 0,
    noTotalCost: raw.no_total_cost ?? 0,
    revenue: raw.revenue ?? 0,
    settledTime: raw.settled_time ?? "",
  };
}
