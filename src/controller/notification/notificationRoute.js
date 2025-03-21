import { Router } from "express";
import { upload } from "../../middleware/multer.middleware.js";
import * as Notification from "./notificationController.js";

const router = Router();


router.route("/update").post(Notification.updateNotification);
router.route("/get").get(Notification.getAllNotifications);

//verifyJWT
// router.route("/").get(Statement.get_current_user);
// router.route("/logout").get(Statement.logout);

export default router;
