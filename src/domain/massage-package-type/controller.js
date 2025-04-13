import express from "express"
import httpStatusCodes from "http-status-codes"

import { MassagePackageTypeDomainGeneralSuccessStatusCode } from "#root/src/domain/massage-package-type/constant.js"

import { db } from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import { arrayObjectSnakeCaseToCamelCasePropsConverter } from "#root/src/utils/string.js"

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

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get massage package types flow.
        const result = await db.tx(async t => {
            // Get massage package types record.
            const massagePackageTypes = await t.any(`
                SELECT
                    *
                FROM
                    ms_massage_package_type
                LIMIT
                    $<limit>
                OFFSET
                    $<offset>
            `, {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                massagePackageTypes: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massagePackageTypes),
                statusCode: MassagePackageTypeDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.massagePackageTypes = result.massagePackageTypes

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}