// controllers/auth/sendOtpEmail.js
import transporter from "../../utils/emailer.js";
import { sendResponse } from "../../utils/apiResponse.js";
import statusType from "../../helper/enum/statusTypes.js";

const otpStore = new Map();

const generateOtp = () => {
    return Math.floor(100000 + Math.random() * 900000); 
};

export const sendOtp = (req, res) => {
    const { email } = req.body;
    if (!email) {
        return sendResponse(res, false, null, "Email is required", statusType.BAD_REQUEST);
    }

    const otp = generateOtp();
    console.log(otp)
    const expiration = Date.now() + 300000;

    otpStore.set(email, { otp, expiration });

    const mailOptions = {
        from: {
            name: "Team CoreX",
            address: "suthakaranburaj@gmail.com"
        },
        to: email,
        subject: "OTP Verification from Team CoreX",
        text: `Your OTP is: ${otp}`
    };

    transporter.sendMail(mailOptions, (error) => {
        if (error) {
            console.error("Error sending email:", error);
            return sendResponse(res, false, null, "Error sending OTP", statusType.BAD_REQUEST);
        }
        return sendResponse(res, true, null, "OTP sent successfully", statusType.SUCCESS);
    });
};

export const verifyOtp = (req, res) => {
    const { email, otp } = req.body;
    const storedData = otpStore.get(email);

    if (!storedData) {
        return sendResponse(res, false, null, "OTP expired or not found", statusType.BAD_REQUEST);
    }

    if (Date.now() > storedData.expiration) {
        otpStore.delete(email);
        return sendResponse(res, false, null, "OTP expired", statusType.BAD_REQUEST);
    }

    if (storedData.otp !== parseInt(otp)) {
        return sendResponse(res, false, null, "Invalid OTP", statusType.BAD_REQUEST);
    }

    otpStore.delete(email);
    return sendResponse(res, true, null, "OTP verified successfully", statusType.SUCCESS);
};
