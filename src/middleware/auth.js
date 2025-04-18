import express from "express"
import httpStatusCodes from "http-status-codes"

import { db } from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import { MiddlewareDomainErrGeneralStatusCode, MiddlewareDomainErrUnauthorized, MiddlewareDomainErrUserBanned, MiddlewareDomainGeneralSuccessStatusCode } from "#root/src/middleware/constant.js"

import { verifyJwt } from "#root/src/utils/auth.js"
import {
    arrayObjectSnakeCaseToCamelCasePropsConverter,
    singleObjectSnakeCaseToCamelCasePropsConverter
} from "#root/src/utils/string.js"

/**
 * Function to check whether the accessing request is authorized.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function isAuthorizedMiddleware(req, res, next) {
    // Prepare initial logging and response object.
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ authUtils.isAuthorizedMiddleware ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Unauthorized.",
        statusCode: MiddlewareDomainErrUnauthorized,
        result: null
    }

    // Get authorization header.
    const authorizationHeader = req.get("Authorization")
    if (authorizationHeader == null || authorizationHeader == "") {
        winstonLogger.info(baseMessage + " Authorization failed, no Authorization header found.")
        return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
    }

    // Get bearer token.
    if (!authorizationHeader.startsWith("Bearer ")) {
        winstonLogger.info(`${baseMessage} Authorization failed, Authorization header doesn't start with "Bearer ".`)
        return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
    }

    const token = authorizationHeader.split(" ")[1]

    // Verify jwt.
    try {
        const verifyJwtResult = await verifyJwt(reqIdentifier, token)

        req.decodedPayload = verifyJwtResult.decodedPayload

        winstonLogger.info(`${baseMessage} Authorization success, attaching decoded payload to request instance.`)
    } catch (error) {
        winstonLogger.info(`${baseMessage} ${error}`)
        return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
    }

    // Check user ban status and update if needed.

    return next()
}

/**
 * Function to return a function which check for currenctly accessing request's user role.
 * @param {string[]} roles Array of roles to be allowed when accessing protected endpoint.
 */
export function isRoleMiddleware(roles) {
    return async (req, res, next) => {
        // Prepare initial logging and response object.
        const reqIdentifier = req.reqIdentifier
        const baseMessage = `req-${reqIdentifier} - [ authUtils.isRoleMiddleware ] called.`

        winstonLogger.info(baseMessage)

        const response = {
            message: "Unauthorized.",
            statusCode: MiddlewareDomainErrUnauthorized,
            result: null
        }

        const {
            id,
            role
        } = req.decodedPayload

        const result = await db.tx(async t => {
            // Get user record.
            const userEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_user
                WHERE
                    id = $<id>
            `, { id: id })
            if (userEntity == null) {
                winstonLogger.info(`${baseMessage} Authorization failed, no user with id ${id} found.`)
                return {
                    statusCode: MiddlewareDomainGeneralSuccessStatusCode
                }
            }

            // Check for ban status.
            const memberBanEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_member_ban
                WHERE
                    member_user_id = $<id>
                    AND approval_status = 'BANNED'
                ORDER BY
                    created_at DESC
                LIMIT
                    1
            `, { id: req.decodedPayload.id })
            if (memberBanEntity != null) {
                const memberBan = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, memberBanEntity)
                const currentDate = new Date()
                const currentDateUnix = currentDate.getTime()
                const banLiftedDateUnix = memberBan.banLiftedAt.getTime()
                if (banLiftedDateUnix > currentDateUnix) {
                    winstonLogger.info(`${baseMessage} Authorization failed, user with id ${id} is currently banned and will be lifted at ${memberBan.banLiftedAt}.`)
                    return {
                        statusCode: MiddlewareDomainErrUserBanned
                    }
                }
            }

            return {
                statusCode: MiddlewareDomainGeneralSuccessStatusCode
            }
        })
        if (result.statusCode !== MiddlewareDomainGeneralSuccessStatusCode) {
            response.statusCode = result.statusCode
            return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
        }

        // Validate user role.
        if (roles.filter(r => r === role).length === 0) {
            winstonLogger.info(`${baseMessage} Authorization failed, access from user id ${id} is prohibited because the role is not one of ${roles}.`)
            return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
        }

        return next()
    }
}