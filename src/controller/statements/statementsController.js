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
import FormData from "form-data";
import fs from "fs";
import path from "path";
import os from "os";
import { decrypt, encrypt, deriveKey } from "../../utils/cryptoUtils.js";

export const uploadStatements = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const password = req.body.password;
    if (!user.subscription) {
        // Count existing statements for the user
        const countResult = await knex("user_statements")
            .where({ user_id: user.user_id })
            .count("id as count")
            .first();

        const statementCount = countResult ? parseInt(countResult.count) : 0;

        // Block upload if they already have one statement
        if (statementCount >= 1) {
            return sendResponse(res, false, null, "Subscribe to upload more than one statement");
        }
    }
    const data = {
        user_id: user.user_id
    };

    let statementsPath = req.file?.path;
    if (!statementsPath) {
        return sendResponse(res, false, null, "Statement not found");
    }

    let tempFilePath = null;

    // PDF unlocking logic
    // Modified PDF unlocking section
    if (password) {
        try {
            // Read the file as buffer instead of stream
            const fileBuffer = await fs.promises.readFile(statementsPath);

            const form = new FormData();
            form.append("file", fileBuffer, {
                filename: "statement.pdf",
                contentType: "application/pdf"
            });
            form.append("password", password);

            const headers = {
                ...form.getHeaders(),
                "X-Api-Key": "bcc7c3b09e7fd7ab3c09d0a67f2a2b35",
                Accept: "application/pdf" // Explicitly ask for PDF response
            };

            const response = await axios.post(
                "https://api.pdfblocks.com/v1/remove_password",
                form,
                {
                    headers,
                    responseType: "arraybuffer",
                    maxContentLength: Infinity, // For large files
                    maxBodyLength: Infinity
                }
            );

            if (response.status === 200) {
                tempFilePath = path.join(os.tmpdir(), `unlocked-${Date.now()}.pdf`);
                await fs.promises.writeFile(tempFilePath, response.data);
                statementsPath = tempFilePath;
            } else {
                console.error("PDFBlocks API Response:", response.status, response.data);
                return sendResponse(res, false, null, "Failed to unlock PDF");
            }
        } catch (error) {
            console.error("Error unlocking PDF:", error.response?.data || error.message);
            return sendResponse(
                res,
                false,
                null,
                error.response?.data?.message || "Invalid password or PDF processing error"
            );
        }
    }

    const statementsUrl = await uploadOnCloudinary(statementsPath);
    if (!statementsUrl) {
        return sendResponse(res, false, null, "Failed to upload Statement");
    }
    let url = statementsUrl.url;
    const masterKey = process.env.MASTER_KEY;
    const userSalt = user.salt;
    const encryptionKey = deriveKey(masterKey, userSalt);
    // Decrypt sensitive fields
    // decrypt(user.name, encryptionKey)
    
    data.url = encrypt(url, encryptionKey);;

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
            if (transaction.Category === "Other") {
                transaction.Category =
                    frequencyMap[transaction.Narration] >= 10 ? transaction.Narration : "Other";
            }
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
        const categories = await knex("user_transactions")
            .select("category as cat_name")
            .avg("amount as average")
            .where({
                user_id: user.user_id,
                type: "Debit" // Consider only withdrawals for spending
            })
            .groupBy("category");

        // Upsert into category_spend
        for (const cat of categories) {
            if (!cat.cat_name) continue;

            await knex("category_spend")
                .insert({
                    user_id: user.user_id,
                    cat_name: cat.cat_name,
                    average: cat.average.toFixed(2),
                    status: true,
                    createdAt: knex.fn.now(),
                    updatedAt: knex.fn.now()
                })
                .onConflict(["user_id", "cat_name"])
                .merge({
                    average: knex.raw("EXCLUDED.average"), // Use the new average
                    updatedAt: knex.fn.now()
                });
        }
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
        .select("date", "amount", "type", "category", "narration","balance");

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
    // console.log(expen)
    // Calculate net savings (latest month)
    // console.log(transactions)
    let netSavings = transactions[0].balance;
    console.log(netSavings)
    // if (monthlyTrends.length > 0) {
    //     const latestMonth = monthlyTrends[monthlyTrends.length - 1];
    //     netSavings = latestMonth.income - latestMonth.expenses;
    // }

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

    const { user_statement_id } = req.params;
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

