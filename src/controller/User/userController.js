import { sendResponse } from "../../utils/apiResponse.js";
import { hash } from "../../helper/services/cryptoClient.js";
import { jwtTokenEncode } from "../../helper/services/jwtServices.js";
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { getIntOrNull, getObjOrNull, checkExists } from "../../helper/CommonHelper.js";
import bcrypt from "bcryptjs";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateUserData } from "./userHelper.js";
import { generateAccessToken, generateRefreshToken } from "../../middleware/TokenUtils.js";
import { decrypt, encrypt, deriveKey } from "../../utils/cryptoUtils.js";
import crypto from "crypto";


//User Login
export async function Login(req, res) {
    try {
        const { email, password } = req.body;
        if (!email || !password) return sendResponse(res, false, null, "Invalid input");

        const [user] = await knex("user").where({ email, status: 1 });
        if (!user) return sendResponse(res, false, null, "Invalid credentials");

        // Verify password with bcrypt
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) return sendResponse(res, false, null, "Invalid credentials");

        // Generate tokens and set cookies
        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);
        await knex("user").where({ user_id: user.user_id }).update({ refresh_token: refreshToken });

        const options = { httpOnly: false, secure: true, sameSite: "Strict" };
        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json({ status:true,success: true, accessToken });
    } catch (error) {
        console.log(error);
        return sendResponse(res, false, null, "Login failed");
    }
}

export async function save_user(req, res) {
    try {
        const user_id = getIntOrNull(req.body?.user_id);
        const obj = {
            name: getObjOrNull(req.body.name),
            email: getObjOrNull(req.body.email),
            phone: getObjOrNull(req.body.phone),
            username: getObjOrNull(req.body.username)
        };

        // Handle image upload
        if (req.files && req.files.image) {
            const avatarLocalPath = req.files.image[0].path;
            const image = await uploadOnCloudinary(avatarLocalPath, { secure: true });
            obj.image = image?.secure_url;
        }

        if (user_id) {
            // Update existing user
            const existingUser = await knex("user").where({ user_id }).first();
            if (!existingUser) return sendResponse(res, false, null, "User not found");

            const updateData = {};
            const masterKey = process.env.MASTER_KEY;
            const encryptionKey = deriveKey(masterKey, existingUser.salt);

            // Encrypt updated fields
            if (obj.name) updateData.name = encrypt(obj.name, encryptionKey);
            if (obj.username) updateData.username = encrypt(obj.username, encryptionKey);
            if (obj.image) updateData.image = encrypt(obj.image, encryptionKey);
            if (obj.email) updateData.email = obj.email; // Keep email plaintext
            if (obj.phone) updateData.phone = obj.phone; // Keep phone plaintext

            const result = await knex("user").where({ user_id }).update(updateData);
            if (!result) return sendResponse(res, false, null, "Update failed");
            return sendResponse(res, true, null, "User Updated");
        } else {
            // Create new user
            if (!req.body.password) return sendResponse(res, false, null, "Password required");

            // Generate unique salt for encryption
            const userSalt = crypto.randomBytes(16).toString("hex");
            obj.salt = userSalt;
            console.log(userSalt)
            // Hash password with bcrypt
            obj.password = await bcrypt.hash(req.body.password, 10);

            // Encrypt sensitive data
            const masterKey = process.env.MASTER_KEY;
            const encryptionKey = deriveKey(masterKey, userSalt);
            // console.log('hhh')
            if (obj.name) obj.name = encrypt(obj.name, encryptionKey);
            if (obj.username) obj.username = encrypt(obj.username, encryptionKey);
            if (obj.image) obj.image = encrypt(obj.image, encryptionKey);
            // console.log('1')
            // Check for existing users (plaintext checks)
            const checkemailExists = await checkExists(
                "user",
                "user_id",
                null,
                "email",
                obj.email,
                "The Email"
            );
            if (checkemailExists.exists)
                return sendResponse(res, false, null, checkemailExists.message);
            // console.log("2");
            const checkphoneExists = await checkExists(
                "user",
                "user_id",
                null,
                "phone",
                obj.phone,
                "The Phone Number"
            );
            if (checkphoneExists.exists)
                return sendResponse(res, false, null, checkphoneExists.message);
            // console.log('fhfhfh')
            // console.log('obj',obj)
            const [newUser] = await knex("user").insert(obj).returning("*");
            if (!newUser) return sendResponse(res, false, null, "Registration failed");
            
            // Generate tokens and set cookies
            const accessToken = generateAccessToken(newUser);
            const refreshToken = generateRefreshToken(newUser);
            await knex("user")
                .where({ user_id: newUser.user_id })
                .update({ refresh_token: refreshToken });
            console.log("hhhhffd");
            const options = { httpOnly: false, secure: true, sameSite: "Strict" };
            return res
                .status(200)
                .cookie("accessToken", accessToken, options)
                .cookie("refreshToken", refreshToken, options)
                .json({ status:true,success: true, accessToken, message: "Registered Successfully" });
        }
    } catch (error) {
        console.log(error);
        return sendResponse(res, false, null, "Error saving user");
    }
}

export const get_current_user = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const masterKey = process.env.MASTER_KEY;
    const encryptionKey = deriveKey(masterKey, user.salt);

    // Decrypt sensitive fields
    const decryptedUser = {
        ...user,
        name: user.name ? decrypt(user.name, encryptionKey) : null,
        username: user.username ? decrypt(user.username, encryptionKey) : null,
        image: user.image ? decrypt(user.image, encryptionKey) : null
    };

    return sendResponse(res, true, decryptedUser, "User details fetched");
});

export async function logout(req, res) {
    try {
        await knex("user")
            .where({ user_id: req.userInfo.user_id })
            .update({
                token_version: knex.raw("token_version + 1"),
                refresh_token: null
            });

        const options = {
            httpOnly: false,
            secure: true,
            sameSite: "Strict"
        };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        console.log(error);
        return sendResponse(res, false, null, "Logout failed");
    }
}

export async function refreshToken(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) return sendResponse(res, false, null, "Unauthorized", 401);

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await knex("user").where({ user_id: decoded.user_id }).first();

        if (
            !user ||
            user.refresh_token !== refreshToken ||
            user.token_version !== decoded.token_version
        ) {
            return sendResponse(res, false, null, "Invalid refresh token", 401);
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await knex("user")
            .where({ user_id: user.user_id })
            .update({ refresh_token: newRefreshToken });

        const options = {
            httpOnly: false,
            secure: true,
            sameSite: "Strict"
        };

        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json({ success: true, accessToken: newAccessToken });
    } catch (error) {
        return sendResponse(res, false, null, "Invalid refresh token", 401);
    }
}
