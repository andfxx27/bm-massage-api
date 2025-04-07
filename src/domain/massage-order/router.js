import express from "express"
import { body } from "express-validator"

import {
    createMassageOrder,
    getMassageOrderProfitReport,
    getMassageOrdersLogHistory,
    getMemberOrdersCountAndBanStatus,
    getOngoingMassageOrderById,
    getOngoingMassageOrders
} from "#root/src/domain/massage-order/controller.js"

import { UserDomainRoleAdmin, UserDomainRoleMember } from "#root/src/domain/user/constant.js"

import { isRoleMiddleware } from "#root/src/middleware/auth.js"

export const router = express.Router()

router.post(
    "/",
    body("massagePackageId", `Field "massagePackageId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    isRoleMiddleware([UserDomainRoleMember]),
    createMassageOrder
)
router.get(
    "/ongoing",
    isRoleMiddleware([UserDomainRoleAdmin, UserDomainRoleMember]),
    getOngoingMassageOrders
)
router.get(
    "/:id/ongoing",
    isRoleMiddleware([UserDomainRoleAdmin]),
    getOngoingMassageOrderById
)
router.get(
    "/log-history",
    isRoleMiddleware([UserDomainRoleAdmin]),
    getMassageOrdersLogHistory
)
router.get("/profit-report", getMassageOrderProfitReport)
router.get("/member-count", getMemberOrdersCountAndBanStatus)