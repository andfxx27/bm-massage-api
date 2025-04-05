import express from "express"
import httpStatusCodes from "http-status-codes"

import { MiddlewareDomainErrGeneralStatusCode } from "#root/src/middleware/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to catch all errors thrown from the try-catch inside all controllers.
 * @param {Error} err Error instance.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function defaultErrorHandlerMiddleware(err, req, res, next) {
    const baseMessage = `req-${req.reqIdentifier} - [ errorMiddleware.defaultErrorHandlerMiddleware ] called.`

    winstonLogger.info(`${baseMessage} ${err.stack}`)

    const response = {
        message: "An error occurred.",
        statusCode: MiddlewareDomainErrGeneralStatusCode,
        result: null
    }

    return res.status(httpStatusCodes.INTERNAL_SERVER_ERROR).json(response)
}