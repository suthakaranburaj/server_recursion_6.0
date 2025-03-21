import { Router } from "express";
import { upload } from "../../middleware/multer.middleware.js";
import { verifyToken } from "../../middleware/verifyToken.js";
import * as User from "./userController.js"

const router = Router();

router.route("/save").post(
    upload.fields([
        {
            name: "image",
            maxCount: 1
        },
    ]),
    User.save_user
);

router.route("/login").post(User.Login);

//verifyJWT
router.use(verifyToken);
router.route("/").get(User.get_current_user);
router.route("/logout").get(User.logout);


export default router;