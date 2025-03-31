import { ethers } from "ethers"; // This stays the same
import jwt from "jsonwebtoken";
import knex from "../db/constrants.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import crypto from "crypto";
import { sendResponse } from "../utils/apiResponse.js";

const WEB3_JWT_SECRET = process.env.WEB3_JWT_SECRET;

export const verifyWeb3Signature = asyncHandler(async (req, res, next) => {
    const { signature, walletAddress, message } = req.body;

    if (!signature || !walletAddress || !message) {
        return sendResponse(res, false, null, "Missing required fields");
    }

    // Normalize address casing
    const normalizedAddress = walletAddress.toLowerCase();

    const user = await knex("user").where({ wallet_address: normalizedAddress }).first();

    if (!user) {
        return sendResponse(res, false, null, "Wallet not registered");
    }

    // Add nonce expiration check (add here)
    const [timestamp, _] = user.nonce.split("_");
    if (Date.now() - Number(timestamp) > 5 * 60 * 1000) {
        // 5 minutes
        return sendResponse(res, false, null, "Expired nonce");
    }

    // Verify message contains the correct nonce
    const expectedMessage = `Authentication request for ${normalizedAddress} - Nonce: ${user.nonce}`;

    if (message !== expectedMessage) {
        console.error("Message format mismatch:");
        console.error("Received:", message);
        console.error("Expected:", expectedMessage);
        return sendResponse(res, false, null, "Invalid message format");
    }

    try {
        const recoveredAddress = ethers.verifyMessage(message, signature);

        if (recoveredAddress.toLowerCase() !== normalizedAddress) {
            return sendResponse(res, false, null, "Invalid signature");
        }

        // Update nonce to prevent replay attacks
        const newNonce = `${Date.now()}_${crypto.randomBytes(16).toString("hex")}`; // Also timestamp the new nonce
        await knex("user").where({ wallet_address: normalizedAddress }).update({ nonce: newNonce });

        req.user = user;
        next();
    } catch (error) {
        console.error("Signature verification error:", error);
        return sendResponse(res, false, null, "Signature verification failed");
    }
});

export const generateNonceMiddleware = asyncHandler(async (req, res, next) => {
    const { walletAddress } = req.body;
    const nonce = crypto.randomBytes(16).toString("hex");

    const existingUser = await knex("user").where({ wallet_address: walletAddress }).first();
    if (existingUser) {
        await knex("user").where({ wallet_address: walletAddress }).update({ nonce });
    } else {
        await knex("user").insert({
            wallet_address: walletAddress,
            nonce,
            is_web3_user: true
        });
    }

    req.nonce = nonce;
    next();
});
