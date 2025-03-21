import jwt from "jsonwebtoken";
import logger from "./loggingServices.js";

export function jwtTokenEncode(payload) {
    try {
        return jwt.sign(payload, process.env.REFRESH_TOKEN_SECRET, {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        });
    } catch (error) {
        logger.consoleErrorLog("core", "Error in jwtAccessTokenEncode", error);
        return null;
    }
}

export function jwtTokenVerify(token) {
    try {
        return jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    } catch (error) {
        logger.consoleErrorLog("core", "Error in jwtAccessTokenVerify", error);
        return null;
    }
}

export function jwtDecode(token) {
    try {
        return jwt.decode(token);
    } catch (error) {
        logger.consoleErrorLog("core", "Error in jwtDecode", error);
        return null;
    }
}
