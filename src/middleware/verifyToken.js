import { sendResponse } from "../utils/apiResponse.js"; //
import statusType from "../helper/enum/statusTypes.js"; //
import { jwtTokenVerify } from "../helper/services/jwtServices.js"; //
import knex from "../db/constrants.js" //
import logger from "../helper/services/loggingServices.js";
import jwt from 'jsonwebtoken'

export async function verifyToken(req, res, next) {
    try {
        const token = req.cookies.accessToken || req.headers.authorization?.split(" ")[1];

        if (!token) return sendResponse(res, false, null, "Access denied", 401);

        const decoded = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        const user = await knex("user").where({ user_id: decoded.user_id }).first();

        if (!user || user.token_version !== decoded.token_version) {
            return sendResponse(res, false, null, "Invalid token", 401);
        }

        req.userInfo = user;
        next();
    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            return sendResponse(res, false, null, "Token expired", 401);
        }
        return sendResponse(res, false, null, "Invalid token", 401);
    }
}

// const seq_errors = ["SequelizeValidationError", "SequelizeUniqueConstraintError"];

// export async function handleError(err, res, next, message = "Error") {
//     console.log(`${message}`, err);

//     if (seq_errors.includes(err.name)) {
//         let msgs = err.errors.map((e) => e.message);

//         return res.status(200).send({
//             error: msgs.length == 1 ? msgs[0] : msgs
//         });
//     } else {
//         const error = new Error(err.message + " " + err.name);
//         error.status = 500;
//         return res.status(200).send({
//             error: "Server Error"
//         });
//         // next(error)
//     }
// }
