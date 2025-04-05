import express from "express"
import { v4 as uuidv4 } from "uuid"

import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to attach uuid to express request instance for every request-response lifecycle (for tracking purposes).
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function uuidAttacherMiddleware(req, res, next) {
    req.reqIdentifier = uuidv4()

    const baseMessage = `req-${req.reqIdentifier} - [ generalMiddleware.uuidAttacherMiddleware ] called.`

    winstonLogger.info(baseMessage)

    return next()
}