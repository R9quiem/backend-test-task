export interface Cryptocurrency {
    id: number;
    coinmarketcapId: number;
    symbol: string;
    name: string;
    lastUpdatedAt: string | null;
}