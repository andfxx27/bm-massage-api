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
    MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrInvalidMassageOrderAndAuthorizedAdmin,
    MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrInvalidPathParamMassageOrderId,
    MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrMassageOrderAlreadyUpdated,
    MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrReqBodyValidation,
    MassageOrderDomainGeneralSuccessStatusCode,
    MassageOrderDomainMassageOrderStatusPending
} from "#root/src/domain/massage-order/constant.js"

import {
    UserDomainRoleAdmin,
    UserDomainRoleMember
} from "#root/src/domain/user/constant.js"

import {
    db,
    pgp,
    TblMassageOrderInsertColumnSet,
    TblMassageOrderUpdateOrderStatusColumnSet
} from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import {
    arrayObjectSnakeCaseToCamelCasePropsConverter,
    singleObjectSnakeCaseToCamelCasePropsConverter
} from "#root/src/utils/string.js"

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

        const { massagePackageId } = req.body
        const { id: memberUserId } = req.decodedPayload

        // Main create massage order flow.
        const result = await db.tx(async t => {
            // Validate massage package id.
            const massagePackageEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_package
                WHERE
                    id = $<id>  
            `, {
                id: massagePackageId
            })
            if (massagePackageEntity == null) {
                winstonLogger.info(`${baseMessage} Create massage order flow failed because massage package with id of ${massagePackageId} is not found.`)
                response.message = "Failed create massage order."
                return {
                    createdMassageOrder: null,
                    statusCode: MassageOrderDomainFailedCreateMassageOrderErrMassagePackageNotFound
                }
            }

            const massagePackage = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massagePackageEntity)

            /**
             * Validate massage package capacity.
             * Ongoing massage orders' count must not exceed massage package capacity.
             */
            const ongoingMassageOrdersEntity = await t.any(`
                SELECT 
                    * 
                FROM 
                    ms_massage_order 
                WHERE 
                    massage_package_id = $<massagePackageId> 
                    AND order_status = $<massageOrderStatus>
            `, {
                massagePackageId: massagePackageId,
                massageOrderStatus: MassageOrderDomainMassageOrderStatusPending
            })

            const ongoingMassageOrders = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, ongoingMassageOrdersEntity)
            if (ongoingMassageOrders.length === massagePackage.capacity) {
                winstonLogger.info(`${baseMessage} Create massage order flow failed because the current capacity of massage package with id of ${massagePackageId} is full.`)
                response.message = "Failed create massage order."
                return {
                    createdMassageOrder: null,
                    statusCode: MassageOrderDomainFailedCreateMassageOrderErrExceedsMassagePackageCapacity
                }
            }

            /**
             * Validate member's ongoing massage order.
             * If a member still have ongoing order, they can't create another massage order.
             * Need to check for ongoing massage orders with "PENDING" massage order status which is not updated to "EXPIRED" yet since we do it manually.
             * We can excuse those orders, allowing member to create a new massage order.
             * Massage order expiration time is 2 hours after the order creation date.
             */
            const massageOrdersEntity = await t.manyOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_order
                WHERE
                    member_user_id = $<memberUserId>
                    AND order_status = $<massageOrderStatus>    
            `, {
                memberUserId: memberUserId,
                massageOrderStatus: MassageOrderDomainMassageOrderStatusPending
            })
            if (massageOrdersEntity.length > 0) {
                const currentDate = new Date()
                const currentDateUnix = currentDate.getTime()
                const massageOrders = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massageOrdersEntity)
                const expiredMassageOrders = massageOrders.filter((massageOrder) => {
                    const expiredDateUnix = massageOrder.createdAt.getTime() + (2 * 60 * 60 * 1000)
                    return expiredDateUnix <= currentDateUnix
                })

                if (expiredMassageOrders.length < massageOrders.length) {
                    winstonLogger.info(`${baseMessage} Create massage order flow failed because user with id of ${memberUserId} still has ongoing massage order.`)
                    response.message = "Failed create massage order."
                    return {
                        createdMassageOrder: null,
                        statusCode: MassageOrderDomainFailedCreateMassageOrderErrOngoingMassageOrderExists
                    }
                }
            }

            // Create massage order record.
            const newMassageOrder = {
                memberUserId: memberUserId,
                massagePackageId: massagePackageId
            }
            const { insert } = pgp.helpers
            const insertMassageOrderRecordQuery = insert(newMassageOrder, TblMassageOrderInsertColumnSet) + " RETURNING *"
            const newMassageOrderEntity = await t.one(insertMassageOrderRecordQuery)

            return {
                createdMassageOrder: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, newMassageOrderEntity),
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

        const { id: userId, role: userRole } = req.decodedPayload

        // Main get ongoing massage orders flow.
        const result = await db.tx(async t => {
            // Get ongoing massage orders record.
            let query = ""
            switch (userRole) {
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
                            AND mmo.order_status = $<massageOrderStatus>
                        LIMIT
                            $<limit>
                        OFFSET
                            $<offset>
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
                            AND mmo.order_status = $<massageOrderStatus>
                        LIMIT
                            $<limit>
                        OFFSET
                            $<offset>
                    `
                    break
            }

            const ongoingMassageOrdersEntity = await t.manyOrNone(query, {
                userId: userId,
                massageOrderStatus: MassageOrderDomainMassageOrderStatusPending,
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                ongoingMassageOrders: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, ongoingMassageOrdersEntity),
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
        const massageOrderId = req.params.id

        // Validate massage order id to be a valid uuid.
        if (!validate(massageOrderId)) {
            winstonLogger.info(`${baseMessage} Get ongoing massage order by id flow failed because the massage order id is not a valid uuid.`)

            response.message = "Failed get ongoing massage order by id."
            response.statusCode = MassageOrderDomainFailedGetOngoingMassageOrderByIdErrInvalidPathParamMassageOrderId

            return res.status(httpStatusCodes.OK).json(response)
        }

        // Main get ongoing massage order by id flow.
        const result = await db.tx(async t => {
            // Validate massage order id.
            const massageOrder = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_order
                WHERE
                    id = $<id>
            `, {
                id: massageOrderId
            })
            if (massageOrder == null) {
                winstonLogger.info(`${baseMessage} Get ongoing massage order by id flow failed because massage order with id of ${massageOrderId} is not found.`)
                response.message = "Failed get ongoing massage order by id."
                return {
                    ongoingMassageOrder: null,
                    statusCode: MassageOrderDomainFailedGetOngoingMassageOrderByIdErrMassageOrderNotFound
                }
            }

            // Get ongoing massage order record by id.
            const ongoingMassageOrderEntity = await t.one(`
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
                WHERE
                    mmo.id = $<massageOrderId>
            `, {
                massageOrderId: massageOrderId
            })

            return {
                ongoingMassageOrder: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, ongoingMassageOrderEntity),
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

        const { id: adminUserId } = req.decodedPayload

        // Main get massage orders log history flow.
        const result = await db.tx(async t => {
            // Get massage orders log history record.
            const massageOrdersLogHistoryEntity = await t.manyOrNone(`
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
                    JOIN ms_massage_place_admin mmpa ON mmpa.massage_place_id = mmpkg.massage_place_id
                    JOIN ms_user mu ON mu.id = mmo.member_user_id
                WHERE mmpa.admin_user_id = $<adminUserId>
                LIMIT
                    $<limit>
                OFFSET
                    $<offset>
            `, {
                adminUserId: adminUserId,
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                massageOrdersLogHistory: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massageOrdersLogHistoryEntity),
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

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get massage order profit report flow.
        const result = await db.tx(async t => {
            // Get massage order profit report record.
            const massageOrderProfitReportEntity = await t.manyOrNone(`
                SELECT
                    mmo.created_at::date::text,
                    sum(mmpkg.price)::int AS profit
                FROM
                    ms_massage_order mmo
                    JOIN ms_massage_package mmpkg ON mmpkg.id = mmo.massage_package_id
                WHERE
                    mmo.order_status = 'COMPLETED'
                GROUP BY
                    mmo.created_at::date
                LIMIT
                    $<limit>
                OFFSET
                    $<offset>
            `, {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                massageOrderProfitReport: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massageOrderProfitReportEntity),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.massageOrderProfitReport = result.massageOrderProfitReport

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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
                    mu.id AS member_user_id,
                    mu.username AS member_username,
                    mu.email AS member_email,
                    count(mmo.order_status) FILTER (
                        WHERE
                            mmo.order_status = 'EXPIRED'
                    )::int AS expired_order_count,
                    count(mmo.order_status) FILTER (
                        WHERE
                            mmo.order_status = 'COMPLETED'
                    )::int AS completed_order_count,
                    mu.ban_status AS member_ban_status,
                    mu.created_at AS member_created_at
                FROM
                    ms_user mu
                    LEFT JOIN ms_massage_order mmo ON mmo.member_user_id = mu.id
                WHERE 
                    mu.role = 'MEMBER'
                GROUP BY
                    mu.id,
                    mu.username,
                    mu.email,
                    mmo.order_status,
                    mu.ban_status,
                    mu.created_at
                ORDER BY
                    mu.created_at DESC
                LIMIT
                    $<limit>
                OFFSET
                    $<offset>
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
 * Function to update massage order's order status by id.
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
        // Retrieve path params.
        const massageOrderId = req.params.id

        const { orderStatus } = req.body
        const { id: adminUserId } = req.decodedPayload

        // Validate that massage order id needs to be a valid uuid.
        if (!validate(massageOrderId)) {
            winstonLogger.info(`${baseMessage} Update massage order's order status by id flow failed because the massage order id is not a valid uuid.`)

            response.message = "Failed update massage order's order status by id."
            response.statusCode = MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrInvalidPathParamMassageOrderId

            return res.status(httpStatusCodes.OK).json(response)
        }

        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(`${baseMessage} Update massage order's order status by id flow failed because an error occurred during request body validation.`)

            response.message = "Failed update massage order's order status by id."
            response.statusCode = MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main update massage order's order status by id flow.
        const result = await db.tx(async t => {
            // Validate massage place admin eligibility to update the order status.
            const massageOrderEntity = await t.oneOrNone(`
                SELECT
                    mmo.*
                FROM
                    ms_massage_place_admin mmpa
                    JOIN ms_massage_place mmplc ON mmplc.id = mmpa.massage_place_id
                    JOIN ms_massage_package mmpkg ON mmpkg.massage_place_id = mmplc.id
                    JOIN ms_massage_order mmo ON mmo.massage_package_id = mmpkg.id
                WHERE
                    mmpa.admin_user_id = $<adminUserId>
                    AND mmo.id = $<massageOrderId>
            `, {
                adminUserId: adminUserId,
                massageOrderId: massageOrderId
            })
            if (massageOrderEntity == null) {
                winstonLogger.info(`${baseMessage} Update massage order's order status by id flow failed because the authorized admin might not work at the massage place where the order is created.`)
                response.message = "Failed update massage order's order status by id."
                return {
                    updatedMassageOrder: null,
                    statusCode: MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrInvalidMassageOrderAndAuthorizedAdmin
                }
            }

            const massageOrder = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massageOrderEntity)
            if (massageOrder.updatedAt != null) {
                winstonLogger.info(`${baseMessage} Update massage order's order status by id flow failed because massage order status for order with id of ${massageOrderId} is already updated.`)
                response.message = "Failed update massage order's order status by id."
                return {
                    updatedMassageOrder: null,
                    statusCode: MassageOrderDomainFailedUpdateMassageOrderOrderStatusByIdErrMassageOrderAlreadyUpdated
                }
            }

            // Update massage order's status record.
            const { update } = pgp.helpers
            const updatedMassageOrder = {
                orderStatus: orderStatus,
                adminUserId: adminUserId,
                updatedAt: new Date(),
                id: massageOrderId
            }
            const updateCondition = pgp.as.format(" WHERE id = ${id} RETURNING *", updatedMassageOrder)
            const updateMassageOrderRecordQuery = update(updatedMassageOrder, TblMassageOrderUpdateOrderStatusColumnSet) + updateCondition
            const updatedMassageOrderEntity = await t.one(updateMassageOrderRecordQuery)

            return {
                updatedMassageOrder: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, updatedMassageOrderEntity),
                statusCode: MassageOrderDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.updatedMassageOrder = result.updatedMassageOrder

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}