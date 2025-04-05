import express from "express"

import { getMassagePackageTypes } from "#root/src/domain/massage-package-type/controller.js"

export const router = express.Router()

router.get("/", getMassagePackageTypes)