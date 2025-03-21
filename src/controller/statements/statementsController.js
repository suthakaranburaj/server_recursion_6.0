import { sendResponse } from "../../utils/apiResponse.js"; //
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { getIntOrNull, getObjOrNull, checkExists } from "../../helper/CommonHelper.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import axios from "axios";
export const uploadStatements = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const data = {
        user_id: user.user_id
    };

    const statementsPath = req.file?.path;
    if (!statementsPath) {
        return sendResponse(res, false, null, "Statement not found");
    }

    const statementsUrl = await uploadOnCloudinary(statementsPath);
    if (!statementsUrl) {
        return sendResponse(res, false, null, "Failed to upload Statement");
    }
    data.url = statementsUrl.url;

    const payload = {
        url: statementsUrl.url,
        password: ""
    };

    let json_data;
    const [result] = await knex("user_statements").insert(data).returning("id");
    try {
        json_data = await axios.post("http://127.0.0.1:5000/upload_url", payload);
        console.log("Data successfully sent to conversion API:", json_data.status);
    } catch (error) {
        console.error("Error sending data to conversion API:", error.message);
    }

    // Process the parsed data to clean Narration and update Category
    if (json_data && json_data.data) {
        const frequencyMap = {};

        // First pass: Clean data and build frequency map
        json_data.data.forEach((transaction) => {
            // Clean Narration
            const parts = transaction.Narration.split("/");
            let cleaned = parts.length >= 2 ? parts[1] : transaction.Narration;
            transaction.Narration = cleaned.trim();

            // Normalize keys and extract values
            transaction.chqRefNo = transaction["Chq/Ref No"];
            delete transaction["Chq/Ref No"];

            // Process withdrawal/deposit field
            const [amount, type] = transaction["Withdrawal(Dr)/ Deposit(Cr)"]
                .replace(/[()]/g, "")
                .split(/(Cr|Dr)/);

            transaction.amount = parseFloat(amount);
            transaction.type = type === "Cr" ? "Credit" : "Debit";
            delete transaction["Withdrawal(Dr)/ Deposit(Cr)"];

            // Update frequency map
            frequencyMap[transaction.Narration] = (frequencyMap[transaction.Narration] || 0) + 1;
        });

        // Second pass: Update Category based on frequency
        json_data.data.forEach((transaction) => {
            transaction.Category =
                frequencyMap[transaction.Narration] >= 10 ? transaction.Narration : "Other";
        });

        // Convert to camelCase keys
        const normalizedData = json_data.data.map((transaction) => ({
            user_statement_id: result.id,
            user_id: user.user_id,
            date: transaction.Date,
            narration: transaction.Narration,
            chqRefNo: transaction.chqRefNo,
            amount: transaction.amount,
            type: transaction.type,
            balance: parseFloat(transaction.Balance.replace(/[^\d.]/g, "")),
            category: transaction.Category
        }));

        json_data.data = normalizedData;
        // console.log(normalizedData)
        await knex("user_transactions").insert(normalizedData);
    }
    if (!result) {
        return sendResponse(res, false, null, "Statement not uploaded");
    }
    return sendResponse(res, true, data.url, "Statement uploaded successfully!");
});

export const getStatements = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    const data = await knex("user_statements").where({
        "user_statements.status": 1,
        "user_statements.user_id": user.user_id
    });

    if (!data) {
        return sendResponse(res, true, null, "Statements not found!");
    }
    return sendResponse(res, true, data, "Statement fetched successfully !");
});

