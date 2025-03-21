import { sendResponse } from "../../utils/apiResponse.js"; //
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { getIntOrNull, getObjOrNull, checkExists } from "../../helper/CommonHelper.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const uploadStatements = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    const data = {
        user_id: user.user_id
    };
    // if (req.file && Array.isArray(req.file.statements) && req.file.statements.length > 0) {
    //     const statementsLocalPath = req.file.statements.path;
    //     const pdf = await uploadOnCloudinary(statementsLocalPath);
    //     data.url = pdf?.url;
    //     console.log(pdf)
    // }
    const statementsPath = req.file?.path;
    // console.log(statementsPath)
    if(!statementsPath){
      return sendResponse(res, false, null, "Statement not found");
    }
    console.log(statementsPath);
    const statementsUrl = await uploadOnCloudinary(statementsPath);
    console.log(statementsUrl)
    if (!statementsUrl) {
        return sendResponse(res, false, null, "Failed to upload Statement");
    }
    data.url = statementsUrl.url
    const result = await knex("user_statements").insert(data);
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

    if(!data){
      return sendResponse(res, true, null, "Statements not found!");
    }
    return sendResponse(res, true, data, "Statement fetched successfully !");
});
