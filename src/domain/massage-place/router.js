import express from "express"

import {
    createMassagePlace,
    getMassagePlaces,
    getMassagePlaceById,
    updateMassagePlaceById,
    updateMassagePlaceAdminsById,
    createMassagePackage
} from "#root/src/domain/massage-place/controller.js"

export const router = express.Router()

router.post("/", createMassagePlace)
router.post("/:id/massage-packages", createMassagePackage)
router.get("/", getMassagePlaces)
router.get("/:id", getMassagePlaceById)
router.patch("/:id", updateMassagePlaceById)
router.patch("/:id/admins", updateMassagePlaceAdminsById)