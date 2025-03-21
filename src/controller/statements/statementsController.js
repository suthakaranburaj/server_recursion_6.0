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
        json_data = await axios.post("http://127.0.0.1:5000//upload_url", payload);
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

export const getDashBoardStats = asyncHandler(async (req, res) => {});

export const getAllTransaction = asyncHandler(async (req, res) => {
    const user = req.userInfo;

    // const { user_statement_id } = req.query;
    const  user_statement_id = 30;

    const data = await knex("user_transactions").where({
        "user_transactions.status": 1,
        "user_transactions.user_statement_id": user_statement_id,
        "user_transactions.user_id": user.user_id
    });

    if (!data) {
        return sendResponse(res, false, null, "No Transaction history found");
    }

    return sendResponse(res, true, data, "Transaction Fetched successfully !");
});
