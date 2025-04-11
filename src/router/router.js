import express from "express"

import { isAuthorizedMiddleware } from "#root/src/middleware/auth.js"
import { defaultErrorHandlerMiddleware } from "#root/src/middleware/error.js"
import { uuidAttacherMiddleware } from "#root/src/middleware/general.js"

import { router as cityRouter } from "#root/src/domain/city/router.js"
import { router as massageOrderRouter } from "#root/src/domain/massage-order/router.js"
import { router as massagePackageTypeRouter } from "#root/src/domain/massage-package-type/router.js"
import { router as massagePlaceRouter } from "#root/src/domain/massage-place/router.js"
import { router as userRouter } from "#root/src/domain/user/router.js"

export const router = express.Router()

router.use(uuidAttacherMiddleware)

router.use("/api/v1/cities", isAuthorizedMiddleware, cityRouter)
router.use("/api/v1/massage-orders", isAuthorizedMiddleware, massageOrderRouter)
router.use("/api/v1/massage-package-types", isAuthorizedMiddleware, massagePackageTypeRouter)
router.use("/api/v1/massage-places", isAuthorizedMiddleware, massagePlaceRouter)
router.use("/api/v1/users", userRouter)

router.use(defaultErrorHandlerMiddleware)