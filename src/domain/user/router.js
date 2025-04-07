import express from "express"
import { body } from "express-validator"

import {
    signUp,
    signIn,
    requestMemberBanApproval,
    approveMemberBanRequest,
    getMemberBanApprovalRequests
} from "#root/src/domain/user/controller.js"
import {
    UserDomainRoleAdmin,
    UserDomainRoleOwner
} from "#root/src/domain/user/constant.js"

import {
    isAuthorizedMiddleware,
    isRoleMiddleware
} from "#root/src/middleware/auth.js"

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
router.post(
    "/member-ban",
    body("memberUserId", `Field "memberUserId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    body("banReason", `Field "banReason" must be a valid alphabetical value.`).notEmpty().isAlpha("en-US", { ignore: [" "] }),
    isAuthorizedMiddleware,
    isRoleMiddleware([UserDomainRoleAdmin]),
    requestMemberBanApproval
)
router.patch(
    "/member-ban",
    body("banRequestId", `Field "banRequestId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    body("memberUserId", `Field "memberUserId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    body("banApprovalStatus", `Field "banApprovalStatus" must be either "BANNED" or "REVOKED".`).notEmpty().isIn(["BANNED", "REVOKED"]),
    isAuthorizedMiddleware,
    isRoleMiddleware([UserDomainRoleOwner]),
    approveMemberBanRequest
)
router.get(
    "/member-ban",
    isAuthorizedMiddleware,
    isRoleMiddleware([UserDomainRoleOwner]),
    getMemberBanApprovalRequests
)