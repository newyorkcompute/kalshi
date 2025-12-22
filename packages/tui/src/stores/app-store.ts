import { create } from "zustand";

interface AppState {
  // Selected market ticker
  selectedMarket: string | null;
  setSelectedMarket: (ticker: string | null) => void;

  // Active panel for keyboard navigation
  activePanel: "markets" | "orderbook" | "positions" | "order";
  setActivePanel: (panel: AppState["activePanel"]) => void;

  // Help modal visibility
  showHelp: boolean;
  toggleHelp: () => void;

  // Search state
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isSearching: boolean;
  setIsSearching: (searching: boolean) => void;

  // Connection status
  isConnected: boolean;
  setIsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  // Selected market
  selectedMarket: null,
  setSelectedMarket: (ticker) => set({ selectedMarket: ticker }),

  // Active panel
  activePanel: "markets",
  setActivePanel: (panel) => set({ activePanel: panel }),

  // Help modal
  showHelp: false,
  toggleHelp: () => set((state) => ({ showHelp: !state.showHelp })),

  // Search
  searchQuery: "",
  setSearchQuery: (query) => set({ searchQuery: query }),
  isSearching: false,
  setIsSearching: (searching) => set({ isSearching: searching }),

  // Connection
  isConnected: false,
  setIsConnected: (connected) => set({ isConnected: connected }),
}));

