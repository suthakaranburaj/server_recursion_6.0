import { sendResponse } from "../../utils/apiResponse.js"; //
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
        json_data = await axios.post("http://localhost:8000/upload_url", payload);
        // console.log("json_data", json_data);
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
        // await knex("user_transactions").insert(normalizedData);
        await createNotification("Statements uploaded successfully!", "Statement", user.user_id);
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

    // Fetch all active transactions for the user
    const transactions = await knex("user_transactions")
        .where({
            "user_transactions.status": 1,
            "user_transactions.user_id": user.user_id
        })
        .select("date", "amount", "type", "category", "narration");

    // Initialize default response structure
    const defaultResponse = {
        monthlyTrends: [],
        expenseData: [],
        cashFlowData: [],
        netSavings: 0,
        topTransactions: []
    };

    if (!transactions || transactions.length === 0) {
        return sendResponse(res, true, defaultResponse, "No transactions found");
    }

    // Helper variables
    const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec"
    ];
    const monthlyTrendsMap = {};
    let expenseCategories = {};
    const cashFlowData = [];
    let topTransactions = [];

    // Process each transaction
    transactions.forEach((transaction) => {
        // Parse transaction date
        const [day, month, year] = transaction.date.split("-");
        const monthIndex = parseInt(month) - 1;
        const monthYearKey = `${monthNames[monthIndex]}-${year}`;

        // Monthly trends calculation
        if (!monthlyTrendsMap[monthYearKey]) {
            monthlyTrendsMap[monthYearKey] = {
                income: 0,
                expenses: 0,
                year: parseInt(year),
                monthIndex
            };
        }

        if (transaction.type === "Credit") {
            monthlyTrendsMap[monthYearKey].income += parseFloat(transaction.amount);
        } else {
            monthlyTrendsMap[monthYearKey].expenses += parseFloat(transaction.amount);
        }

        // Expense categories calculation
        if (transaction.type === "Debit") {
            const category = transaction.category || "Other";
            expenseCategories[category] =
                (expenseCategories[category] || 0) + parseFloat(transaction.amount);
        }

        // Cashflow data
        cashFlowData.push({
            date: transaction.date,
            income: transaction.type === "Credit" ? parseFloat(transaction.amount) : 0,
            expenses: transaction.type === "Debit" ? parseFloat(transaction.amount) : 0,
            category: transaction.category || "Other"
        });
    });

    // Process monthly trends
    const monthlyTrends = Object.keys(monthlyTrendsMap)
        .map((key) => ({
            key,
            ...monthlyTrendsMap[key]
        }))
        .sort((a, b) => {
            if (a.year !== b.year) return a.year - b.year;
            return a.monthIndex - b.monthIndex;
        })
        .map((item) => ({
            month: item.key.split("-")[0],
            income: item.income,
            expenses: item.expenses
        }));

    // Process expense data
    const expenseData = Object.entries(expenseCategories).map(([name, value]) => ({
        name,
        value
    }));

    // Calculate net savings (latest month)
    let netSavings = 0;
    if (monthlyTrends.length > 0) {
        const latestMonth = monthlyTrends[monthlyTrends.length - 1];
        netSavings = latestMonth.income - latestMonth.expenses;
    }

    // Get top 5 expenses
    topTransactions = transactions
        .filter((t) => t.type === "Debit")
        .sort((a, b) => parseFloat(b.amount) - parseFloat(a.amount))
        .slice(0, 5)
        .map((t) => ({
            name: t.narration || t.category || "Expense",
            value: parseFloat(t.amount)
        }));

    // Prepare final response
    const responseData = {
        monthlyTrends,
        expenseData,
        cashFlowData,
        netSavings,
        topTransactions
    };

    return sendResponse(res, true, responseData, "Dashboard stats fetched successfully");
});

export const getAllTransaction = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    const { user_statement_id } = req.query;
    // const  user_statement_id = 30;

    const data = await knex("user_transactions")
        .where({
            "user_transactions.status": 1,
            "user_transactions.user_statement_id": user_statement_id,
            "user_transactions.user_id": user.user_id
        })
        .orderBy("user_transactions.id", "desc");

    if (!data) {
        return sendResponse(res, false, null, "No Transaction history found");
    }

    return sendResponse(res, true, data, "Transaction Fetched successfully !");
});
