import express from "express"
import { validationResult } from "express-validator"
import httpStatusCodes from "http-status-codes"
import { validate } from "uuid"

import {
    MassageOrderDomainFailedCreateMassageOrderErrExceedsMassagePackageCapacity,
    MassageOrderDomainFailedCreateMassageOrderErrMassagePackageNotFound,
    MassageOrderDomainFailedCreateMassageOrderErrOngoingMassageOrderExists,
    MassageOrderDomainFailedCreateMassageOrderErrReqBodyValidation,
    MassageOrderDomainFailedGetOngoingMassageOrderByIdErrInvalidPathParamMassageOrderId,
    MassageOrderDomainFailedGetOngoingMassageOrderByIdErrMassageOrderNotFound,
    MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrReqBodyValidation,
    MassageOrderDomainGeneralSuccessStatusCode
} from "#root/src/domain/massage-order/constant.js"

import {
    UserDomainRoleAdmin,
    UserDomainRoleMember
} from "#root/src/domain/user/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"
import {
    db,
    pgp,
    TblMassageOrderColumnSet
} from "#root/src/config/database.js"

import { arrayObjectSnakeCaseToCamelCasePropsConverter, singleObjectSnakeCaseToCamelCasePropsConverter } from "#root/src/utils/string.js"

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
                createdMassageOrder: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, createdMassageOrder),
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

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get ongoing massage orders flow.
        const result = await db.tx(async t => {
            let query = ""

            const role = req.decodedPayload.role
            switch (role) {
                case UserDomainRoleAdmin:
                    query = `
                        SELECT
                            mmo.id AS massage_order_id,
                            mmpt."name" AS massage_package_type_name,
                            mu.username AS member_username,
                            mmp.price AS massage_package_price,
                            mmo.order_status AS massage_order_status,
	                        mmo.created_at + interval '2 hour' AS massage_order_expired_at,
                            mmo.created_at AS massage_order_created_at
                        FROM
                            ms_massage_order mmo 
                                JOIN ms_user mu ON mu.id = mmo.member_user_id
                                JOIN ms_massage_package mmp ON mmp.id = mmo.massage_package_id
                                JOIN ms_massage_package_type mmpt ON mmpt.id = mmp.massage_package_type_id
                                JOIN ms_massage_place_admin mmpa ON mmpa.massage_place_id = mmp.massage_place_id
                        WHERE 
                            mmpa.admin_user_id = $<userId> 
                            AND
                            mmo.order_status = 'PENDING'
                        LIMIT $<limit> OFFSET $<offset>
                    `
                    break
                case UserDomainRoleMember:
                    query = `
                        SELECT
                            mmo.id AS massage_order_id,
                            mmpkg."name" AS massage_package_name,
                            mmplc."name" AS massage_place_name,
                            mc."name" AS massage_place_city_name,
                            mmo.created_at + interval '2 hour' AS massage_order_expired_at,
                            mmo.created_at AS massage_order_created_at
                        FROM 
                            ms_massage_order mmo
                                JOIN ms_massage_package mmpkg ON mmpkg.id = mmo.massage_package_id
                                JOIN ms_massage_place mmplc ON mmplc.id = mmpkg.massage_place_id
                                JOIN ms_city mc ON mc.id = mmplc.city_id
                        WHERE 
                            mmo.member_user_id = $<userId>
                            AND
                            mmo.order_status = 'PENDING'
                        LIMIT $<limit> OFFSET $<offset>
                    `
                    break
            }

            const ongoingMassageOrders = await t.manyOrNone(query, {
                userId: req.decodedPayload.id,
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                ongoingMassageOrders: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, ongoingMassageOrders),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.ongoingMassageOrders = result.ongoingMassageOrders

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Retrieve path params.
        const id = req.params.id

        // Validate that massage order id needs to be a valid uuid.
        if (!validate(id)) {
            winstonLogger.info(baseMessage + " Get ongoing massage order by id flow failed because of invalid uuid id provided on the path param.")

            response.message = "Failed get ongoing massage order by id."
            response.statusCode = MassageOrderDomainFailedGetOngoingMassageOrderByIdErrInvalidPathParamMassageOrderId

            return res.status(httpStatusCodes.OK).json(response)
        }

        // Main get ongoing massage order by id flow.
        const result = await db.tx(async t => {
            // Validate that the provided massage order id is valid.
            const massageOrder = await t.oneOrNone("SELECT * FROM ms_massage_order WHERE id = $<id>", { id: id })
            if (massageOrder == null) {
                winstonLogger.info(baseMessage + " Get ongoing massage order by id flow failed because the massage order is not found.")

                return {
                    createdMassageOrder: null,
                    statusCode: MassageOrderDomainFailedGetOngoingMassageOrderByIdErrMassageOrderNotFound
                }
            }

            const ongoingMassageOrder = await t.one(`
                SELECT
                    mmo.id AS massage_order_id,
                    mmpt."name" AS massage_package_type_name,
                    mmpkg."name" AS massage_package_name,
                    mmpkg.price AS massage_package_price,
                    mu.username AS member_username,
                    mu.gender AS member_gender,
                    mu.email AS member_email,
                    mmo.created_at + interval '2 hour' AS massage_order_expired_at,
                    mmo.created_at AS massage_order_created_at
                FROM
                    ms_massage_order mmo
                        JOIN ms_massage_package mmpkg ON mmpkg.id = mmo.massage_package_id
                        JOIN ms_massage_package_type mmpt ON mmpt.id = mmpkg.massage_package_type_id
                        JOIN ms_user mu ON mu.id = mmo.member_user_id
                WHERE mmo.id = $<massageOrderId>
            `, {
                massageOrderId: id
            })

            return {
                ongoingMassageOrder: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, ongoingMassageOrder),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.ongoingMassageOrder = result.ongoingMassageOrder

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get massage orders log history flow.
        const result = await db.tx(async t => {
            const massageOrdersLogHistory = await t.any(`
                SELECT
                    mmo.id AS massage_order_id,
                    mu.email AS member_email,
                    mu.username AS member_username,
                    mu.gender AS member_gender,
                    mmpt."name" AS massage_package_type_name,
                    mmpkg."name" AS massage_package_name,
                    mmpkg.price AS massage_package_price,
                    mmo.order_status AS massage_order_status,
                    mmo.created_at + interval '2 hour' AS massage_order_expired_at,
                    mmo.created_at AS massage_order_created_at
                FROM
                    ms_massage_order mmo
                        JOIN ms_massage_package mmpkg ON mmpkg.id = mmo.massage_package_id
                        JOIN ms_massage_package_type mmpt ON mmpt.id = mmpkg.massage_package_type_id
                        JOIN ms_user mu ON mu.id = mmo.member_user_id
                LIMIT $<limit> OFFSET $<offset>
            `, {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                massageOrdersLogHistory: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massageOrdersLogHistory),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.massageOrdersLogHistory = result.massageOrdersLogHistory

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get member orders count and ban status flow.
        const result = await db.tx(async t => {
            const memberOrdersCountAndBanStatus = await t.any(`
                SELECT
                    mu.username AS member_username,
                    mu.email AS member_email,
                    count(mmo.order_status) filter(where mmo.order_status = 'EXPIRED')::int AS expired_order_count,
                    count(mmo.order_status) filter(where mmo.order_status = 'COMPLETED')::int AS completed_order_count,
                    mu.ban_status AS member_ban_status,
                    mu.created_at AS member_created_at
                FROM
                    ms_user mu
                        JOIN ms_massage_order mmo on mmo.member_user_id = mu.id
                GROUP BY member_username, member_email, mmo.order_status, member_ban_status, mu.created_at
                ORDER BY mu.created_at DESC
                LIMIT $<limit> OFFSET $<offset>
            `, {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                memberOrdersCountAndBanStatus: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, memberOrdersCountAndBanStatus),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.memberOrdersCountAndBanStatus = result.memberOrdersCountAndBanStatus

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}

/**
 * Function to update massage order's order status.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function updateMassageOrderOrderStatusById(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massageOrderController.updateMassageOrderOrderStatusById ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success update massage order's order status by id.",
        statusCode: MassageOrderDomainGeneralSuccessStatusCode,
        result: {
            updatedMassageOrder: null
        }
    }

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Update massage order's order status by id flow failed because an error occurred during request body validation.")

            response.message = "Failed update massage order's order status by id."
            response.statusCode = MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}