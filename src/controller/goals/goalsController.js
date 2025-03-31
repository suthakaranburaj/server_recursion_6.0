import { sendResponse } from "../../utils/apiResponse.js";
import knex from "../../db/constrants.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { createNotification } from "../../helper/CommonHelper.js";
import axios from "axios";
import schedule from "node-schedule";

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
        invested: invested || "0"
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

export const recommend_api = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    let salary = req.body;
    salary = 10000;
    const payload = {
        salary: salary
    };
    let json_data;
    try {
        json_data = await axios.post("http://localhost:8000/api/recommend/", payload);
        console.log("json_data", json_data);
        console.log("Data successfully sent to conversion API:", json_data.status);
        return sendResponse(res, true, json_data.data, "Prediction successfully");
    } catch (error) {
        console.error("Error sending data to conversion API:", error.message);
    }
});

const scheduledJobs = new Map();
async function scheduleGoalUpdates() {
    try {
        console.log("Scheduling investment updates for all active goals...");

        // Fetch all active goals
        const activeGoals = await knex("goals").where("status", true);

        for (const goal of activeGoals) {
            const createdAt = new Date(goal.createdAt);
            const createdSeconds = createdAt.getSeconds();
            const createdMinutes = createdAt.getMinutes();
            const createdHours = createdAt.getHours();
            const createdDayOfMonth = createdAt.getDate();

            // Create cron expression to run monthly on the same day and time
            const cronExpression = `${createdSeconds} * * * * *`;

            // Schedule the job and store it
            const job = schedule.scheduleJob(cronExpression, async () => {
                try {
                    const now = new Date();
                    console.log(`Updating goal ${goal.name} at ${now.toLocaleTimeString()}`);

                    // Fetch the latest goal data from the database
                    const currentGoal = await knex("goals").where("id", goal.id).first();
                    if (!currentGoal) {
                        console.error(`Goal ${goal.id} not found`);
                        return;
                    }

                    // Skip if goal is no longer active
                    if (!currentGoal.status) {
                        console.log(`Goal ${currentGoal.name} is inactive, skipping update.`);
                        return;
                    }

                    // Parse values from current goal data
                    const invested = parseFloat(currentGoal.invested);
                    const currentInvested = parseFloat(currentGoal.current_invested || 0);
                    const years = parseFloat(currentGoal.years);
                    const target = parseFloat(currentGoal.target);

                    // Validate numeric values
                    if (
                        isNaN(invested) ||
                        isNaN(currentInvested) ||
                        isNaN(years) ||
                        isNaN(target)
                    ) {
                        console.error(`Invalid numeric values in goal ${currentGoal.name}`);
                        return;
                    }

                    // Calculate monthly installment and remaining amount
                    const monthlyInstallment = invested / (years * 12);
                    const remaining = invested - currentInvested;

                    // Determine increment without exceeding remaining
                    const increment = Math.min(monthlyInstallment, remaining);
                    const newInvested = parseFloat((currentInvested + increment).toFixed(2));

                    // Update the goal with new values
                    await knex("goals")
                        .where("id", currentGoal.id)
                        .update({
                            current_invested: newInvested.toString(),
                            status: newInvested < target
                        });

                    console.log(`Goal ${currentGoal.name}: Invested updated to ₹${newInvested}`);

                    // Send notification for investment update
                    await createNotification(
                        `Investment updated for Goal ${currentGoal.name}: ₹${newInvested} invested.`,
                        "Goal",
                        currentGoal.user_id
                    );

                    // Check if it's the last month (investment goal reached)
                    if (newInvested >= invested) {
                        await createNotification(
                            `Final investment completed for Goal ${currentGoal.name}.`,
                            "Goal",
                            currentGoal.user_id
                        );

                        // Cancel job if target is met or exceeded
                        const job = scheduledJobs.get(currentGoal.id);
                        if (job) {
                            job.cancel();
                            scheduledJobs.delete(currentGoal.id);
                            console.log(
                                `Cancelled job for goal ${currentGoal.id} (target reached).`
                            );
                        }
                    }
                } catch (error) {
                    console.error(`Error updating goal ${goal.id}:`, error);
                }
            });

            // Store the job reference
            scheduledJobs.set(goal.id, job);
            console.log(
                `Scheduled monthly update for Goal ${goal.id} on day ${createdDayOfMonth} at ${createdHours}:${createdMinutes}:${createdSeconds}.`
            );
        }
    } catch (error) {
        console.error("Error scheduling investment updates:", error);
    }
}
scheduleGoalUpdates();