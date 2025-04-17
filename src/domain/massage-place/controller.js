import bcrypt from "bcrypt"
import express from "express"
import { validationResult } from "express-validator"
import httpStatusCodes from "http-status-codes"
import { validate } from "uuid"

import {
    MassagePlaceDomainFailedCreateMassagePackageErrExceedsMaxCapacity,
    MassagePlaceDomainFailedCreateMassagePackageErrInvalidMassagePlaceAndAdminUserId,
    MassagePlaceDomainFailedCreateMassagePackageErrInvalidPathParamMassagePlaceId,
    MassagePlaceDomainFailedCreateMassagePackageErrMassagePackageTypeNotFound,
    MassagePlaceDomainFailedCreateMassagePackageErrMassagePlaceNotFound,
    MassagePlaceDomainFailedCreateMassagePackageErrReqBodyValidation,
    MassagePlaceDomainFailedCreateMassagePlaceErrCityNotFound,
    MassagePlaceDomainFailedCreateMassagePlaceErrDuplicateAdminNames,
    MassagePlaceDomainFailedCreateMassagePlaceErrExistingPlaceWithSameNameAndAddressAndCityIdAlreadyExists,
    MassagePlaceDomainFailedCreateMassagePlaceErrNoDefaultAdminPass,
    MassagePlaceDomainFailedCreateMassagePlaceErrReqBodyValidation,
    MassagePlaceDomainFailedGetMassagePlaceByIdErrInvalidPathParamMassagePlaceId,
    MassagePlaceDomainFailedGetMassagePlaceByIdErrMassagePlaceNotFound,
    MassagePlaceDomainFailedGetMassagePlacesErrInvalidCityIdsQueryParam,
    MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrInvalidAdminObjectArray,
    MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrNoDefaultAdminPass,
    MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrReqBodyValidation,
    MassagePlaceDomainFailedUpdateMassagePlaceByIdErrConflictingNameAndAddress,
    MassagePlaceDomainFailedUpdateMassagePlaceByIdErrInvalidMaxCapacityValue,
    MassagePlaceDomainFailedUpdateMassagePlaceByIdErrMassagePlaceNotFound,
    MassagePlaceDomainFailedUpdateMassagePlaceByIdErrReqBodyValidation,
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
    TblMassagePackageInsertColumnSet,
    TblMassagePlaceAdminColumnSet,
    TblMassagePlaceAdminInsertColumnSet,
    TblMassagePlaceInsertColumnSet,
    TblUserInsertColumnSet,
    TblUserUpdateColumnSet
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
            winstonLogger.info(`${baseMessage} Create massage place flow failed because an error occurred during request body validation.`)

            response.message = "Failed create massage place."
            response.statusCode = MassagePlaceDomainFailedCreateMassagePlaceErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        const {
            name,
            address,
            cityId,
            adminNames
        } = req.body
        const { id: ownerUserId } = req.decodedPayload

        // Main create massage place flow.
        const result = await db.tx(async t => {
            // Check if provided admin names contain duplicates.
            if (new Set(req.body.adminNames).size !== req.body.adminNames.length) {
                winstonLogger.info(`${baseMessage} Create massage place flow failed because there is a duplicate admin names.`)
                response.message = "Failed create massage place."
                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrDuplicateAdminNames
                }
            }

            // Check if default admin password exists.
            const defaultAdminPassword = process.env.MASSAGE_PLACE_ADMIN_DEFAULT_PASS
            if (!defaultAdminPassword) {
                winstonLogger.info(`${baseMessage} Create massage place flow failed because there is no default admin pass found.`)
                response.message = "Failed create massage place."
                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrNoDefaultAdminPass
                }
            }

            // Validate city id.
            const cityEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_city
                WHERE
                    id = $<cityId>
            `, {
                cityId: cityId
            })
            if (cityEntity == null) {
                winstonLogger.info(`${baseMessage} Create massage place flow failed because the city with id of ${cityId} is not found.`)
                response.message = "Failed create massage place."
                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrCityNotFound
                }
            }

            // Check if provided massage place with same name, address, and city id already exists.
            const existingMassagePlaceEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_place
                WHERE
                    name = $<name>
                    AND address = $<address>
                    AND city_id = $<cityId> 
            `, {
                name: name,
                address: address,
                cityId: cityId
            })
            if (existingMassagePlaceEntity != null) {
                winstonLogger.info(`${baseMessage} Create massage place flow failed because there is an existing place with same name, address, and city id.`)
                response.message = "Failed create massage place."
                return {
                    createdMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePlaceErrExistingPlaceWithSameNameAndAddressAndCityIdAlreadyExists
                }
            }

            // Create admin user record.
            const hashedDefaultAdminPassword = await bcrypt.hash(defaultAdminPassword, 10)
            const newAdmins = adminNames.map((fullname, i) => {
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
            const createAdminUserRecordQuery = insert(newAdmins, TblUserInsertColumnSet) + " RETURNING *"

            const createdAdminUsers = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.any(createAdminUserRecordQuery))

            // Create massage place record.
            const newMassagePlace = { ...req.body }
            newMassagePlace.ownerUserId = ownerUserId
            delete (newMassagePlace.adminNames)
            const createMassagePlaceRecordQuery = insert(newMassagePlace, TblMassagePlaceInsertColumnSet) + " RETURNING *"

            const createdMassagePlace = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.one(createMassagePlaceRecordQuery))

            // Create massage place admins record.
            const newMassagePlaceAdmins = createdAdminUsers.map((user) => {
                return {
                    massagePlaceId: createdMassagePlace.id,
                    adminUserId: user.id
                }
            })

            const createMassagePlaceAdminsRecordQuery = insert(newMassagePlaceAdmins, TblMassagePlaceAdminInsertColumnSet) + " RETURNING *"

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

    try {
        // Retrieve path params.
        const massagePlaceId = req.params.id

        // Validate massage place id to be a valid uuid.
        if (!validate(massagePlaceId)) {
            winstonLogger.info(`${baseMessage} Create massage package flow failed because the massage place id is not a valid uuid.`)

            response.message = "Failed create massage package."
            response.statusCode = MassagePlaceDomainFailedCreateMassagePackageErrInvalidPathParamMassagePlaceId

            return res.status(httpStatusCodes.OK).json(response)
        }

        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(`${baseMessage} Create massage package flow failed because an error occurred during request body validation.`)

            response.message = "Failed create massage package."
            response.statusCode = MassagePlaceDomainFailedCreateMassagePackageErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        const {
            capacity,
            massagePackageTypeId
        } = req.body
        const { id: adminUserId } = req.decodedPayload

        // Main create massage package flow.
        const result = await db.tx(async t => {
            // Validate massage place id.
            const massagePlaceEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_place
                WHERE
                    id = $<id>
            `, {
                id: massagePlaceId
            })
            if (massagePlaceEntity == null) {
                winstonLogger.info(`${baseMessage} Create massage package flow failed because the massage place with id of ${massagePlaceId} is not found.`)
                response.message = "Failed create massage package."
                return {
                    createdMassagePackage: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePackageErrMassagePlaceNotFound
                }
            }

            const massagePlace = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massagePlaceEntity)

            // Check if authorized admin works at the massage place.
            const massagePlaceAdminCount = await t.one(`
                SELECT
                    COUNT(*)::int
                FROM
                    ms_massage_place_admin
                WHERE
                    massage_place_id = $<massagePlaceId>
                    AND admin_user_id = $<adminUserId>
            `, {
                massagePlaceId: massagePlaceId,
                adminUserId: adminUserId
            })
            if (massagePlaceAdminCount.count !== 1) {
                winstonLogger.info(`${baseMessage} Create massage package flow failed because the authorized admin with user id of ${adminUserId} might not work at the massage place with id ${massagePlaceId}.`)
                response.message = "Failed create massage package."
                return {
                    createdMassagePackage: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePackageErrInvalidMassagePlaceAndAdminUserId
                }
            }

            // Check if new massage package addition doesn't exceed max capacity.
            const currentMassagePackageCapacity = await t.one(`
                SELECT
                    SUM(capacity)::int
                FROM
                    ms_massage_package
                WHERE
                    massage_place_id = $<massagePlaceId>
            `, {
                massagePlaceId: massagePlaceId
            })
            if (currentMassagePackageCapacity + capacity > massagePlace.capacity) {
                winstonLogger.info(`${baseMessage} Create massage package flow failed because the massage package to be created's capacity exceeds the massage place's with id of ${massagePlaceId} max capacity.`)
                response.message = "Failed create massage package."
                return {
                    createdMassagePackage: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePackageErrExceedsMaxCapacity
                }
            }

            // Validate massage package type id.
            const massagePackageType = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_massage_package_type
                WHERE
                    id = $<massagePackageTypeId>
            `, {
                massagePackageTypeId: massagePackageTypeId
            })
            if (massagePackageType == null) {
                winstonLogger.info(`${baseMessage} Create massage package flow failed because massage package type with id of ${massagePackageTypeId} is not found.`)
                response.message = "Failed create massage package."
                return {
                    createdMassagePackage: null,
                    statusCode: MassagePlaceDomainFailedCreateMassagePackageErrMassagePackageTypeNotFound
                }
            }

            // Create massage package record.
            const { insert } = pgp.helpers
            const newMassagePackage = { ...req.body }
            newMassagePackage.massagePlaceId = massagePlaceId
            newMassagePackage.adminUserId = adminUserId

            const insertMassagePackageQuery = insert(newMassagePackage, TblMassagePackageInsertColumnSet) + " RETURNING *"
            const createdMassagePackageEntity = await t.one(insertMassagePackageQuery)

            return {
                createdMassagePackage: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, createdMassagePackageEntity),
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.createdMassagePackage = result.createdMassagePackage

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        return next(error)
    }
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
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        const cityIds = req.query.cityIds.split(",")
        if (req.query.cityIds && req.query.cityIds.split(",").length === 0) {
            response.message = "Failed get massage places."
            response.statusCode = MassagePlaceDomainFailedGetMassagePlacesErrInvalidCityIdsQueryParam

            return res.status(httpStatusCodes.OK).json(response)
        }

        const { role } = req.decodedPayload

        // Main get massage places flow.
        const result = await db.tx(async t => {
            // Get massage places record.
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
                            mmp.updated_at,
                            mmp.created_at
                        FROM
                            (
                                SELECT
                                    *
                                FROM
                                    ms_massage_place
                                LIMIT
                                    $<limit>
                                OFFSET
                                    $<offset>
                            ) mmp
                            JOIN (
                                SELECT
                                    COUNT(admin_user_id) AS admin_count,
                                    massage_place_id
                                FROM
                                    ms_massage_place_admin
                                GROUP BY
                                    massage_place_id
                            ) mmpa ON mmpa.massage_place_id = mmp.id
                        WHERE
                            mmp.city_id::text LIKE ANY ($<cityIds>)
                    `
                    break
                case UserDomainRoleMember:
                    query = `
                        SELECT
                            mmp.id,
                            mmp.name,
                            COALESCE(
                                SUM(
                                    mmpkg.capacity * CASE mmo.order_status
                                        WHEN 'PENDING' THEN 1
                                        ELSE 0
                                    END
                                )::int,
                                0
                            ) AS current_capacity,
                            mmp.max_capacity,
                            mc."name" AS city_name,
                            mmp.address,
                            mmp.updated_at,
                            mmp.created_at
                        FROM
                            (
                                SELECT
                                    *
                                FROM
                                    ms_massage_place
                                LIMIT
                                    $<limit>
                                OFFSET
                                    $<offset>
                            ) mmp
                            LEFT JOIN ms_massage_package mmpkg ON mmpkg.massage_place_id = mmp.id
                            LEFT JOIN ms_massage_order mmo ON mmo.massage_package_id = mmpkg.id
                            JOIN ms_city mc ON mmp.city_id = mc.id
                        WHERE
                            mmp.city_id::text LIKE ANY ($<cityIds>)
                        GROUP BY
                            mmp.id,
                            mmp.name,
                            mmp.max_capacity,
                            mc."name",
                            mmp.address,
                            mmp.updated_at,
                            mmp.created_at
                    `
                    break
            }

            const massagePlaces = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.manyOrNone(query, {
                limit: limit,
                offset: (page - 1) * limit,
                cityIds: cityIds
            }))

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

    try {
        // Retrieve path params.
        const massagePlaceId = req.params.id

        // Validate massage place id to be a valid uuid.
        if (!validate(massagePlaceId)) {
            winstonLogger.info(`${baseMessage} Get massage place by id flow failed because the massage place id is not a valid uuid.`)

            response.message = "Failed get massage place by id."
            response.statusCode = MassagePlaceDomainFailedGetMassagePlaceByIdErrInvalidPathParamMassagePlaceId

            return res.status(httpStatusCodes.OK).json(response)
        }

        const { role } = req.decodedPayload

        // Main get massage place by id flow.
        const result = await db.tx(async t => {
            // Get massage place by id record.
            let massagePlaceHeaderQuery = ""
            let massagePlaceDetailQuery = ""

            switch (role) {
                case UserDomainRoleOwner:
                    massagePlaceHeaderQuery = `
                        SELECT
                            mmp.id,
                            mmp.name,
                            mmp.max_capacity,
                            mmpa.admin_count::int,
                            mmp.address,
                            mmp.updated_at,
                            mmp.created_at
                        FROM
                            ms_massage_place mmp
                            JOIN (
                                SELECT
                                    COUNT(admin_user_id) AS admin_count,
                                    massage_place_id
                                FROM
                                    ms_massage_place_admin
                                GROUP BY
                                    massage_place_id
                            ) mmpa ON mmpa.massage_place_id = mmp.id
                        WHERE
                            mmp.id = $<id>
                    `

                    massagePlaceDetailQuery = `
                        SELECT
                            mu.id,
                            mu.fullname,
                            mu.username,
                            mu.is_active,
                            mu.created_at
                        FROM
                            ms_user mu
                            JOIN ms_massage_place_admin mmpa ON mmpa.admin_user_id = mu.id
                        WHERE
                            mmpa.massage_place_id = $<id>
                    `
                    break
                case UserDomainRoleMember:
                    massagePlaceHeaderQuery = `
                        SELECT
                            mmp.id,
                            mmp.name,
                            COALESCE(
                                SUM(
                                    mmpkg.capacity * CASE mmo.order_status
                                        WHEN 'PENDING' THEN 1
                                        ELSE 0
                                    END
                                )::int,
                                0
                            ) AS current_capacity,
                            mmp.max_capacity,
                            mc."name" AS city_name,
                            mmp.address,
                            mmp.updated_at,
                            mmp.created_at
                        FROM 
                            ms_massage_place mmp
                            JOIN ms_massage_package mmpkg ON mmpkg.massage_place_id = mmp.id
                            JOIN ms_massage_order mmo ON mmo.massage_package_id = mmpkg.id
                            JOIN ms_city mc ON mmp.city_id = mc.id
                        WHERE
                            mmp.id = $<id>
                        GROUP BY
                            mmp.id,
                            mmp.name,
                            mmp.max_capacity,
                            mc."name",
                            mmp.address,
                            mmp.updated_at,
                            mmp.created_at
                    `

                    massagePlaceDetailQuery = `
                        SELECT
                            *
                        FROM
                            ms_massage_package
                        WHERE
                            massage_place_id = $<id>
                    `
                    break
            }

            // Check if the provided massage place id is valid.
            const massagePlaceHeaderEntity = await t.oneOrNone(massagePlaceHeaderQuery, { id: massagePlaceId })
            if (massagePlaceHeaderEntity == null) {
                winstonLogger.info(`${baseMessage} Get massage place by id flow failed because massage place with id of ${massagePlaceId} is not found.`)
                response.message = "Failed get massage place by id."
                return {
                    massagePlace: null,
                    statusCode: MassagePlaceDomainFailedGetMassagePlaceByIdErrMassagePlaceNotFound
                }
            }

            const massagePlaceHeader = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massagePlaceHeaderEntity)
            const massagePlaceDetail = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.manyOrNone(massagePlaceDetailQuery, { id: massagePlaceId }))

            return {
                massagePlace: {
                    ...massagePlaceHeader,
                    massagePlaceDetail: massagePlaceDetail
                },
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.massagePlace = result.massagePlace

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Update massage place by id flow failed because an error occurred during request body validation.")

            response.message = "Failed update massage place by id."
            response.statusCode = MassagePlaceDomainFailedUpdateMassagePlaceByIdErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Retrieve path params.
        const id = req.params.id

        // Main update massage place by id flow.
        const result = await db.tx(async t => {
            // Check if the provided massage place id is valid.
            const massagePlace = await t.oneOrNone("SELECT * FROM ms_massage_place WHERE id = $<id>", { id: id })
            if (massagePlace == null) {
                winstonLogger.info(baseMessage + " Update massage place by id flow failed because massage place with provided id doesn't exists.")
                response.message = "Failed update massage place by id."
                return {
                    updatedMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedUpdateMassagePlaceByIdErrMassagePlaceNotFound
                }
            }

            const convertedMassagePlace = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, massagePlace)

            // Check if updated max capacity is fewer than current max capacity.
            if (convertedMassagePlace.maxCapacity < req.body.maxCapacity) {
                winstonLogger.info(baseMessage + " Update massage place by id flow failed because the updated max capacity is fewer than current max capacity.")
                response.message = "Failed update massage place by id."
                return {
                    updatedMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedUpdateMassagePlaceByIdErrInvalidMaxCapacityValue
                }
            }

            // Check whether the new name and address is not conflicting with another place with different id.
            const existingMassagePlace = await t.oneOrNone("SELECT * FROM ms_massage_place WHERE name = $<name> and address = $<address>", { name: req.body.name, address: req.body.address })
            if (existingMassagePlace != null && existingMassagePlace.id !== id) {
                winstonLogger.info(baseMessage + " Update massage place by id flow failed because the name and address conflicts with other massage place with id = " + existingMassagePlace.id)
                response.message = "Failed update massage place by id."
                return {
                    updatedMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedUpdateMassagePlaceByIdErrConflictingNameAndAddress
                }
            }

            // Update the massage place record.
            const updatedMassagePlace = await t.one(`
                UPDATE ms_massage_place
                SET 
                    name = $<name>,
                    max_capacity = $<maxCapacity>,
                    address = $<address>,
                    updated_at = $<updatedAt>
                WHERE id = $<id>
                RETURNING *
            `, {
                id: id,
                name: req.body.name,
                maxCapacity: req.body.maxCapacity,
                address: req.body.address,
                updatedAt: new Date()
            })

            return {
                updatedMassagePlace: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, updatedMassagePlace),
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.updatedMassagePlace = result.updatedMassagePlace

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
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

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Update massage place admins by id flow failed because an error occurred during request body validation.")

            response.message = "Failed update massage place admins by id."
            response.statusCode = MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Retrieve path params.
        const id = req.params.id

        // Main update massage place admins flow.
        const result = await db.tx(async t => {
            // Make sure that default admin password exists in the .env.
            const defaultAdminPassword = process.env.MASSAGE_PLACE_ADMIN_DEFAULT_PASS
            if (!defaultAdminPassword) {
                winstonLogger.info(baseMessage + " Update massage place admins by id flow failed because default admin pass is not found.")
                response.message = "Failed update massage place admins by id."
                return {
                    updatedMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrNoDefaultAdminPass
                }
            }

            // Hash default admin password.
            const hashedDefaultAdminPassword = await bcrypt.hash(defaultAdminPassword, 10)

            // Validate admins array from the request body.
            let validAdmins = true
            req.body.admins.forEach((admin) => {
                const { id, fullname, username, isActive } = admin
                if (!fullname || !username || !isActive) {
                    validAdmins = false
                }
            })

            if (!validAdmins) {
                winstonLogger.info(baseMessage + " Update massage place admins by id flow failed because of invalid admins object array.")
                response.message = "Failed update massage place admins by id."
                return {
                    updatedMassagePlace: null,
                    statusCode: MassagePlaceDomainFailedUpdateMassagePlaceAdminsByIdErrInvalidAdminObjectArray
                }
            }

            // Split admin record with empty and non-empty id.
            const existingAdmins = req.body.admins.filter((admin) => admin.id).map((admin) => {
                const mappedAdmin = { ...admin }
                mappedAdmin.updatedAt = new Date()
                return mappedAdmin
            })
            const newAdmins = req.body.admins.filter((admin) => !admin.id).map((admin) => {
                const mappedAdmin = { ...admin }
                delete (mappedAdmin.id)
                mappedAdmin.gender = UserDomainGenderMale
                mappedAdmin.email = `${mappedAdmin.username}@gmail.com`
                mappedAdmin.password = hashedDefaultAdminPassword
                mappedAdmin.role = UserDomainRoleAdmin
                return mappedAdmin
            })

            const updatedMassagePlaceAdmins = []

            // Update existing admin user information.
            const { update } = pgp.helpers
            const updateExistingAdminsQuery = update(existingAdmins, TblUserUpdateColumnSet) + " WHERE v.id::uuid = t.id RETURNING *"
            const updatedExistingAdmins = await t.any(updateExistingAdminsQuery)

            updatedMassagePlaceAdmins.push(...updatedExistingAdmins)

            // Create new user and massage place admin record for the remaining new admins.
            if (newAdmins.length > 0) {
                const { insert } = pgp.helpers
                const tempColumnSet = new pgp.helpers.ColumnSet([
                    { name: "fullname", prop: "fullname" },
                    { name: "gender", prop: "gender" },
                    { name: "username", prop: "username" },
                    { name: "email", prop: "email" },
                    { name: "password", prop: "password" },
                    { name: "role", prop: "role" },
                    { name: "is_active", prop: "isActive" }
                ], {
                    table: "ms_user"
                })
                const createNewAdminUserRecordQuery = insert(newAdmins, tempColumnSet) + " RETURNING *"
                const createdNewAdminUsers = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.any(createNewAdminUserRecordQuery))

                const newMassagePlaceAdmins = createdNewAdminUsers.map((user) => {
                    return {
                        massagePlaceId: id,
                        adminUserId: user.id
                    }
                })

                const createMassagePlaceAdminsRecordQuery = insert(newMassagePlaceAdmins, TblMassagePlaceAdminColumnSet)
                await t.none(createMassagePlaceAdminsRecordQuery)

                updatedMassagePlaceAdmins.push(...createdNewAdminUsers)
            }

            return {
                updatedMassagePlace: {
                    updatedMassagePlaceAdmins: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, updatedMassagePlaceAdmins)
                },
                statusCode: MassagePlaceDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.updatedMassagePlace = result.updatedMassagePlace

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}