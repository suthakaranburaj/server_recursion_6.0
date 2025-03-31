import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { verifyToken } from "./middleware/verifyToken.js";

import userRouter from "./controller/User/userRoutes.js";
import emailRouter from "./controller/email/emailRoute.js";
import statementRouter from "./controller/statements/statementsRoute.js";
import NotificationRouter from "./controller/notification/notificationRoute.js";
import SubscriptionRouter from './controller/subscription/subscriptionRoute.js'
import GoalRouter from './controller/goals/goalsRoute.js'
import web3Routes from './controller/web3/web3Route.js'

const app = express();

dotenv.config({
    path: "./.env"
});

app.use(
    cors({
        origin: [
            `http://localhost:${process.env.CLIENT_ORIGIN_PORT}`,
            "http://localhost:5174",
            `http://localhost:5173`,
            "http://localhost:8000"
        ],
        credentials: true
    })
);

app.use(express.json({ limit: "16kb" }));
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());

app.use("/api/v1/user", userRouter);
app.use("/api/v1/email", emailRouter);

app.use("/api/v1/web3", web3Routes);
app.use(verifyToken);
app.use("/api/v1/statements", statementRouter);
app.use("/api/v1/notification", NotificationRouter);
app.use("/api/v1/subscription", SubscriptionRouter);
app.use("/api/v1/goals", GoalRouter);

export default app;
