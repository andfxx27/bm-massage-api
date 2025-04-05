import express from "express"
import httpStatusCodes from "http-status-codes"

import { MassagePackageTypeDomainGeneralSuccessStatusCode } from "#root/src/domain/massage-package-type/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to get massage package types record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMassagePackageTypes(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePackageTypeController.getMassagePackageTypes ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get massage massage package types.",
        statusCode: MassagePackageTypeDomainGeneralSuccessStatusCode,
        result: {
            massagePackageTypes: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}