import React, { useState } from "react";
import { Box, Text, useInput } from "ink";
import { formatPrice, formatCurrency } from "@newyorkcompute/kalshi-core";
import { useAppStore } from "../stores/app-store.js";
import { useKalshi } from "../hooks/useKalshi.js";

interface OrderEntryProps {
  ticker: string | null;
}

/**
 * Order entry form for placing trades
 */
export function OrderEntry({ ticker }: OrderEntryProps) {
  const { ordersApi } = useKalshi();
  const activePanel = useAppStore((state) => state.activePanel);
  const isActive = activePanel === "order";

  const [side, setSide] = useState<"yes" | "no">("yes");
  const [quantity, setQuantity] = useState(10);
  const [price, setPrice] = useState(50);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Calculate cost
  const cost = (quantity * price) / 100;

  // Handle keyboard input
  useInput(
    (input, key) => {
      if (!isActive || !ticker) return;

      // Toggle side with Tab
      if (key.tab) {
        setSide((s) => (s === "yes" ? "no" : "yes"));
      }

      // Adjust quantity with [ and ]
      if (input === "[") {
        setQuantity((q) => Math.max(1, q - 1));
      }
      if (input === "]") {
        setQuantity((q) => q + 1);
      }

      // Adjust price with - and +
      if (input === "-") {
        setPrice((p) => Math.max(1, p - 1));
      }
      if (input === "=" || input === "+") {
        setPrice((p) => Math.min(99, p + 1));
      }

      // Submit with Enter
      if (key.return && !isSubmitting) {
        handleSubmit();
      }
    },
    { isActive }
  );

  const handleSubmit = async () => {
    if (!ordersApi || !ticker) return;

    setIsSubmitting(true);
    setMessage(null);

    try {
      await ordersApi.createOrder({
        ticker,
        side: side === "yes" ? "yes" : "no",
        action: "buy",
        count: quantity,
        type: "limit",
        yes_price: side === "yes" ? price : undefined,
        no_price: side === "no" ? price : undefined,
      });

      setMessage({ type: "success", text: "Order placed successfully" });
    } catch (error) {
      setMessage({
        type: "error",
        text: error instanceof Error ? error.message : "Failed to place order",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={isActive ? "green" : "gray"}
      height={10}
    >
      {/* Panel header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text bold color={isActive ? "green" : "white"}>
          QUICK TRADE
        </Text>
        <Text color="gray" dimColor>
          [F4]
        </Text>
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Text color="gray">{"─".repeat(40)}</Text>
      </Box>

      {/* Content */}
      <Box flexDirection="column" paddingX={1} flexGrow={1}>
        {!ticker && (
          <Text color="gray">Select a market to trade</Text>
        )}

        {ticker && (
          <>
            {/* Ticker */}
            <Box>
              <Text color="gray">Ticker: </Text>
              <Text color="white">{ticker}</Text>
            </Box>

            {/* Side toggle */}
            <Box>
              <Text color="gray">Side: </Text>
              <Text
                color={side === "yes" ? "green" : "gray"}
                bold={side === "yes"}
                inverse={side === "yes"}
              >
                [YES]
              </Text>
              <Text> </Text>
              <Text
                color={side === "no" ? "red" : "gray"}
                bold={side === "no"}
                inverse={side === "no"}
              >
                [NO]
              </Text>
              <Text color="gray" dimColor>
                {" "}
                (Tab)
              </Text>
            </Box>

            {/* Quantity and Price */}
            <Box justifyContent="space-between">
              <Box>
                <Text color="gray">Qty: </Text>
                <Text color="white">{quantity}</Text>
                <Text color="gray" dimColor>
                  {" "}
                  ([/])
                </Text>
              </Box>
              <Box>
                <Text color="gray">Price: </Text>
                <Text color="white">{formatPrice(price)}</Text>
                <Text color="gray" dimColor>
                  {" "}
                  (-/+)
                </Text>
              </Box>
            </Box>

            {/* Cost and action */}
            <Box justifyContent="space-between" marginTop={1}>
              <Box>
                <Text color="gray">Cost: </Text>
                <Text color="white" bold>
                  {formatCurrency(cost * 100)}
                </Text>
              </Box>
              <Box>
                <Text
                  color={isSubmitting ? "gray" : "green"}
                  bold
                  inverse={!isSubmitting}
                >
                  {isSubmitting ? " PLACING... " : " [BUY] "}
                </Text>
              </Box>
            </Box>

            {/* Message */}
            {message && (
              <Box marginTop={1}>
                <Text color={message.type === "success" ? "green" : "red"}>
                  {message.text}
                </Text>
              </Box>
            )}
          </>
        )}
      </Box>
    </Box>
  );
}

