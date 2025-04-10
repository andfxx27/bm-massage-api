import express from "express"
import httpStatusCodes from "http-status-codes"

import { db } from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import { MiddlewareDomainErrUnauthorized } from "#root/src/middleware/constant.js"

import { verifyJwt } from "#root/src/utils/auth.js"

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

        // Get user record.
        await db.tx(async t => {
            const users = await t.manyOrNone(`SELECT * FROM ms_user WHERE id = $<id>`, { id: req.decodedPayload.id })
            if (users.length === 0) {
                winstonLogger.info(`${baseMessage} Authorization failed, no user with id ${req.decodedPayload.id} found.`)
                return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
            }
        })

        // Validate user role.
        if (roles.filter(r => r === req.decodedPayload.role).length === 0) {
            winstonLogger.info(`${baseMessage} Authorization failed, access from user id ${req.decodedPayload.id} is prohibited because the role is not one of ${roles}.`)
            return res.status(httpStatusCodes.UNAUTHORIZED).json(response)
        }

        return next()
    }
}