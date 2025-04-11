import bcrypt from "bcrypt"
import express from "express"
import { validationResult } from "express-validator"
import httpStatusCodes from "http-status-codes"

import {
    UserDomainGeneralSuccessStatusCode,
    UserDomainFailedSignUpErrReqBodyValidation,
    UserDomainRoleMember,
    UserDomainFailedSignUpErrDuplicateDatabaseRecordUserTable,
    UserDomainFailedSignInErrReqBodyValidation,
    UserDomainFailedSignInErrNoUserFound,
    UserDomainFailedSignInErrInvalidPassword,
    UserDomainFailedRequestMemberBanApprovalErrReqBodyValidation,
    UserDomainFailedRequestMemberBanApprovalErrUserNotFound,
    UserDomainFailedRequestMemberBanApprovalErrBanRequestAlreadyExists,
    UserDomainFailedApproveMemberBanRequestErrReqBodyValidation,
    UserDomainBanApprovalStatusBanned,
    UserDomainBanApprovalStatusRevoked,
    UserDomainBanApprovalStatusPending,
    UserDomainBanStatusActive,
    UserDomainBanStatusBanned,
    UserDomainFailedApproveMemberBanRequestErrRequestNotFound,
    UserDomainFailedApproveMemberBanRequestErrRequestAlreadyProcessed,
    UserDomainRoleOwner,
    UserDomainRoleAdmin,
    UserDomainFailedRequestMemberBanApprovalErrInvalidUserRole
} from "#root/src/domain/user/constant.js"

import {
    db,
    pgp,
    TblMemberBanColumnSet,
    TblUserColumnSet
} from "#root/src/config/database.js"
import { winstonLogger } from "#root/src/config/logger.js"

import { signJwt } from "#root/src/utils/auth.js"
import {
    arrayObjectSnakeCaseToCamelCasePropsConverter,
    singleObjectSnakeCaseToCamelCasePropsConverter
} from "#root/src/utils/string.js"

