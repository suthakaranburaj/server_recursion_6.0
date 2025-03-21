import express from "express";
import app from "./app.js";
import pool from "./db/index.js";
import dotenv from "dotenv";
const PORT = process.env.PORT;

dotenv.config({
    path: "./.env"
});

app.use(express.json());

app.listen(PORT, async () => {
    try {
        await pool.query("SELECT NOW()");
        console.log(`Server is running on port ${PORT}`);
    } catch (error) {
        console.error("Database connection failed:", error);
    }
});
