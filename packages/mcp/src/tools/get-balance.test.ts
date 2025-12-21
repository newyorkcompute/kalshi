import { describe, it, expect, vi, beforeEach } from "vitest";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { PortfolioApi } from "kalshi-typescript";
import { registerGetBalance } from "./get-balance.js";

vi.mock("kalshi-typescript", () => ({
  PortfolioApi: vi.fn(),
}));

describe("get_balance tool", () => {
  let server: McpServer;
  let mockPortfolioApi: { getBalance: ReturnType<typeof vi.fn> };
  let registeredTool: {
    name: string;
    handler: () => Promise<unknown>;
  };

  beforeEach(() => {
    server = {
      tool: vi.fn((_name, _desc, _schema, handler) => {
        registeredTool = { name: _name, handler };
      }),
    } as unknown as McpServer;

    mockPortfolioApi = {
      getBalance: vi.fn(),
    };

    registerGetBalance(server, mockPortfolioApi as unknown as PortfolioApi);
  });

  it("should register the get_balance tool", () => {
    expect(server.tool).toHaveBeenCalledWith(
      "get_balance",
      expect.any(String),
      expect.any(Object),
      expect.any(Function)
    );
  });

  it("should return formatted balance on success", async () => {
    mockPortfolioApi.getBalance.mockResolvedValue({
      data: {
        balance: 10050, // $100.50 in cents
        portfolio_value: 25000, // $250.00 in cents
      },
    });

    const result = await registeredTool.handler();

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.balance_dollars).toBe("100.50");
    expect(parsed.portfolio_value_dollars).toBe("250.00");
    expect(parsed.balance_cents).toBe(10050);
    expect(parsed.portfolio_value_cents).toBe(25000);
  });

  it("should handle zero balance", async () => {
    mockPortfolioApi.getBalance.mockResolvedValue({
      data: {
        balance: 0,
        portfolio_value: 0,
      },
    });

    const result = await registeredTool.handler();

    const parsed = JSON.parse(
      (result as { content: [{ text: string }] }).content[0].text
    );
    expect(parsed.balance_dollars).toBe("0.00");
    expect(parsed.portfolio_value_dollars).toBe("0.00");
  });

  it("should return error on API failure", async () => {
    mockPortfolioApi.getBalance.mockRejectedValue(
      new Error("Authentication failed")
    );

    const result = await registeredTool.handler();

    expect(result).toEqual({
      content: [
        {
          type: "text",
          text: "Error fetching balance: Authentication failed",
        },
      ],
      isError: true,
    });
  });
});

