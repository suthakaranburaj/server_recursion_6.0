import { sendResponse } from "../../utils/apiResponse.js";
import { hash } from "../../helper/services/cryptoClient.js";
import { jwtTokenEncode } from "../../helper/services/jwtServices.js";
import logger from "../../helper/services/loggingServices.js";
import statusType from "../../helper/enum/statusTypes.js";
import knex from "../../db/constrants.js";
import { getIntOrNull, getObjOrNull, checkExists } from "../../helper/CommonHelper.js";
import bcrypt from "bcryptjs";
import { uploadOnCloudinary, deleteOnCloudinary } from "../../utils/Cloudinary.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { validateUserData } from "./userHelper.js";
import { generateAccessToken, generateRefreshToken } from "../../middleware/TokenUtils.js";

//User Login
export async function Login(req, res) {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return sendResponse(res, false, null, "Error in login");
        }

        const [user] = await knex("user").where({
            status: 1,
            email
        });

        if (!user) {
            return sendResponse(res, false, null, "Invalid credentials");
        }

        // const hashedPassword = hash(password, user.salt);

        if (user.password !== password) {
            return sendResponse(res, false, null, "Password does not match");
        }

        const accessToken = generateAccessToken(user);
        const refreshToken = generateRefreshToken(user);

        await knex("user").where({ user_id: user.user_id }).update({ refresh_token: refreshToken });

        const options = {
            httpOnly: false,
            secure: true,
            sameSite: "Strict"
        };

        return res
            .status(200)
            .cookie("accessToken", accessToken, options)
            .cookie("refreshToken", refreshToken, options)
            .json({ success: true, accessToken,status:true });
    } catch (error) {
        logger.error(error);
        return sendResponse(res, false, null, "Login failed");
    }
}

export async function save_user(req, res) {
    try {
      const user_id = getIntOrNull(req.body?.user_id);
      const obj = {
        name: getObjOrNull(req.body.name),
        email: getObjOrNull(req.body.email),
        phone: getObjOrNull(req.body.phone),
        username: getObjOrNull(req.body.username),
      };
  
      // Handle image upload
      if (req.files && req.files.image) {
        const avatarLocalPath = req.files.image[0].path;
        const image = await uploadOnCloudinary(avatarLocalPath, { secure: true });
        obj.image = image?.secure_url;
      }
  
      if (user_id) {
        // Update existing user (profile update)
        const updateData = {};
  
        // Only include fields that are provided in the request
        if (obj.name) updateData.name = obj.name;
        if (obj.email) updateData.email = obj.email;
        if (obj.phone) updateData.phone = obj.phone;
        if (obj.username) updateData.username = obj.username;
        if (obj.image) updateData.image = obj.image;
  
        // Update only if there are fields to update
        if (Object.keys(updateData).length > 0) {
          const result = await knex("user").where({ user_id }).update(updateData);
          if (!result) {
            return sendResponse(res, false, null, "User not found");
          }
          return sendResponse(res, true, null, "User Updated");
        } else {
          return sendResponse(res, false, null, "No data provided for update");
        }
      } else {
        // Create new user (registration)
        if (!req.body.password) {
          return sendResponse(res, false, null, "Please provide password");
        }
  
        // Validate required fields for registration
        if (!obj.name || !obj.email || !obj.phone || !obj.username) {
          return sendResponse(res, false, null, "All fields are required for registration");
        }
  
        // Check for existing email, phone, username
        const checkemailExists = await checkExists(
          "user",
          "user_id",
          null,
          "email",
          obj.email,
          "The Email"
        );
        if (checkemailExists.exists) {
          return sendResponse(res, false, null, checkemailExists.message);
        }
  
        const checkphoneExists = await checkExists(
          "user",
          "user_id",
          null,
          "phone",
          obj.phone,
          "The Phone Number"
        );
        if (checkphoneExists.exists) {
          return sendResponse(res, false, null, checkphoneExists.message);
        }
  
        const checkNameExists = await checkExists(
          "user",
          "user_id",
          null,
          "username",
          obj.username,
          "The Username"
        );
        if (checkNameExists.exists) {
          return sendResponse(res, false, null, checkNameExists.message);
        }
  
        // Add password and status to the object
        obj.password = req.body.password;
        obj.status = 1; // Ensure status is set to active
  
        // Insert new user and return the created user data
        const [newUser] = await knex("user").insert(obj).returning("*");
  
        if (!newUser) {
          return sendResponse(res, false, null, "Registration failed");
        }
  
        // Generate tokens
        const accessToken = generateAccessToken(newUser);
        const refreshToken = generateRefreshToken(newUser);
  
        // Save refresh token in the database
        await knex("user")
          .where({ user_id: newUser.user_id })
          .update({ refresh_token: refreshToken });
  
        // Set cookies
        const options = {
          httpOnly: false,
          secure: true,
          sameSite: "Strict",
        };
  
        return res
          .status(200)
          .cookie("accessToken", accessToken, options)
          .cookie("refreshToken", refreshToken, options)
          .json({ success: true, accessToken, message: "Registered Successfully" });
      }
    } catch (error) {
      logger.consoleErrorLog(req.originalUrl, "Error in saveUser", error);
      return sendResponse(res, false, null, "Error saving user details", statusType.DB_ERROR);
    }
  }

export const get_current_user = asyncHandler(async (req, res) => {
    const user = req.userInfo;
    // console.log(user)
    return sendResponse(res, true, {...user}, "User detials fetched successfully!");
});

export async function logout(req, res) {
    try {
        await knex("user")
            .where({ user_id: req.userInfo.user_id })
            .update({
                token_version: knex.raw("token_version + 1"),
                refresh_token: null
            });

        const options = {
            httpOnly: false,
            secure: true,
            sameSite: "Strict"
        };

        return res
            .status(200)
            .clearCookie("accessToken", options)
            .clearCookie("refreshToken", options)
            .json({ success: true, message: "Logged out successfully" });
    } catch (error) {
        logger.error(error);
        return sendResponse(res, false, null, "Logout failed");
    }
}

export async function refreshToken(req, res) {
    try {
        const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
        if (!refreshToken) return sendResponse(res, false, null, "Unauthorized", 401);

        const decoded = jwt.verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
        const user = await knex("user").where({ user_id: decoded.user_id }).first();

        if (
            !user ||
            user.refresh_token !== refreshToken ||
            user.token_version !== decoded.token_version
        ) {
            return sendResponse(res, false, null, "Invalid refresh token", 401);
        }

        const newAccessToken = generateAccessToken(user);
        const newRefreshToken = generateRefreshToken(user);

        await knex("user")
            .where({ user_id: user.user_id })
            .update({ refresh_token: newRefreshToken });

        const options = {
            httpOnly: false,
            secure: true,
            sameSite: "Strict"
        };

        return res
            .status(200)
            .cookie("accessToken", newAccessToken, options)
            .cookie("refreshToken", newRefreshToken, options)
            .json({ success: true, accessToken: newAccessToken });
    } catch (error) {
        return sendResponse(res, false, null, "Invalid refresh token", 401);
    }
}