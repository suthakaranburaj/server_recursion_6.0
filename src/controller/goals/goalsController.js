import { sendResponse } from "../../utils/apiResponse.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createNotification } from "../../helper/CommonHelper.js";

export const add_goals = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { name, years, target, invested } = req.body;

    // Validate required fields
    if (!name || !years || !target) {
        return sendResponse(res, false, null, "Missing required fields: name, years, target");
    }

    // Prepare goal data
    const goalData = {
        user_id: user.user_id,
        name,
        years,
        target,
        invested: invested || "0",
    };

    try {
        // Insert goal and return created record
        const [newGoal] = await knex("goals").insert(goalData).returning("*");

        // Create notification
        await createNotification("New goal added successfully!", "Goal", user.user_id);

        return sendResponse(res, true, newGoal, "Goal created successfully");
    } catch (error) {
        console.log("Error creating goal: ", error);
        return sendResponse(res, false, null, "Failed to create goal");
    }
});

export const get_all_goals = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    try {
        // Get all active goals for user
        const goals = await knex("goals")
            .where({
                user_id: user.user_id,
                status: true
            })
            .orderBy("createdAt", "desc");

        // Return empty array if no goals found
        if (!goals.length) {
            return sendResponse(res, true, [], "No goals found");
        }

        return sendResponse(res, true, goals, "Goals fetched successfully");
    } catch (error) {
        console.log("Error fetching goals: ", error);
        return sendResponse(res, false, null, "Failed to fetch goals");
    }
});
