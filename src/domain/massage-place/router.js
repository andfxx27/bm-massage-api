import express from "express"
import { body } from "express-validator"

import {
    createMassagePlace,
    getMassagePlaces,
    getMassagePlaceById,
    updateMassagePlaceById,
    updateMassagePlaceAdminsById,
    createMassagePackage
} from "#root/src/domain/massage-place/controller.js"

import {
    UserDomainRoleAdmin,
    UserDomainRoleMember,
    UserDomainRoleOwner
} from "#root/src/domain/user/constant.js"

import { isRoleMiddleware } from "#root/src/middleware/auth.js"

export const router = express.Router()

router.post(
    "/",
    body("name", `Field "name" must be a valid alphabetical value.`).notEmpty().isAlpha("en-US", { ignore: [" "] }),
    body("maxCapacity", `Field "maxCapacity" must be a valid numeric (int) value.`).notEmpty().isNumeric(),
    body("address", `Field "address" must not be empty.`).notEmpty(),
    body("cityId", `Field "cityId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    body("adminNames", `Field "adminNames" must be a valid array of string value, min 1 and max 10 element(s).`).notEmpty().isArray({ min: 1, max: 10 }),
    isRoleMiddleware([UserDomainRoleOwner]),
    createMassagePlace
)
router.post(
    "/:id/massage-packages",
    body("name", `Field "name" must be a non-empty alphabet value.`).notEmpty().isAlpha("en-US", { ignore: [" "] }),
    body("capacity", `Field "capacity" must be valid integer value.`).notEmpty().isNumeric(),
    body("price", `Field "price" must be a valid integer value.`).notEmpty().isNumeric(),
    body("massagePlaceId", `Field "massagePlaceId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    body("massagePackageTypeId", `Field "massagePackageTypeId" must be a valid uuid value.`).notEmpty().isUUID("4"),
    isRoleMiddleware([UserDomainRoleAdmin]),
    createMassagePackage
)
router.get(
    "/",
    isRoleMiddleware([UserDomainRoleOwner, UserDomainRoleMember]),
    getMassagePlaces
)
router.get(
    "/:id",
    isRoleMiddleware([UserDomainRoleOwner, UserDomainRoleMember]),
    getMassagePlaceById
)
router.patch(
    "/:id",
    body("name", `Field "name" must be a valid alphabetical value.`).notEmpty().isAlpha("en-US", { ignore: [" "] }),
    body("maxCapacity", `Field "maxCapacity" must be a valid numeric (int) value.`).notEmpty().isNumeric(),
    body("address", `Field "address" must not be empty.`).notEmpty(),
    isRoleMiddleware([UserDomainRoleOwner]),
    updateMassagePlaceById
)
router.patch(
    "/:id/admins",
    body("admins", `Field "admins" must be a valid array of object consisting of id, fullname, username, and isActive.`).notEmpty().isArray({ min: 1, max: 10 }),
    isRoleMiddleware([UserDomainRoleOwner]),
    updateMassagePlaceAdminsById
)