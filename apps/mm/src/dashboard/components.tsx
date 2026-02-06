/**
 * Dashboard Components
 *
 * Sub-components for the MM bot terminal dashboard.
 */

import React from "react";
import { Text, Box } from "ink";
import type {
  BotState,
  BotMarketsResponse,
  BotMetrics,
  BotPosition,
  BotMarket,
} from "./useBot.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Shorten a Kalshi ticker for display */
function shortTicker(ticker: string): string {
  // KXBTCD-26FEB0617-T68249.99 → BTC>68249
  const btcMatch = ticker.match(/KXBTCD-.*-T(\d+)/);
  if (btcMatch) return `BTC>${btcMatch[1]}`;

  const ethMatch = ticker.match(/KXETHD-.*-T(\d+)/);
  if (ethMatch) return `ETH>${ethMatch[1]}`;

  // KXATPCHALLENGERMATCH-26FEB06BURBOS-BOS → ATP-BOS
  const atpMatch = ticker.match(/KXATP\w+-.*-(\w{2,4})$/);
  if (atpMatch) return `ATP-${atpMatch[1]}`;

  // KXNBA2D-... → NBA-...
  const nbaMatch = ticker.match(/KXNBA\w+-.*-(\w+)$/);
  if (nbaMatch) return `NBA-${nbaMatch[1]}`;

  // KXNFL... → NFL-...
  const nflMatch = ticker.match(/KXNFL\w+-.*-(\w+)$/);
  if (nflMatch) return `NFL-${nflMatch[1]}`;

  // KXPGA... → PGA-...
  const pgaMatch = ticker.match(/KXPGA\w+-.*-(\w+)$/);
  if (pgaMatch) return `PGA-${pgaMatch[1]}`;

  // HOUSE/SENATE → trim
  if (ticker.startsWith("HOUSE")) return ticker.slice(0, 15);
  if (ticker.startsWith("KXSENATE")) return ticker.slice(2, 18);

  // KXEARNINGS... → EARN-...
  const earnMatch = ticker.match(/KXEARNINGS\w+-.*-(\w+)$/);
  if (earnMatch) return `EARN-${earnMatch[1]}`;

  // Fallback: first 18 chars
  return ticker.length > 18 ? ticker.slice(0, 18) : ticker;
}

/** Format cents as dollar string */
function cents(c: number): string {
  const sign = c >= 0 ? "+" : "";
  return `${sign}${c}c ($${(c / 100).toFixed(2)})`;
}

/** Color for P&L value */
function pnlColor(v: number): string {
  if (v > 0) return "green";
  if (v < 0) return "red";
  return "white";
}

// ─── StatusBar ───────────────────────────────────────────────────────────────

interface StatusBarProps {
  state: BotState | null;
  online: boolean;
  lastUpdate: Date | null;
}

export function StatusBar({ state, online, lastUpdate }: StatusBarProps): React.ReactElement {
  const statusText = !online
    ? "OFFLINE"
    : state?.paused
      ? "PAUSED"
      : state?.running
        ? "RUNNING"
        : "STOPPED";

  const statusColor = !online
    ? "red"
    : state?.paused
      ? "yellow"
      : state?.running
        ? "green"
        : "red";

  const wsText = state?.connected ? "WS: OK" : "WS: --";
  const wsColor = state?.connected ? "green" : "red";

  const age = lastUpdate
    ? `${Math.round((Date.now() - lastUpdate.getTime()) / 1000)}s ago`
    : "--";

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text bold> MM Bot Dashboard </Text>
      <Box>
        <Text color={statusColor} bold>
          {statusText}
        </Text>
        <Text> | </Text>
        <Text color={wsColor}>{wsText}</Text>
        <Text> | </Text>
        <Text dimColor>{age}</Text>
      </Box>
    </Box>
  );
}

// ─── PnLBar ──────────────────────────────────────────────────────────────────

interface PnLBarProps {
  state: BotState | null;
  metrics: BotMetrics | null;
}

export function PnLBar({ state, metrics }: PnLBarProps): React.ReactElement {
  if (!state || !metrics) {
    return (
      <Box paddingX={1}>
        <Text dimColor>Waiting for data...</Text>
      </Box>
    );
  }

  const pnl = state.pnl;
  const risk = state.risk;
  const dd = state.drawdown;

  return (
    <Box paddingX={1} flexDirection="column">
      <Box>
        <Text>P&L: </Text>
        <Text color={pnlColor(pnl.realizedToday)} bold>
          {cents(pnl.realizedToday)}
        </Text>
        <Text>   Fills: </Text>
        <Text bold>{pnl.fillsToday}</Text>
        <Text>   Volume: </Text>
        <Text bold>{pnl.volumeToday}</Text>
        <Text> contracts</Text>
      </Box>
      <Box>
        <Text>Exposure: </Text>
        <Text bold>
          {risk.totalExposure}/{Math.round(risk.totalExposure / (risk.utilizationPercent / 100) || 0)}
        </Text>
        <Text> ({risk.utilizationPercent.toFixed(0)}%)</Text>
        <Text>   Orders: </Text>
        <Text bold>{metrics.activeOrders}</Text>
        <Text>   Drawdown: </Text>
        <Text color={dd.drawdown > 200 ? "red" : dd.drawdown > 50 ? "yellow" : "white"} bold>
          {dd.drawdown.toFixed(0)}c
        </Text>
        <Text>   Latency: </Text>
        <Text dimColor>p50={metrics.latency_p50}ms p95={metrics.latency_p95}ms</Text>
      </Box>
    </Box>
  );
}

// ─── PositionsPanel ──────────────────────────────────────────────────────────

interface PositionsPanelProps {
  positions: BotPosition[];
}

