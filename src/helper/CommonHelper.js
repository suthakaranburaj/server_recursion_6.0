import knex from "../db/constrants.js";


export function getObjOrNull(obj) {
    return obj ? obj : null;
}

export function getIntOrNull(val) {
    try {
        if (val !== null && val !== undefined && !isNaN(val) && parseInt(val) >= 0) {
            return parseInt(val);
        }
        return null;
    } catch (err) {
        return null;
    }
}

export function getOneOrZero(item) {
    if (item) {
        if (typeof item === "string" && ["no", "n", "0"].includes(item.toLowerCase())) {
            return 0;
        }
        return 1;
    }
    return 0;
}

export async function checkExists(
    table_name,
    id_name,
    id,
    compare_column,
    compare_str,
    paramFirstString
) {
    const [checkExists] = await knex(table_name).where((builder) => {
        builder.where(compare_column, compare_str);
        if (id && !isNaN(id)) builder.whereNot(id_name, id);
    });

    if (checkExists) {
        return { exists: true, message: `${paramFirstString} ${compare_str} Already Exists` };
    }

    return { exists: false };
}

export const validateEmail = (email) => {
    if (/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/.test(email)) {
        return true;
    }
    return false;
};

export const createNotification = async (message, type, userId, status = true) => {
    try {
        const [notification] = await knex("notification")
            .insert({
                message,
                type,
                user_id: userId,
                status,
                is_read: false
            })
            .returning("*");
        return notification;
    } catch (error) {
        console.log("Error creating notification:", error);
        throw error;
    }
};