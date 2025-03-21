import { validateEmail } from "../../helper/CommonHelper.js";

export function validateUserData(data) {
    const { name, email,phone,username } = data;

    if (!name || typeof name !== "string") return { status: false, message: "Name not provided" };

    if (!email || !validateEmail(email)) return { status: false, message: "Email not provided" };

    if (!username || typeof username !== 'string') return { status: false, message: "Username not provided" };

    if (!phone || typeof phone !== 'string') return { status: false, message: "Phone Number not provided" };

    // if (!role || isNaN(role)) return { status: false, message: "Role not provided" };

    return { status: true };
}
