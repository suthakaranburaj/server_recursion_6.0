import { Alchemy, Network } from "alchemy-sdk";

const testAlchemy = async () => {
    const alchemy = new Alchemy({
        apiKey: "tDvrRNDbMzlj1ydJ17iiDY7J9yKi0iFc",
        network: Network.ETH_MAINNET
    });

    const blockNumber = await alchemy.core.getBlockNumber();
    console.log("Current block:", blockNumber);
};

testAlchemy();
