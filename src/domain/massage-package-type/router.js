import express from "express"

import { getMassagePackageTypes } from "#root/src/domain/massage-package-type/controller.js"

import {
    UserDomainRoleAdmin
} from "#root/src/domain/user/constant.js"

import { isRoleMiddleware } from "#root/src/middleware/auth.js"

export const router = express.Router()

router.get(
    "/",
    isRoleMiddleware([UserDomainRoleAdmin]),
    getMassagePackageTypes
)