export function PositionsPanel({ positions }: PositionsPanelProps): React.ReactElement {
  const active = positions.filter((p) => p.netExposure !== 0);

  return (
    <Box flexDirection="column" width="55%">
      <Text bold underline>
        POSITIONS ({active.length})
      </Text>
      {active.length === 0 ? (
        <Text dimColor>  No open positions</Text>
      ) : (
        active.map((p) => {
          const dir = p.netExposure > 0 ? "L" : "S";
          const dirColor = p.netExposure > 0 ? "green" : "red";
          return (
            <Box key={p.ticker}>
              <Text>  </Text>
              <Text>{shortTicker(p.ticker).padEnd(16)}</Text>
              <Text color={dirColor} bold>
                {Math.abs(p.netExposure)}{dir}
              </Text>
              <Text>  cost:{p.costBasis}c</Text>
            </Box>
          );
        })
      )}
    </Box>
  );
}

// ─── RiskPanel ───────────────────────────────────────────────────────────────

interface RiskPanelProps {
  state: BotState;
}

export function RiskPanel({ state }: RiskPanelProps): React.ReactElement {
  const cb = state.circuitBreaker;
  const dd = state.drawdown;
  const risk = state.risk;

  const cbColor = cb.isTriggered ? "red" : "green";
  const cbText = cb.isTriggered ? `TRIGGERED (${cb.reason})` : "OK";

  return (
    <Box flexDirection="column" width="45%">
      <Text bold underline>
        RISK STATUS
      </Text>
      <Box>
        <Text>  Circuit Breaker: </Text>
        <Text color={cbColor} bold>{cbText}</Text>
      </Box>
      <Box>
        <Text>  Consec. Losses:  </Text>
        <Text color={cb.consecutiveLosses >= 3 ? "yellow" : "white"}>
          {cb.consecutiveLosses}
        </Text>
      </Box>
      <Box>
        <Text>  Drawdown:        </Text>
        <Text color={dd.drawdown > 200 ? "red" : dd.drawdown > 50 ? "yellow" : "white"}>
          {dd.drawdown.toFixed(0)}c
        </Text>
        <Text dimColor> (mult: {dd.positionMultiplier.toFixed(1)}x)</Text>
      </Box>
      <Box>
        <Text>  Daily Loss:      </Text>
        <Text color={Math.abs(risk.dailyPnL) > 300 ? "red" : "white"}>
          {Math.abs(risk.dailyPnL).toFixed(0)}/500c
        </Text>
      </Box>
      <Box>
        <Text>  Halted:          </Text>
        <Text color={risk.halted ? "red" : "green"}>
          {risk.halted ? `YES (${risk.haltReason})` : "No"}
        </Text>
      </Box>
      {state.scanner && (
        <Box>
          <Text>  Scanner:         </Text>
          <Text>{state.scanner.marketsFound} mkts</Text>
          {state.scanner.lastScan && (
            <Text dimColor>
              {" "}({Math.round((Date.now() - new Date(state.scanner.lastScan).getTime()) / 60000)}m ago)
            </Text>
          )}
        </Box>
      )}
    </Box>
  );
}

// ─── MarketsPanel ────────────────────────────────────────────────────────────

interface MarketsPanelProps {
  markets: BotMarketsResponse | null;
}

export function MarketsPanel({ markets }: MarketsPanelProps): React.ReactElement {
  if (!markets || markets.count === 0) {
    return (
      <Box flexDirection="column">
        <Text bold underline>
          ACTIVE MARKETS (0)
        </Text>
        <Text dimColor>  No active markets</Text>
      </Box>
    );
  }

  // Sort by fills descending, then by realized
  const sorted = [...markets.markets].sort(
    (a, b) => b.fills - a.fills || a.realized - b.realized,
  );

  return (
    <Box flexDirection="column">
      <Text bold underline>
        ACTIVE MARKETS ({markets.count})
      </Text>
      <Box>
        <Text dimColor>  {"Ticker".padEnd(18)} {"P&L".padStart(8)} {"Fills".padStart(6)}</Text>
      </Box>
      {sorted.map((m: BotMarket) => (
        <Box key={m.ticker}>
          <Text>  </Text>
          <Text>{shortTicker(m.ticker).padEnd(18)}</Text>
          <Text color={pnlColor(m.realized)}>
            {(m.realized >= 0 ? "+" : "") + m.realized + "c"}
          </Text>
          <Text>{"".padStart(Math.max(0, 8 - String(m.realized).length - 1))}</Text>
          <Text dimColor>  {m.fills} fills</Text>
        </Box>
      ))}
    </Box>
  );
}

// ─── HelpBar ─────────────────────────────────────────────────────────────────

export function HelpBar(): React.ReactElement {
  return (
    <Box paddingX={1} justifyContent="center">
      <Text dimColor>
        [p] pause  [r] resume  [f] flatten  [s] scan  [q] quit
      </Text>
    </Box>
  );
}

// ─── OfflineScreen ───────────────────────────────────────────────────────────

interface OfflineScreenProps {
  error: string | null;
  port: number;
}

export function OfflineScreen({ error, port }: OfflineScreenProps): React.ReactElement {
  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" padding={2}>
      <Text color="red" bold>
        Bot Offline
      </Text>
      <Text> </Text>
      <Text>Cannot connect to MM bot at localhost:{port}</Text>
      <Text dimColor>{error ?? "Connection refused"}</Text>
      <Text> </Text>
      <Text>Start the bot first:</Text>
      <Text color="cyan">  npx dotenv -e ../../.env.local -- npx tsx src/main.ts</Text>
      <Text> </Text>
      <Text dimColor>Retrying every 2 seconds... Press q to quit.</Text>
    </Box>
  );
}
