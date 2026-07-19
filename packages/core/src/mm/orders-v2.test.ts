import { describe, it, expect } from "vitest";
import {
  mapToYesBookOrder,
  toCreateOrderV2Request,
  statusFromV2Counts,
} from "./orders-v2.js";

describe("mapToYesBookOrder", () => {
  it("maps buy YES to bid at same dollars", () => {
    expect(mapToYesBookOrder("yes", "buy", 10)).toEqual({
      bookSide: "bid",
      priceDollars: "0.1000",
    });
  });

  it("maps sell YES to ask at same dollars", () => {
    expect(mapToYesBookOrder("yes", "sell", 61)).toEqual({
      bookSide: "ask",
      priceDollars: "0.6100",
    });
  });

  it("maps buy NO to ask at inverted dollars", () => {
    expect(mapToYesBookOrder("no", "buy", 39)).toEqual({
      bookSide: "ask",
      priceDollars: "0.6100",
    });
  });

  it("maps sell NO to bid at inverted dollars", () => {
    expect(mapToYesBookOrder("no", "sell", 39)).toEqual({
      bookSide: "bid",
      priceDollars: "0.6100",
    });
  });
});

describe("toCreateOrderV2Request", () => {
  it("builds a post-only GTC V2 body", () => {
    expect(
      toCreateOrderV2Request({
        ticker: "KXMENWORLDCUP-26-ES",
        side: "yes",
        action: "buy",
        priceCents: 10,
        count: 1,
        clientOrderId: "mm-test",
      })
    ).toEqual({
      ticker: "KXMENWORLDCUP-26-ES",
      client_order_id: "mm-test",
      side: "bid",
      count: "1.00",
      price: "0.1000",
      time_in_force: "good_till_canceled",
      self_trade_prevention_type: "taker_at_cross",
      post_only: true,
    });
  });
});

describe("statusFromV2Counts", () => {
  it("returns open when remaining > 0", () => {
    expect(statusFromV2Counts("0.00", "1.00")).toBe("open");
  });

  it("returns filled when fully filled", () => {
    expect(statusFromV2Counts("1.00", "0.00")).toBe("filled");
  });

  it("returns cancelled when nothing remains or fills", () => {
    expect(statusFromV2Counts("0.00", "0.00")).toBe("cancelled");
  });
});
