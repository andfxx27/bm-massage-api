import bcrypt from "bcrypt"
import express from "express"
import { validationResult } from "express-validator"
import httpStatusCodes from "http-status-codes"

import {
    MassagePlaceDomainFailedCreateMassagePlaceErrDuplicateAdminNames,
    MassagePlaceDomainFailedCreateMassagePlaceErrExistingPlaceWithSameNameAndAddressAndCityIdAlreadyExists,
    MassagePlaceDomainFailedCreateMassagePlaceErrNoDefaultAdminPass,
    MassagePlaceDomainFailedCreateMassagePlaceErrReqBodyValidation,
    MassagePlaceDomainFailedGetMassagePlacesErrInvalidCityIdsQueryParam,
    MassagePlaceDomainGeneralSuccessStatusCode
} from "#root/src/domain/massage-place/constant.js"

import {
    UserDomainGenderMale,
    UserDomainRoleAdmin,
    UserDomainRoleMember,
    UserDomainRoleOwner
} from "#root/src/domain/user/constant.js"

import {
    db,
    pgp,
    TblMassagePlaceAdminColumnSet,
    TblMassagePlaceColumnSet,
    TblUserColumnSet
} from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import {
    arrayObjectSnakeCaseToCamelCasePropsConverter,
    singleObjectSnakeCaseToCamelCasePropsConverter
} from "#root/src/utils/string.js"

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

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Create massage flow failed because an error occurred during request body validation.")

            response.message = "Failed create massage place."
            response.statusCode = MassagePlaceDomainFailedCreateMassagePlaceErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main create massage place flow.
        const result = await db.tx(async t => {
            // Check if provided admin names contain duplicates.
            if (new Set(req.body.adminNames).size !== req.body.adminNames.length) {
                winstonLogger.info(baseMessage + " Create massage flow failed because there is a duplicate admin names.")

                response.message = "Failed create massage place."

                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrDuplicateAdminNames
                }
            }

            // Check if default admin password exists.
            const defaultAdminPassword = process.env.MASSAGE_PLACE_ADMIN_DEFAULT_PASS
            if (!defaultAdminPassword) {
                winstonLogger.info(baseMessage + " Create massage flow failed because there is no default admin pass found.")

                response.message = "Failed create massage place."

                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrNoDefaultAdminPass
                }
            }

            // Check if provided massage place with same name, address, and city id already exists.
            const existingMassagePlace = await t.oneOrNone(`
                SELECT
                    *
                FROM ms_massage_place
                WHERE name = $<name> AND address = $<address> and city_id = $<cityId>  
            `, {
                name: req.body.name,
                address: req.body.address,
                cityId: req.body.cityId
            })
            if (existingMassagePlace != null) {
                winstonLogger.info(baseMessage + " Create massage flow failed because there is an existing place with same name, address, and city id.")

                response.message = "Failed create massage place."

                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrExistingPlaceWithSameNameAndAddressAndCityIdAlreadyExists
                }
            }

            // Create admin user record.
            const hashedDefaultAdminPassword = await bcrypt.hash(defaultAdminPassword, 10)
            const newAdmins = req.body.adminNames.map((fullname, i) => {
                const username = `${req.body.name.replace(/ /g, "")}${fullname.replace(/ /g, "")}${i}`.toLowerCase()
                return {
                    fullname: fullname,
                    gender: UserDomainGenderMale,
                    username: username,
                    email: `${username}@gmail.com`,
                    password: hashedDefaultAdminPassword,
                    role: UserDomainRoleAdmin
                }
            })

            const { insert } = pgp.helpers

            const createAdminUserRecordQuery = insert(newAdmins, TblUserColumnSet) + " RETURNING *"

            const createdAdminUsers = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.any(createAdminUserRecordQuery))

            // Create massage place record.
            const newMassagePlace = { ...req.body }
            newMassagePlace.ownerUserId = req.decodedPayload.id
            delete (newMassagePlace.adminNames)

            const createMassagePlaceRecordQuery = insert(newMassagePlace, TblMassagePlaceColumnSet) + " RETURNING *"

            const createdMassagePlace = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.one(createMassagePlaceRecordQuery))

            // Create massage place admins record.
            const newMassagePlaceAdmins = createdAdminUsers.map((user) => {
                return {
                    massagePlaceId: createdMassagePlace.id,
                    adminUserId: user.id
                }
            })

            const createMassagePlaceAdminsRecordQuery = insert(newMassagePlaceAdmins, TblMassagePlaceAdminColumnSet) + " RETURNING *"

            const createdMassagePlaceAdmins = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.any(createMassagePlaceAdminsRecordQuery))

            return {
                createdMassagePlace: {
                    ...createdMassagePlace,
                    admins: createdMassagePlaceAdmins
                },
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.createdMassagePlace = result.createdMassagePlace

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Retrieve query params.
        const page = +req.query.page ?? 1
        const limit = +req.query.limit ?? 15

        const cityIds = req.query.cityIds.split(",")
        if (req.query.cityIds && req.query.cityIds.split(",").length === 0) {
            response.message = "Failed get massage places."
            response.statusCode = MassagePlaceDomainFailedGetMassagePlacesErrInvalidCityIdsQueryParam

            return res.status(httpStatusCodes.OK).json(response)
        }

        // Main get massage places flow.
        const result = await db.tx(async t => {
            const role = req.decodedPayload.role

            let query = ""

            switch (role) {
                case UserDomainRoleOwner:
                    query = `
                        SELECT
                            mmp.id,
                            mmp.name,
                            mmp.max_capacity,
                            mmpa.admin_count::int,
                            mmp.address,
                            mmp.created_at
                        FROM (SELECT * FROM ms_massage_place LIMIT $<limit> OFFSET $<offset>) mmp JOIN (
                            SELECT COUNT(admin_user_id) AS admin_count, massage_place_id FROM ms_massage_place_admin GROUP BY massage_place_id
                        ) mmpa ON mmpa.massage_place_id  = mmp.id
                        WHERE mmp.city_id::text LIKE ANY($<cityIds>)
                    `
                    break
                case UserDomainRoleMember:
                    query = `
                        SELECT
                            mmp.id,
                            mmp.name,
                            0 AS current_capacity,
                            mmp.max_capacity,
                            mc."name" AS city_name,
                            mmp.address,
                            mmp.created_at
                        FROM (select * FROM ms_massage_place LIMIT $<limit> OFFSET $<offset>) mmp JOIN ms_city mc ON mmp.city_id = mc.id
                        WHERE mmp.city_id::text LIKE ANY($<cityIds>)
                    `
                    break
            }

            const massagePlaces = await t.any(query, {
                limit: limit,
                offset: (page - 1) * limit,
                cityIds: cityIds
            })

            return {
                massagePlaces: massagePlaces,
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.massagePlaces = result.massagePlaces

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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