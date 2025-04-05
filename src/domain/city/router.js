import express from "express"

import { getCities } from "#root/src/domain/city/controller.js"

import { UserDomainRoleMember, UserDomainRoleOwner } from "#root/src/domain/user/constant.js"

import { isRoleMiddleware } from "#root/src/middleware/auth.js"

export const router = express.Router()

router.get(
    "/",
    isRoleMiddleware([
        UserDomainRoleOwner,
        UserDomainRoleMember
    ]),
    getCities
)