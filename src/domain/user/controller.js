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
    TblMemberBanInsertColumnSet,
    TblUserInsertColumnSet,
    TblUserUpdateBanStatusColumnSet
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
            winstonLogger.info(`${baseMessage} Sign up flow failed because an error occurred during request body validation.`)

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
            const query = insert(values, TblUserInsertColumnSet) + " RETURNING *"
            return await t.one(query)
        })

        delete (result.password)

        response.result.createdUser = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, result)

        return res.status(httpStatusCodes.CREATED).json(response)
    } catch (error) {
        response.message = "Failed sign up."

        if (error.code && error.code == "23505") {
            winstonLogger.info(`${baseMessage} Sign up flow failed because an error occurred when creating user database record.`)
            response.statusCode = UserDomainFailedSignUpErrDuplicateDatabaseRecordUserTable
            return res.status(httpStatusCodes.OK).json(response)
        } else {
            winstonLogger.info(`${baseMessage} Sign up flow failed because of an unhandled error. Passing it to default error handler middleware.`)
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
            winstonLogger.info(`${baseMessage} Sign in flow failed because an error occurred during request body validation.`)

            response.message = "Failed sign in."
            response.statusCode = UserDomainFailedSignInErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        const {
            username,
            password
        } = req.body

        // Main sign in flow.
        const result = await db.tx(async t => {
            // Check for existing user with same credentials.
            const userEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_user
                WHERE
                    username = $<username>
            `, { username: username })
            if (userEntity == null) {
                winstonLogger.info(`${baseMessage} Sign in flow failed because no user record with specified credentials is found.`)
                response.message = "Failed sign in."
                return {
                    accessToken: null,
                    statusCode: UserDomainFailedSignInErrNoUserFound
                }
            }

            const user = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, userEntity)

            // Compare provided password with hashed password.
            const validPassword = await bcrypt.compare(password, user.password)
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
            winstonLogger.info(`${baseMessage} Request member ban approval flow failed because an error occurred during request body validation.`)

            response.message = "Failed request member ban approval."
            response.statusCode = UserDomainFailedRequestMemberBanApprovalErrReqBodyValidation
            response.result = {
                errors: Array.from(new Set(errors.array().map(e => e.msg)))
            }

            return res.status(httpStatusCodes.BAD_REQUEST).json(response)
        }

        const { memberUserId } = req.body
        const { id: adminUserId } = req.decodedPayload

        // Main request member ban approval flow.
        const result = await db.tx(async t => {
            // Check if provided member user id is valid.
            const existingMemberEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_user
                WHERE
                    id = $<memberUserId>
            `, { memberUserId: memberUserId })
            if (existingMemberEntity == null) {
                winstonLogger.info(`${baseMessage} Request member ban approval flow failed because user with id of ${memberUserId} is not found.`)
                response.message = "Failed request member ban approval."
                return {
                    requestedMemberBanApproval: null,
                    statusCode: UserDomainFailedRequestMemberBanApprovalErrUserNotFound
                }
            }

            const existingMember = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, existingMemberEntity)
            if (existingMember.role === UserDomainRoleOwner || existingMember.role === UserDomainRoleAdmin) {
                winstonLogger.info(`${baseMessage} Request member ban approval flow failed because the user is of role ADMIN or OWNER.`)
                response.message = "Failed request member ban approval."
                return {
                    requestedMemberBanApproval: null,
                    statusCode: UserDomainFailedRequestMemberBanApprovalErrInvalidUserRole
                }
            }

            // Check if there is ongoing ban request for the user.
            const existingBanRequestEntity = await t.oneOrNone(`
                SELECT
                    *
                FROM
                    ms_member_ban
                WHERE
                    member_user_id = $<memberUserId>
                    AND approval_status = $<approvalStatus>
            `, {
                memberUserId: memberUserId,
                approvalStatus: UserDomainBanApprovalStatusPending
            })
            if (existingBanRequestEntity != null) {
                winstonLogger.info(`${baseMessage} Request member ban approval flow failed because there is existing ban request for the user.`)
                response.message = "Failed request member ban approval."
                return {
                    requestedMemberBanApproval: null,
                    statusCode: UserDomainFailedRequestMemberBanApprovalErrBanRequestAlreadyExists
                }
            }

            // Create member ban request record.
            req.body.adminUserId = adminUserId

            const newMemberBanRequest = { ...req.body }

            const {
                insert,
                update
            } = pgp.helpers
            const insertMemberBanRequestRecordQuery = insert(newMemberBanRequest, TblMemberBanInsertColumnSet) + " RETURNING *"
            const requestedMemberBanApproval = await singleObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, await t.one(insertMemberBanRequestRecordQuery))

            // Update member ban status on user record.
            const updatedUserBanStatus = {
                banStatus: UserDomainBanApprovalStatusPending,
                memberUserId: memberUserId,
                updatedAt: new Date()
            }
            const updateUserRecordBanStatusQuery = update(updatedUserBanStatus, TblUserUpdateBanStatusColumnSet)
            await t.none(updateUserRecordBanStatusQuery)

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
    const baseMessage = `req - ${reqIdentifier} -[userController.approveMemberBanRequest] called.`

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
            owner_user_id = $ < ownerUserId >,
                approval_status = $ < banApprovalStatus >,
                ban_lifted_at = $ < banLiftedAt >,
                updated_at = $ < updatedAt >
                WHERE id = $ < banRequestId >
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
            ban_status = $ < banStatus >,
                updated_at = $ < updatedAt >
                WHERE id = $ < memberUserId >
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
    const baseMessage = `req - ${reqIdentifier} -[userController.getMemberBanApprovalRequests] called.`

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
            // Get member ban approval request record.
            const memberBanApprovalRequestsEntity = await t.manyOrNone(`
            SELECT
                *
                FROM
            ms_member_ban
            WHERE
            approval_status = 'PENDING'
            LIMIT
            $ < limit >
                OFFSET
            $ < offset >
                `, {
                limit: limit,
                offset: (page - 1) * limit
            })

            return {
                memberBanApprovalRequests: await arrayObjectSnakeCaseToCamelCasePropsConverter(reqIdentifier, memberBanApprovalRequestsEntity),
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