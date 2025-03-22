import { sendResponse } from "../../utils/apiResponse.js"; //
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { getIntOrNull, getObjOrNull, checkExists } from "../../helper/CommonHelper.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import axios from "axios";

export const updateNotification = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // const notification = await knex("notification").where({ user_id: user.user_id });

    // if (!notification) {
    //     return sendResponse(res, false, null, "Notification not found", 404);
    // }

    const updated = await knex("notification")
        .where({ user_id: user.user_id ,is_read:false})
        .update({ is_read: true }, "*");

    return sendResponse(res, true, updated, "Notification updated successfully");
});

// Get all active notifications
export const getAllNotifications = asyncHandler(async (req, res) => {
    const userId = req.userInfo.user_id;

    const notifications = await knex("notification")
        .where({
            user_id: userId,
            status: true
        })
        .orderBy("createdAt", "desc");

    return sendResponse(res, true, notifications, "Notifications fetched successfully");
});