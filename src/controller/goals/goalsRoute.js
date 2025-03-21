import { Router } from "express";
import { upload } from "../../middleware/multer.middleware.js";
import * as Goal from "./goalsController.js";

const router = Router();


router.route("/add").post(Goal.add_goals);

//verifyJWT
router.route("/get").get(Goal.get_all_goals);
// router.route("/logout").get(Statement.logout);

export default router;
