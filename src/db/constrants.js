import Knex from "knex";
import dotenv from "dotenv";

dotenv.config({
    path: "./.env"
});

const knex = Knex({
    client: "postgresql",
    connection: {
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        database: process.env.DB_NAME,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 3306,
        timezone: "Asia/Kolkata"
        // host: process.env.DB_HOST as string,
        // user: process.env.DB_USER as string,
        // database: process.env.DB_NAME as string,
        // password: "suthakar,,,",
        // port: 5432,
        // timezone: "utc",
        // ssl: { rejectUnauthorized: false },
    }
});

export function knexDb(DB_NAME) {
    return Knex({
        client: "postgresql",
        connection: {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            database: DB_NAME,
            password: process.env.DB_PASSWORD,
            port: Number(process.env.DB_PORT) || 3306,
            timezone: "Asia/Kolkata"
            // host: process.env.DB_HOST as string,
            // user: process.env.DB_USER as string,
            // database: DB_NAME,
            // password: "suthakar,,,",
            // port: 5432,
            // timezone: "utc",
            // ssl: { rejectUnauthorized: false },
        }
    });
}

export default knex;
