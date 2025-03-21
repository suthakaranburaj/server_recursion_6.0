import { Router } from "express";
import * as Subscription from "./subscriptionController.js";

const router = Router();


router.route("/add").post(Subscription.add_subscription);
router.route("/cancel").post(Subscription.cancel_subscription);

//verifyJWT
// router.route("/").get(Statement.get_current_user);
// router.route("/logout").get(Statement.logout);

export default router;