export const add_transaction = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const { user_statement_id, date, narration, balance, category, amount, chqRefNo, type } =
        req.body;

    // Validate required fields
    if (!user_statement_id || !date || !amount || !type) {
        return sendResponse(
            res,
            false,
            null,
            "Missing required fields: user_statement_id, date, amount, type"
        );
    }

    // Validate transaction type
    if (!["Credit", "Debit"].includes(type)) {
        return sendResponse(
            res,
            false,
            null,
            "Invalid transaction type. Must be 'Credit' or 'Debit'"
        );
    }

    // Validate amount
    const amountValue = parseFloat(amount);
    if (isNaN(amountValue) || amountValue <= 0) {
        return sendResponse(res, false, null, "Amount must be a positive number");
    }

    // Validate balance if provided
    let balanceValue = null;
    if (balance !== undefined && balance !== null) {
        balanceValue = parseFloat(balance);
        if (isNaN(balanceValue)) {
            return sendResponse(res, false, null, "Invalid balance value");
        }
    }

    // Verify user statement exists and belongs to user
    try {
        const statementExists = await knex("user_statements")
            .where({
                id: user_statement_id,
                user_id: user.user_id,
                status: 1
            })
            .first();

        if (!statementExists) {
            return sendResponse(res, false, null, "Statement not found or access denied");
        }
    } catch (error) {
        logger.error("Error verifying statement: ", error);
        return sendResponse(res, false, null, "Error verifying statement");
    }

    // Check category spending limits
    const categoryToCheck = category || "Other"; // Default category if not provided

    try {
        // Retrieve category spend information
        const categorySpend = await knex("category_spend")
            .where({
                user_id: user.user_id,
                cat_name: categoryToCheck,
                status: true
            })
            .first();

        if (categorySpend && categorySpend.average) {
            const average = parseFloat(categorySpend.average);

            // Proceed only if average is a valid number
            if (!isNaN(average)) {
                // Check if transaction amount exceeds the average
                if (amountValue > average) {
                    const excessAmount = amountValue - average;
                    const excessPercentage = (excessAmount / average) * 100;

                    let message;
                    if (excessPercentage <= 20) {
                        message =
                            "You are crossing your previous limits. This transaction exceeds your average spend in this category.";
                    } else {
                        message =
                            "You are significantly exceeding your average spending in this category. Please review your budget.";
                    }

                    return sendResponse(res, false, null, message);
                }
            } else {
                logger.error(`Invalid average value for category: ${categoryToCheck}`);
            }
        }
    } catch (error) {
        logger.error("Error checking category spending limits: ", error);
        // Proceed with transaction despite check error
    }

    // Prepare transaction data
    const transactionData = {
        user_statement_id,
        user_id: user.user_id,
        date,
        narration: narration || null,
        balance: balanceValue,
        category: categoryToCheck, // Use normalized category name
        amount: amountValue,
        chqRefNo: chqRefNo || null,
        type
    };

    try {
        // Insert transaction
        const [newTransaction] = await knex("user_transactions")
            .insert(transactionData)
            .returning("*");

        // Create notification
        await createNotification("Transaction added successfully!", "Transaction", user.user_id);

        return sendResponse(res, true, newTransaction, "Transaction added successfully");
    } catch (error) {
        logger.error("Error adding transaction: ", error);
        return sendResponse(res, false, null, "Failed to add transaction");
    }
});

export const predict_api = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    let json_data;
    try {
        json_data = await axios.get("http://localhost:8000/api/predict-spends/");
        // console.log("json_data", json_data);
        console.log("Data successfully sent to conversion API:", json_data.status);
        return sendResponse(res, true, json_data.data, "Prediction successfully");
    } catch (error) {
        console.error("Error sending data to conversion API:", error.message);
    }
});
