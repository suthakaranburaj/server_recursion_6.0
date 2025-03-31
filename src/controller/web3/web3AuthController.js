import { sendResponse } from "../../utils/apiResponse.js";
import { ethers } from "ethers";
import knex from "../../db/constrants.js";
import { generateAccessToken, generateRefreshToken } from "../../middleware/TokenUtils.js";
import { generateNonceMiddleware, verifyWeb3Signature } from "../../middleware/web3Middleware.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import crypto from "crypto";

export const initiateWeb3Login = asyncHandler(async (req, res) => {
    const { walletAddress } = req.body;
    const normalizedAddress = walletAddress.toLowerCase();

    // Generate timestamped nonce (add here)
    const nonce = `${Date.now()}_${crypto.randomBytes(16).toString("hex")}`;
    const userSalt = crypto.randomBytes(16).toString("hex");
    // Upsert user record with new nonce
    await knex("user")
        .insert({
            wallet_address: normalizedAddress,
            nonce,
            is_web3_user: true,
            salt:userSalt,
        })
        .onConflict("wallet_address")
        .merge({ nonce });

    const message = `Authentication request for ${normalizedAddress} - Nonce: ${nonce}`;

    return sendResponse(res, true, { message, nonce }, "Signature required");
});

export const verifyWeb3Auth = [
    verifyWeb3Signature, // Only verify, don't generate new nonce first
    asyncHandler(async (req, res) => {
        const { user } = req;

        // Generate NEW nonce only AFTER successful verification
        const newNonce = crypto.randomBytes(16).toString("hex");
        await knex("user")
            .where({ wallet_address: user.wallet_address })
            .update({ nonce: newNonce });

        // Generate tokens
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        const options = { httpOnly: false, secure: true, sameSite: "Strict" };

        // Check if user exists (you might need additional checks here)
        const userExists = true; // Or your actual logic to determine if user exists

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json({
                success: true,
                data: {
                    userExists, // Add this flag
                    accessToken
                }
            });
    })
];

export const linkWalletToAccount = [
    verifyWeb3Signature,
    asyncHandler(async (req, res) => {
        const { user } = req;
        const { email, password } = req.body;

        const existingUser = await knex("user").where({ email }).first();
        if (!existingUser) return sendResponse(res, false, null, "Email not found");

        const validPassword = await bcrypt.compare(password, existingUser.password);
        if (!validPassword) return sendResponse(res, false, null, "Invalid password");

        await knex("user")
            .where({ user_id: existingUser.user_id })
            .update({
                wallet_address: user.wallet_address,
                nonce: crypto.randomBytes(16).toString("hex")
            });

        return sendResponse(res, true, null, "Wallet linked successfully");
    })
];
