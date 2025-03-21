export const sendResponse = function (res, status, data, message, statusCode = 200, apiVersion = null) {
    let obj = {
        status,
        data,
        message,
        // statusCode,
        apiVersion: apiVersion || "No Version"
    };
    return res.status(statusCode).json(obj);
};