export const getDashBoardStats = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    try {
        const [
            monthlyTrendsQuery,
            spendingCategoriesQuery,
            cashFlowDataQuery,
            netResult,
            topTransactionsQuery
        ] = await Promise.all([
            // Monthly Trends Query
            knex("user_transactions")
                .select(
                    knex.raw("EXTRACT(YEAR FROM TO_DATE(date, 'YYYY-MM-DD')) as year"),
                    knex.raw("EXTRACT(MONTH FROM TO_DATE(date, 'YYYY-MM-DD')) as month_num"),
                    knex.raw("TO_CHAR(TO_DATE(date, 'YYYY-MM-DD'), 'Mon') as month"),
                    knex.raw("SUM(CASE WHEN type = 'Credit' THEN amount ELSE 0 END) as income"),
                    knex.raw("SUM(CASE WHEN type = 'Debit' THEN amount ELSE 0 END) as expenses")
                )
                .where("user_id", user.user_id)
                .groupBy("year", "month_num", "month")
                .orderBy("year", "asc")
                .orderBy("month_num", "asc"),

            // Spending Categories Query
            knex("user_transactions")
                .select("category")
                .sum("amount as value")
                .where("user_id", user.user_id)
                .andWhere("type", "Debit")
                .groupBy("category"),

            // Cashflow Data Query
            knex("user_transactions")
                .select("date")
                .sum(knex.raw("CASE WHEN type = 'Credit' THEN amount ELSE 0 END as income"))
                .sum(knex.raw("CASE WHEN type = 'Debit' THEN amount ELSE 0 END as expenses"))
                .where("user_id", user.user_id)
                .groupBy("date")
                .orderBy("date", "asc"),

            // Net Savings Query
            knex("user_transactions")
                .select(
                    knex.raw(
                        "COALESCE(SUM(CASE WHEN type = 'Credit' THEN amount ELSE 0 END), 0) as total_income"
                    ),
                    knex.raw(
                        "COALESCE(SUM(CASE WHEN type = 'Debit' THEN amount ELSE 0 END), 0) as total_expenses"
                    )
                )
                .where("user_id", user.user_id)
                .first(),

            // Top Transactions Query
            knex("user_transactions")
                .select("narration", "amount")
                .where("user_id", user.user_id)
                .andWhere("type", "Debit")
                .orderBy("amount", "desc")
                .limit(5)
        ]);

        // Process Monthly Trends Data
        const monthlyTrendsData = monthlyTrendsQuery.map((trend) => ({
            month: trend.month,
            income: parseFloat(trend.income) || 0,
            expenses: parseFloat(trend.expenses) || 0
        }));

        // Process Spending Categories Data
        const spendingCategoriesData = spendingCategoriesQuery
            .map((cat) => ({
                name: cat.category || "Uncategorized",
                value: parseFloat(cat.value) || 0
            }))
            .filter((cat) => cat.value > 0); // Filter out categories with zero spending

        // Process Cashflow Data
        const cashFlowData = cashFlowDataQuery.map((entry) => ({
            date: entry.date,
            income: parseFloat(entry.income) || 0,
            expenses: parseFloat(entry.expenses) || 0
        }));

        // Calculate Net Savings
        const totalIncome = parseFloat(netResult.total_income) || 0;
        const totalExpenses = parseFloat(netResult.total_expenses) || 0;
        const netSavings = totalIncome - totalExpenses;

        // Process Top Transactions Data
        const topTransactions = topTransactionsQuery.map((transaction) => ({
            narration: transaction.narration || "No description",
            amount: parseFloat(transaction.amount) || 0
        }));

        // Construct the response object
        const dashboardData = {
            monthlyTrends: monthlyTrendsData,
            spendingCategories: spendingCategoriesData,
            cashFlowData: cashFlowData,
            netSavings: netSavings,
            topTransactions: topTransactions
        };

        return sendResponse(res, true, dashboardData, "Dashboard stats fetched successfully");
    } catch (error) {
        logger.error("Error fetching dashboard stats:", error);
        return sendResponse(
            res,
            false,
            null,
            "Error fetching dashboard data",
            statusType.INTERNAL_SERVER_ERROR
        );
    }
});

export const getAllTransaction = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // const { user_statement_id } = req.query;
    // const  user_statement_id = 30;

    const data = await knex("user_transactions").where({
        "user_transactions.status": 1,
        // "user_transactions.user_statement_id": user_statement_id,
        "user_transactions.user_id": user.user_id
    });

    if (!data) {
        return sendResponse(res, false, null, "No Transaction history found");
    }

    return sendResponse(res, true, data, "Transaction Fetched successfully !");
});
