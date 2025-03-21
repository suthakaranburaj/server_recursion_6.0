import { sendResponse } from "../../utils/apiResponse.js";
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import {
    getIntOrNull,
    getObjOrNull,
    checkExists,
    createNotification
} from "../../helper/CommonHelper.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import axios from "axios";

export const add_subscription = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { is_paid } = req.body;

    // Input validation
    if (typeof is_paid !== "boolean") {
        return sendResponse(res, false, null, "Invalid input: is_paid should be a boolean");
    }

    // User validation
    const userExists = await knex("user").where({ user_id: user.user_id, status: 1 }).first();

    if (!userExists) {
        return sendResponse(res, false, null, "User not found or inactive");
    }

    // Subscription validation
    if (userExists.subscription) {
        return sendResponse(res, false, null, "User already has an active subscription");
    }

    if (is_paid) {
        const update = await knex("user")
            .update({ subscription: true })
            .where({ user_id: user.user_id, status: 1 });

        if (update) {
            await createNotification(
                "Subscription activated successfully!",
                "Subscription",
                user.user_id
            );
            return sendResponse(res, true, null, "Subscription activated successfully!");
        } else {
            return sendResponse(res, false, null, "Failed to activate subscription");
        }
    } else {
        return sendResponse(res, false, null, "Payment not successful");
    }
});

export const cancel_subscription = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // User validation
    const userExists = await knex("user").where({ user_id: user.user_id, status: 1 }).first();

    if (!userExists) {
        return sendResponse(res, false, null, "User not found or inactive");
    }

    // Subscription validation
    if (!userExists.subscription) {
        return sendResponse(res, false, null, "No active subscription found");
    }

    const update = await knex("user")
        .update({ subscription: false })
        .where({ user_id: user.user_id, status: 1 });

    if (update) {
        await createNotification(
            "Subscription cancelled successfully!",
            "Subscription",
            user.user_id
        );
        return sendResponse(res, true, null, "Subscription cancelled successfully!");
    } else {
        return sendResponse(res, false, null, "Failed to cancel subscription");
    }
});
