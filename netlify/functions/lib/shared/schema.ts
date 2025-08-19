import { z } from "zod";
import { pgTable, serial, text, real, integer, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";

export const tokenDataSchema = z.object({
  id: z.string(),
  name: z.string(),
  symbol: z.string(),
  contractAddress: z.string(),
  price: z.number(),
  priceChange24h: z.number(),
  priceChangePercent24h: z.number(),
  marketCap: z.number(),
  volume24h: z.number(),
  totalSupply: z.number(),
  circulatingSupply: z.number(),
  liquidity: z.number(),
  txCount24h: z.number(),
  network: z.string(),
  lastUpdated: z.string(),
});

export const transactionSchema = z.object({
  hash: z.string(),
  type: z.enum(['BUY', 'SELL', 'TRANSFER']),
  amount: z.number(),
  amountUSD: z.number(),
  from: z.string(),
  to: z.string(),
  timestamp: z.string(),
  gasUsed: z.number(),
  gasPrice: z.number(),
});

export const holderSchema = z.object({
  address: z.string(),
  balance: z.number(),
  percentage: z.number(),
  rank: z.number(),
});

export const networkStatusSchema = z.object({
  blockNumber: z.number(),
  gasPrice: z.number(),
  isHealthy: z.boolean(),
  lastBlockTime: z.string(),
});

export const priceHistorySchema = z.object({
  timestamp: z.number(),
  price: z.number(),
  volume: z.number(),
});

export const tokenConfigSchema = z.object({
  contractAddress: z.string(),
  operationsWallet: z.string(),
  buyFee: z.number(),
  sellFee: z.number(),
  liquidityFee: z.number(),
  operationsFee: z.number(),
  network: z.enum(['mainnet', 'testnet']),
});

export type TokenData = z.infer<typeof tokenDataSchema>;
export type Transaction = z.infer<typeof transactionSchema>;
export type Holder = z.infer<typeof holderSchema>;
export type NetworkStatus = z.infer<typeof networkStatusSchema>;
export type PriceHistory = z.infer<typeof priceHistorySchema>;
export type TokenConfig = z.infer<typeof tokenConfigSchema>;

// Database Tables
// Live Coin Watch table (must be defined before users table)
export const liveCoinWatchCoins = pgTable("live_coin_watch_coins", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  rate: real("rate").notNull(),
  volume: real("volume").notNull(),
  cap: real("cap"),
  deltaHour: real("delta_hour"),
  deltaDay: real("delta_day"),
  deltaWeek: real("delta_week"),
  deltaMonth: real("delta_month"),
  deltaQuarter: real("delta_quarter"),
  deltaYear: real("delta_year"),
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  username: text("username").notNull().unique(),
  walletAddress: text("wallet_address").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const trackedTokens = pgTable("tracked_tokens", {
  id: serial("id").primaryKey(),
  contractAddress: text("contract_address").notNull().unique(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  network: text("network").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const tokenSnapshots = pgTable("token_snapshots", {
  id: serial("id").primaryKey(),
  tokenId: integer("token_id").references(() => trackedTokens.id),
  price: real("price"),
  marketCap: real("market_cap"),
  volume24h: real("volume_24h"),
  liquidity: real("liquidity"),
  txCount24h: integer("tx_count_24h"),
  priceChange24h: real("price_change_24h"),
  priceChangePercent24h: real("price_change_percent_24h"),
  totalSupply: real("total_supply"),
  circulatingSupply: real("circulating_supply"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const userWatchlists = pgTable("user_watchlists", {
  id: serial("id").primaryKey(),
  userAddress: text("user_address").notNull(),
  tokenId: integer("token_id").references(() => trackedTokens.id),
  alerts: jsonb("alerts"), // Store price alerts and notification preferences
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert and Select Types
export const insertUserSchema = createInsertSchema(users).omit({ 
  id: true, 
  createdAt: true 
});

export const insertTrackedTokenSchema = createInsertSchema(trackedTokens).omit({ 
  id: true, 
  createdAt: true, 
  updatedAt: true 
});

export const insertTokenSnapshotSchema = createInsertSchema(tokenSnapshots).omit({ 
  id: true, 
  createdAt: true 
});

export const insertUserWatchlistSchema = createInsertSchema(userWatchlists).omit({ 
  id: true, 
  createdAt: true 
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type TrackedToken = typeof trackedTokens.$inferSelect;
export type InsertTrackedToken = z.infer<typeof insertTrackedTokenSchema>;
export type TokenSnapshot = typeof tokenSnapshots.$inferSelect;
export type InsertTokenSnapshot = z.infer<typeof insertTokenSnapshotSchema>;
export type UserWatchlist = typeof userWatchlists.$inferSelect;
export type InsertUserWatchlist = z.infer<typeof insertUserWatchlistSchema>;

// Live Coin Watch types and schemas
export type LiveCoinWatchDbCoin = typeof liveCoinWatchCoins.$inferSelect;
export type InsertLiveCoinWatchCoin = z.infer<typeof insertLiveCoinWatchCoinSchema>;

export const insertLiveCoinWatchCoinSchema = createInsertSchema(liveCoinWatchCoins).omit({ 
  id: true, 
  createdAt: true,
  lastUpdated: true
});

// Default OEC token configuration
export const TONE_TOKEN_CONFIG: TokenConfig = {
  contractAddress: "0x55d398326f99059fF775485246999027B3197955", // Using USDT BSC as placeholder until OEC is deployed
  operationsWallet: "0xD02dbe54454F6FE3c2F9F1F096C5460284E418Ed",
  buyFee: 5,
  sellFee: 5,
  liquidityFee: 2,
  operationsFee: 3,
  network: "mainnet",
};
