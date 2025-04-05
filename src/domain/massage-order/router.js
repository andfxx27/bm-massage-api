import express from "express"

import {
    createMassageOrder,
    getMassageOrderProfitReport,
    getMassageOrdersLogHistory,
    getMemberOrdersCountAndBanStatus,
    getOngoingMassageOrderById,
    getOngoingMassageOrders
} from "#root/src/domain/massage-order/controller.js"

export const router = express.Router()

router.post("/", createMassageOrder)
router.get("/ongoing", getOngoingMassageOrders)
router.get("/:id/ongoing", getOngoingMassageOrderById)
router.get("/log-history", getMassageOrdersLogHistory)
router.get("/profit-report", getMassageOrderProfitReport)
router.get("/member-count", getMemberOrdersCountAndBanStatus)