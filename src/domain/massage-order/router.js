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

import { UserDomainRoleMember } from "#root/src/domain/user/constant.js"

import { isRoleMiddleware } from "#root/src/middleware/auth.js"

export const router = express.Router()

router.post(
    "/",
    body("massagePackageId", `Field "massagePackageId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    isRoleMiddleware([UserDomainRoleMember]),
    createMassageOrder
)
router.get("/ongoing", getOngoingMassageOrders)
router.get("/:id/ongoing", getOngoingMassageOrderById)
router.get("/log-history", getMassageOrdersLogHistory)
router.get("/profit-report", getMassageOrderProfitReport)
router.get("/member-count", getMemberOrdersCountAndBanStatus)