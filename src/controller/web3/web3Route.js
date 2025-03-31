import { Router } from "express";
import {
    initiateWeb3Login,
    verifyWeb3Auth,
    linkWalletToAccount
} from "./web3AuthController.js";
import { getTransactionTrace } from "./blockchainController.js";

const router = Router();

router.post("/initiate", initiateWeb3Login);
router.post("/verify", verifyWeb3Auth);
router.post("/link", linkWalletToAccount);

// Add to your existing routes
router.get(
    "/blockchain/tx-trace/:txHash",
    getTransactionTrace
);

export default router;
