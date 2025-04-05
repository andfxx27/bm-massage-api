import express from "express"
import "dotenv/config"

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

import { morganLoggerMiddleware, winstonLogger } from "#root/src/config/logger.js"

app.use(morganLoggerMiddleware)

winstonLogger.info("Initialized express app.")
winstonLogger.info("Initialized environment variables.")
winstonLogger.info("Initialized winston & morgan logger.")

import "#root/src/config/database.js"

winstonLogger.info("Initialized postgresql database connection.")

import { router } from "#root/src/router/router.js"

app.use(router)

winstonLogger.info("Initialized application router.")

const port = process.env.APPLICATION_PORT || 3000

app.listen(port, () => winstonLogger.info(`Initialized http server, started on port ${port}.`))