/**
 * Function for signing up as new user.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function signUp(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ userController.signUp ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success sign up.",
        statusCode: UserDomainGeneralSuccessStatusCode,
        result: {
            createdUser: null
        }
    }

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Sign up flow failed because an error occurred during request body validation.")

            response.message = "Failed sign up."
            response.statusCode = UserDomainFailedSignUpErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main sign up flow.
        const result = await db.tx(async t => {
            // Hash user password and apply basic member role.
            const hashedPassword = await bcrypt.hash(req.body.password, 10)
            const newUser = { ...req.body }
            newUser.password = hashedPassword
            newUser.role = UserDomainRoleMember

            // Insert to database.
            const { insert } = pgp.helpers
            const values = newUser
            const query = insert(values, TblUserColumnSet) + " RETURNING *"
            return await t.one(query)
        })

        delete (result.password)

        response.result.createdUser = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, result)

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        response.message = "Failed sign up."

        if (error.code && error.code == "23505") {
            winstonLogger.info(baseMessage + " Sign up flow failed because an error occurred when creating user database record. Error = " + error.message + ".")
            response.statusCode = UserDomainFailedSignUpErrDuplicateDatabaseRecordUserTable
            return res.status(httpStatusCodes.OK).json(response)
        } else {
            winstonLogger.info(baseMessage + " Sign up flow failed because of an unhandled error. Passing it to default error handler middleware...")
        }

        return next(error)
    }
}

/**
 * Function for signing in as existing user.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function signIn(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ userController.signIn ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success sign in.",
        statusCode: UserDomainGeneralSuccessStatusCode,
        result: {
            accessToken: null
        }
    }

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Sign in flow failed because an error occurred during request body validation.")

            response.message = "Failed sign in."
            response.statusCode = UserDomainFailedSignInErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main sign in flow.
        const result = await db.tx(async t => {
            // Check for existing user with same credentials.
            const users = await t.manyOrNone(`SELECT * FROM ms_user WHERE username = $<username>`, { username: req.body.username })
            if (users.length === 0) {
                winstonLogger.info(`${baseMessage} Sign in flow failed because no user record with specified credentials is found.`)
                response.message = "Failed sign in."
                return {
                    accessToken: null,
                    statusCode: UserDomainFailedSignInErrNoUserFound
                }
            }

            const user = users[0]

            // Compare provided password with hashed password.
            const validPassword = await bcrypt.compare(req.body.password, user.password)
            if (!validPassword) {
                winstonLogger.info(`${baseMessage} Sign in flow failed because of failed password comparison.`)
                response.message = "Failed sign in."
                return {
                    accessToken: null,
                    statusCode: UserDomainFailedSignInErrInvalidPassword
                }
            }

            // Generate access token.
            const payload = { id: user.id, role: user.role }

            const signJwtResult = await signJwt(reqIdentifier, payload)

            return {
                accessToken: signJwtResult.jwt,
                statusCode: UserDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.accessToken = result.accessToken

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}

/**
 * Function to request member ban approval.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function requestMemberBanApproval(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ userController.requestMemberBanApproval ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success request member ban approval.",
        statusCode: UserDomainGeneralSuccessStatusCode,
        result: {
            requestedMemberBanApproval: null
        }
    }

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Request member ban approval flow failed because an error occurred during request body validation.")

            response.message = "Failed request member ban approval."
            response.statusCode = UserDomainFailedRequestMemberBanApprovalErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main request member ban approval flow.
        const result = await db.tx(async t => {
            // Check if provided member user id is valid.
            const existingMember = await t.oneOrNone("SELECT * FROM ms_user WHERE id = $<memberUserId>", { memberUserId: req.body.memberUserId })
            if (existingMember == null) {
                winstonLogger.info(`${baseMessage} Request member ban approval flow failed because the user is not found.`)
                response.message = "Failed request member ban approval."
                return {
                    requestedMemberBanApproval: null,
                    statusCode: UserDomainFailedRequestMemberBanApprovalErrUserNotFound
                }
            }
            if (existingMember.role === UserDomainRoleOwner || existingMember.role === UserDomainRoleAdmin) {
                winstonLogger.info(`${baseMessage} Request member ban approval flow failed because the user is of role ADMIN or OWNER.`)
                response.message = "Failed request member ban approval."
                return {
                    requestedMemberBanApproval: null,
                    statusCode: UserDomainFailedRequestMemberBanApprovalErrInvalidUserRole
                }
            }

            /**
             * TODO Find better ways to check for existing ban request.
             * As it stands now, if an owner forgot to update the ban request, the process for checking existing ban request will eventually be longer because of many PENDING ban request.
             */
            // Check if there is ongoing ban request for the user.
            const existingBanRequest = await t.manyOrNone("SELECT * FROM ms_member_ban WHERE member_user_id = $<memberUserId>", { memberUserId: req.body.memberUserId })
            if (existingBanRequest != null) {
                const convertedExistingBanRequest = await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, existingBanRequest)

                // Check for ban request which already passed its own ban lift time, since we only update it manually.
                const currentDate = new Date()
                const currentDateUnix = currentDate.getTime()
                let liftedBanRequestCount = 0
                convertedExistingBanRequest.forEach((request) => {
                    const banLiftedDateUnix = request.banLiftedAt.getTime()
                    if (banLiftedDateUnix < currentDateUnix) {
                        liftedBanRequestCount++
                    }
                })

                if (liftedBanRequestCount !== convertedExistingBanRequest.length) {
                    winstonLogger.info(`${baseMessage} Request member ban approval flow failed because there is existing ban request for the user.`)
                    response.message = "Failed request member ban approval."
                    return {
                        requestedMemberBanApproval: null,
                        statusCode: UserDomainFailedRequestMemberBanApprovalErrBanRequestAlreadyExists
                    }
                }
            }

            // Create member ban request record.
            req.body.adminUserId = req.decodedPayload.id

            const newMemberBanRequest = { ...req.body }

            const { insert } = pgp.helpers
            const createMemberBanRequestRecordQuery = insert(newMemberBanRequest, TblMemberBanColumnSet) + " RETURNING *"
            const requestedMemberBanApproval = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.one(createMemberBanRequestRecordQuery))

            // Update member ban status on user record.
            await t.none(`UPDATE ms_user SET ban_status = $<banStatus>, updated_at = $<updatedAt> WHERE id = $<memberUserId>`, {
                banStatus: UserDomainBanApprovalStatusPending,
                memberUserId: req.body.memberUserId,
                updatedAt: new Date()
            })

            return {
                requestedMemberBanApproval: requestedMemberBanApproval,
                statusCode: UserDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.requestedMemberBanApproval = result.requestedMemberBanApproval

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        return next(error)
    }
}

