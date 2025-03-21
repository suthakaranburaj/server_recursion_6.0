import { Router } from "express";
import { upload } from "../../middleware/multer.middleware.js";
import * as Statement from "./statementsController.js";

const router = Router();

router.route("/save").post(upload.single("statements"), Statement.uploadStatements);

router.route("/getAll").get(Statement.getStatements);
router.route("/get_all_transactions/:user_statement_id").get(Statement.getAllTransaction);
router.route("/stats").get(Statement.getDashBoardStats);
router.route("/add_t").post(Statement.add_transaction);

//verifyJWT
// router.route("/").get(Statement.get_current_user);
// router.route("/logout").get(Statement.logout);

export default router;
