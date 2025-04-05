import express from "express"
import httpStatusCodes from "http-status-codes"

import { MassagePlaceDomainGeneralSuccessStatusCode } from "#root/src/domain/massage-place/constant.js"

import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to create massage place record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function createMassagePlace(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.createMassagePlace ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success create massage place.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            createdMassagePlace: null
        }
    }

    return res.status(httpStatusCodes.CREATED).json(response)
}

/**
 * Function to create massage package record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function createMassagePackage(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.createMassagePackage ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success create massage package.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            createdMassagePackage: null
        }
    }

    return res.status(httpStatusCodes.CREATED).json(response)
}

/**
 * Function to get massage places record.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMassagePlaces(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.getMassagePlaces ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get massage places.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            massagePlaces: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to get massage place record by id.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMassagePlaceById(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.getMassagePlaceById ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get massage place by id.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            massagePlace: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to update massage place record detail by id.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function updateMassagePlaceById(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.updateMassagePlaceById ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success update massage place by id.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            updatedMassagePlace: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}

/**
 * Function to update massage place record admins by id.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function updateMassagePlaceAdminsById(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ massagePlaceController.updateMassagePlaceAdminsById ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success update massage place admins by id.",
        statusCode: MassagePlaceDomainGeneralSuccessStatusCode,
        result: {
            updatedMassagePlace: null
        }
    }

    return res.status(httpStatusCodes.OK).json(response)
}