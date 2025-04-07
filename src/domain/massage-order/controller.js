import express from "express"
import { validationResult } from "express-validator"
import httpStatusCodes from "http-status-codes"

import {
    MassageOrderDomainFailedCreateMassageOrderErrExceedsMassagePackageCapacity,
    MassageOrderDomainFailedCreateMassageOrderErrMassagePackageNotFound,
    MassageOrderDomainFailedCreateMassageOrderErrOngoingMassageOrderExists,
    MassageOrderDomainFailedCreateMassageOrderErrReqBodyValidation,
    MassageOrderDomainGeneralSuccessStatusCode
} from "#root/src/domain/massage-order/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"
import {
    db,
    pgp,
    TblMassageOrderColumnSet
} from "#root/src/config/database.js"
import { arrayObjectSnakeCaseToCamelCasePropsConverter } from "#root/src/utils/string.js"

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

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Create massage order flow failed because an error occurred during request body validation.")

            response.message = "Failed create massage order."
            response.statusCode = MassageOrderDomainFailedCreateMassageOrderErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main create massage order flow.
        const result = await db.tx(async t => {
            // Check if provided massage package id is valid.
            const massagePackage = await t.oneOrNone("SELECT * FROM ms_massage_package WHERE id = $<id>", { id: req.body.massagePackageId })
            if (massagePackage == null) {
                winstonLogger.info(baseMessage + " Create massage order flow failed because of invalid massage package id.")

                return {
                    createdMassageOrder: null,
                    statusCode: MassageOrderDomainFailedCreateMassageOrderErrMassagePackageNotFound
                }
            }

            // Check whether the package is available (by checking its capacity).
            const ongoingMassageOrders = await t.any("SELECT * FROM ms_massage_order WHERE massage_package_id = $<id> AND order_status = 'PENDING'", { id: req.body.massagePackageId })
            if (ongoingMassageOrders.length === massagePackage.capacity) {
                winstonLogger.info(baseMessage + " Create massage order flow failed because of the selected massage package is full/ exceeds capacity.")

                return {
                    createdMassageOrder: null,
                    statusCode: MassageOrderDomainFailedCreateMassageOrderErrExceedsMassagePackageCapacity
                }
            }

            // Validate that the user is currently free/ don't have ongoing massage order.
            const authorizedMemberMassageOrders = await t.any("SELECT * FROM ms_massage_order WHERE member_user_id = $<memberUserId> AND order_status = 'PENDING'", { memberUserId: req.decodedPayload.id })
            if (authorizedMemberMassageOrders.length > 0) {
                // There could possibly be massage orders with "PENDING" status which is not updated to "EXPIRED" yet since we do it manually.
                // We can excuse those orders, therefore allowing member to create a new massage order.
                // Massage order expiration time is 2 hours after the order creation date.

                const currentDate = new Date()
                const currentDateUnix = currentDate.getTime()
                const convertedAuthorizedMemberMassageOrders = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, authorizedMemberMassageOrders)
                const expiredMassageOrders = convertedAuthorizedMemberMassageOrders.filter((order) => {
                    const expiredDateUnix = order.createdAt.getTime() + (2 * 60 * 60 * 1000)
                    if (expiredDateUnix <= currentDateUnix) {
                        return order
                    }
                })

                if (expiredMassageOrders.length !== authorizedMemberMassageOrders.length) {
                    winstonLogger.info(baseMessage + " Create massage order flow failed because authorized member still has ongoing massage order.")

                    return {
                        createdMassageOrder: null,
                        statusCode: MassageOrderDomainFailedCreateMassageOrderErrOngoingMassageOrderExists
                    }
                }
            }

            // Create massage order record.
            const { insert } = pgp.helpers
            const createMassageOrderQuery = insert({ memberUserId: req.decodedPayload.id, massagePackageId: req.body.massagePackageId }, TblMassageOrderColumnSet) + " RETURNING *"
            const createdMassageOrder = await t.one(createMassageOrderQuery)

            return {
                createdMassageOrder: createdMassageOrder,
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.createdMassageOrder = result.createdMassageOrder

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        return next(error)
    }
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