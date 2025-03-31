import { sendResponse } from "../../utils/apiResponse.js";
import blockchainService from "../../helper/services/blockchainService.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const getTransactionTrace = asyncHandler(async (req, res) => {
    const { txHash } = req.params;

    if (!txHash.match(/^0x([A-Fa-f0-9]{64})$/)) {
        return sendResponse(res, false, null, "Invalid transaction hash");
    }

    const trace = await blockchainService.getTransactionTrace(txHash);
    return sendResponse(res, true, trace, "Transaction trace retrieved");
});
