import express from "express";
import * as emailController from "./emailController.js";

const router = express.Router();

// Route to send OTP email
router.post("/send-otp", emailController.sendOtp);
router.post("/verify-otp", emailController.verifyOtp);

export default router;
