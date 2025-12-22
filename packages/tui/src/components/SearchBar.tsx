import React from "react";
import { Box, Text, useInput } from "ink";
import { TextInput } from "@inkjs/ui";
import { useAppStore } from "../stores/app-store.js";

/**
 * Search bar for filtering markets
 */
export function SearchBar() {
  const isSearching = useAppStore((state) => state.isSearching);
  const setIsSearching = useAppStore((state) => state.setIsSearching);
  const searchQuery = useAppStore((state) => state.searchQuery);
  const setSearchQuery = useAppStore((state) => state.setSearchQuery);

  // Toggle search with /
  useInput((input, key) => {
    if (!isSearching && input === "/") {
      setIsSearching(true);
    }
    if (isSearching && key.escape) {
      setIsSearching(false);
      setSearchQuery("");
    }
  });

  if (!isSearching && !searchQuery) return null;

  return (
    <Box borderStyle="single" borderColor="green" paddingX={1}>
      <Text color="green">/</Text>
      <Text> </Text>
      {isSearching ? (
        <TextInput
          defaultValue={searchQuery}
          onChange={setSearchQuery}
          onSubmit={() => setIsSearching(false)}
          placeholder="Search markets..."
        />
      ) : (
        <Text color="white">{searchQuery}</Text>
      )}
      {searchQuery && (
        <Text color="gray" dimColor>
          {" "}
          (Esc to clear)
        </Text>
      )}
    </Box>
  );
}

