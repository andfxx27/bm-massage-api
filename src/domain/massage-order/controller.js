import express from "express"
import httpStatusCodes from "http-status-codes"

import { MassageOrderDomainGeneralSuccessStatusCode } from "#root/src/domain/massage-order/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to create massage order record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function createMassageOrder(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.createMassageOrder ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success create massage order.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            createdMassageOrder: null
        }
    }

    return res.status(httpStatusCodes.CREATED).json(response)
}

/**
 * Function to get ongoing massage orders record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getOngoingMassageOrders(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.getOngoingMassageOrders ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get ongoing massage orders.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            ongoingMassageOrders: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to get ongoing massage order record by id.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getOngoingMassageOrderById(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.getOngoingMassageOrderById ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get ongoing massage order by id.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            ongoingMassageOrder: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to get massage orders log history record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMassageOrdersLogHistory(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.getMassageOrdersLogHistory ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get massage orders log history.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            massageOrdersLogHistory: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to get massage order profit report.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMassageOrderProfitReport(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.getMassageOrderProfitReport ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get massage order profit report.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            massageOrderProfitReport: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to get member's order count (completed, expired) & ban status.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMemberOrdersCountAndBanStatus(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.getMemberOrdersCountAndBanStatus ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get member orders count and ban status.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            memberOrdersCountAndBanStatus: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}