import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { z } from "zod";

const GetBalanceSchema = z.object({});

export function registerGetBalance(
  server: McpServer,
  portfolioApi: PortfolioApi
) {
  server.tool(
    "get_balance",
    "Get your Kalshi account balance and portfolio value. Returns balance in dollars.",
    GetBalanceSchema.shape,
    async () => {
      try {
        const response = await portfolioApi.getBalance();
        const data = response.data;

        // Convert cents to dollars
        const balanceDollars = (data.balance || 0) / 100;
        const portfolioValueDollars = (data.portfolio_value || 0) / 100;

        const result = {
          balance_dollars: balanceDollars.toFixed(2),
          portfolio_value_dollars: portfolioValueDollars.toFixed(2),
          balance_cents: data.balance,
          portfolio_value_cents: data.portfolio_value,
        };

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error occurred";
        return {
          content: [
            {
              type: "text" as const,
              text: `Error fetching balance: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  );
}

