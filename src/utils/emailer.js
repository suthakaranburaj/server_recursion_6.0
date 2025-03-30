import nodemailer from "nodemailer";
// Nodemailer transport configuration
const transporter = nodemailer.createTransport({
    // service: "gmail",
    host: "smtp-relay.sendinblue.com",
    port: 587,
    secure: false,
    auth: {
        user: "87b5b9002@smtp-brevo.com", // replace with your email
        pass: "hUzOpdAxwgLJyqtC" // replace with your password
    },

});

export default transporter;