/**
 * Function to approve/ reject member ban approval request.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function approveMemberBanRequest(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ userController.approveMemberBanRequest ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success update member ban approval request.",
        statusCode: UserDomainGeneralSuccessStatusCode,
        result: {
            updatedMemberBanRequest: null
        }
    }

    try {
        // Validate request body.
        const errors = validationResult(req)
        if (!errors.isEmpty()) {
            winstonLogger.info(baseMessage + " Approve member ban approval request flow failed because an error occurred during request body validation.")

            response.message = "Failed update member ban approval request."
            response.statusCode = UserDomainFailedApproveMemberBanRequestErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        // Main approve member ban request flow.
        const result = await db.tx(async t => {
            const currentDate = new Date()
            const banApprovalStatus = req.body.banApprovalStatus

            const existingMemberBanRequest = await t.oneOrNone("SELECT * FROM ms_member_ban WHERE id = $<banRequestId> AND member_user_id = $<memberUserId>",
                {
                    banRequestId: req.body.banRequestId,
                    memberUserId: req.body.memberUserId
                }
            )
            if (existingMemberBanRequest == null) {
                winstonLogger.info(`${baseMessage} Approve member ban approval request flow failed because no request found with the specified id.`)
                response.message = "Failed update member ban approval request."
                return {
                    updatedMemberBanRequest: null,
                    statusCode: UserDomainFailedApproveMemberBanRequestErrRequestNotFound
                }
            }
            const convertedExistingMemberBanRequest = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, existingMemberBanRequest)
            if (convertedExistingMemberBanRequest.updatedAt != null) {
                winstonLogger.info(`${baseMessage} Approve member ban approval request flow failed because the request is already updated.`)
                response.message = "Failed update member ban approval request."
                return {
                    updatedMemberBanRequest: null,
                    statusCode: UserDomainFailedApproveMemberBanRequestErrRequestAlreadyProcessed
                }
            }

            const now = new Date()
            let banLiftedAt = now

            // Ban status in user record will need to be checked/ updated everytime authorization process is done (check whether the member ban is lifted/ not).
            let banStatus = ""
            if (banApprovalStatus === UserDomainBanApprovalStatusRevoked) {
                banStatus = UserDomainBanStatusActive
            } else if (banApprovalStatus === UserDomainBanApprovalStatusBanned) {
                banStatus = UserDomainBanStatusBanned
                banLiftedAt = new Date(now.setDate(now.getDate() + 3))
            }

            // Update ban approval status in member ban record.
            const updatedMemberBanRequest = await t.one(`
                UPDATE ms_member_ban
                SET
                    owner_user_id = $<ownerUserId>,
                    approval_status = $<banApprovalStatus>,
                    ban_lifted_at = $<banLiftedAt>,
                    updated_at = $<updatedAt>
                WHERE id = $<banRequestId>
                RETURNING *
            `, {
                ownerUserId: req.decodedPayload.id,
                banApprovalStatus: banApprovalStatus,
                banLiftedAt: banLiftedAt,
                updatedAt: currentDate,
                banRequestId: req.body.banRequestId
            })

            // Update ban status in user record.
            await t.none(`
                UPDATE ms_user
                SET
                    ban_status = $<banStatus>,
                    updated_at = $<updatedAt>
                WHERE id = $<memberUserId>
            `, {
                banStatus: banStatus,
                updatedAt: currentDate,
                memberUserId: req.body.memberUserId
            })

            return {
                updatedMemberBanRequest: await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, updatedMemberBanRequest),
                statusCode: UserDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.updatedMemberBanRequest = result.updatedMemberBanRequest

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}

/**
 * Function to get member ban approval requests.
 * @param {express.Request} req Express request instance.
 * @param {express.Response} res Express response instance.
 * @param {express.NextFunction} next Express next function handler.
 */
export async function getMemberBanApprovalRequests(req, res, next) {
    const reqIdentifier = req.reqIdentifier
    const baseMessage = `req-${reqIdentifier} - [ userController.getMemberBanApprovalRequests ] called.`

    winstonLogger.info(baseMessage)

    const response = {
        message: "Success get member ban approval requests.",
        statusCode: UserDomainGeneralSuccessStatusCode,
        result: {
            memberBanApprovalRequests: null
        }
    }

    try {
        // Retrieve query params.
        const page = +(req.query.page ?? 1)
        const limit = +(req.query.limit ?? 15)

        // Main get member ban approval requests flow.
        const result = await db.tx(async t => {
            const memberBanApprovalRequests = await t.any("SELECT * FROM ms_member_ban WHERE approval_status = 'PENDING' LIMIT $<limit> OFFSET $<offset>", {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                memberBanApprovalRequests: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, memberBanApprovalRequests),
                statusCode: UserDomainGeneralSuccessStatusCode
            }
        })

        response.statusCode = result.statusCode
        response.result.memberBanApprovalRequests = result.memberBanApprovalRequests

        return res.status(httpStatusCodes.OK).json(response)
    } catch (error) {
        return next(error)
    }
}