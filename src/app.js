import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import { verifyToken } from "./middleware/verifyToken.js";

import userRouter from "./controller/User/userRoutes.js";
import emailRouter from "./controller/email/emailRoute.js";
import statementRouter from "./controller/statements/statementsRoute.js";
// import loginRoute from "./controllers/Login/loginRoute";

const app = express();

dotenv.config({
    path: "./.env"
});

app.use(
    cors({
        origin: [
            `http://localhost:${process.env.CLIENT_ORIGIN_PORT}`,
            "http://localhost:5174",
            `http://localhost:5173`
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

app.use(verifyToken);
app.use("/api/v1/statements", statementRouter);
// app.use("/api/v1/login", loginRoute);

export default app;
