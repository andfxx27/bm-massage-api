import express from "express"
import httpStatusCodes from "http-status-codes"

import { CityDomainGeneralSuccessStatusCode } from "#root/src/domain/city/constant.js"

import { db } from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"
import { arrayObjectSnakeCaseToCamelCasePropsConverter } from "#root/src/utils/string.js"

/**
 * Function to get cities record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getCities(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ cityController.getCities ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get cities.",
        statusCode: CityDomainGeneralSuccessStatusCode,
        result: {
            cities: null
        }
    }

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get cities flow.
        const result = await db.tx(async t => {
            return await t.many("SELECT * FROM ms_city LIMIT $<limit> OFFSET $<offset>", { limit: limit, offset: (page - 1) * limit })
        })

        response.result.cities = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, result)

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}