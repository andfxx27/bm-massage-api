import jwt from "jsonwebtoken"

import { winstonLogger } from "#root/src/config/logger.js"

import { UtilsDomainGeneralSuccessStatusCode } from "#root/src/utils/constant.js"

/**
 * Function to sign payload as a jwt.
 * @param {string} identifier Unique v4 uuid as request identifier.
 * @param {Object} payload Token payload in the form of object.
 */
export async function signJwt(identifier, payload) {
    const baseMessage = `req-${identifier} - [ authUtils.signJwt ] called.`

    winstonLogger.info(baseMessage)

    return new Promise((resolve, reject) => {
        jwt.sign(payload, process.env.JWT_SIGNING_SECRET, { algorithm: "HS256", expiresIn: process.env.JWT_EXPIRES_IN }, (err, token) => {
            if (err != null) {
                winstonLogger.info(baseMessage + ` ${err.stack}.`)

                reject(err)
            } else {
                resolve({
                    jwt: token,
                    statusCode: UtilsDomainGeneralSuccessStatusCode
                })
            }
        })
    })
}

/**
 * Function to verify and unpack payload from a jwt.
 * @param {string} identifier Unique v4 uuid as request identifier.
 * @param {string} token User's access token (jwt).
 */
export async function verifyJwt(identifier, token) {
    const baseMessage = `req-${identifier} - [ authUtils.verifyJwt ] called.`

    winstonLogger.info(baseMessage)

    return new Promise((resolve, reject) => {
        jwt.verify(token, process.env.JWT_SIGNING_SECRET, (err, decoded) => {
            if (err != null) {
                winstonLogger.info(baseMessage + ` ${err.stack}.`)

                reject(err)
            } else {
                resolve({
                    decodedPayload: decoded,
                    statusCode: UtilsDomainGeneralSuccessStatusCode
                })
            }
        })
    })
}