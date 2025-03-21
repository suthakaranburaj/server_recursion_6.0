import { Router } from "express";
import { upload } from "../../middleware/multer.middleware.js";
import * as Statement from "./statementsController.js";

const router = Router();

router.route("/save").post(upload.single("statements"), Statement.uploadStatements);

router.route("/getAll").get(Statement.getStatements);

//verifyJWT
// router.route("/").get(Statement.get_current_user);
// router.route("/logout").get(Statement.logout);

export default router;
