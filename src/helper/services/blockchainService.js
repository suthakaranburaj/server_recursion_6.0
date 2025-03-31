import { Network, Alchemy } from "alchemy-sdk";

class BlockchainService {
    constructor() {
        this.alchemy = new Alchemy({
            apiKey: process.env.ALCHEMY_API_KEY,
            network: process.env.ALCHEMY_NETWORK || Network.ETH_MAINNET
        });
    }

    async getTransactionTrace(txHash) {
        try {
            return await this.alchemy.debug.traceTransaction(txHash, {
                type: "callTracer"
            });
        } catch (error) {
            console.error("Transaction trace error:", error);
            throw new Error("Failed to fetch transaction trace");
        }
    }
}

export default new BlockchainService();
