import express from "express"
import { body, oneOf } from "express-validator"

import {
    signUp,
    signIn,
    requestMemberBanApproval,
    approveMemberBanRequest
} from "#root/src/domain/user/controller.js"

export const router = express.Router()

router.post(
    "/sign-up",
    body("gender", `Field "gender" value must be either "MALE" or "FEMALE".`).notEmpty().isIn(["MALE", "FEMALE"]),
    body("fullname", `Field "fullname" must be a valid alphabetical value.`).notEmpty().isAlpha("en-US", { ignore: [" "] }),
    body("username", `Field "username" must be a valid alphanumeric value.`).notEmpty().isAlphanumeric(),
    body("email", `Field "email" must be a valid email address.`).isEmail(),
    body("password", `Field "password" must be a strong password with minimum length of 8 chars.`).isStrongPassword({ minLength: 8 }),
    signUp
)
router.post("/sign-in", signIn)
router.post("/member-ban", requestMemberBanApproval)
router.patch("/member-ban", approveMemberBanRequest)