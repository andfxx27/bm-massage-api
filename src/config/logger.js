import path from "path"

import morgan from "morgan"
import winston from "winston"
import "winston-daily-rotate-file"

const { combine, timestamp, json } = winston.format

const winstonFileRotateTransport = new winston.transports.DailyRotateFile({
    filename: `${process.env.APPLICATION_NAME}-%DATE%.log`,
    datePattern: "YYYY-MM-DD",
    dirname: path.join(process.env.APPLICATION_ROOT_DIR, "logs"),
    maxSize: "10m"
})

// Initialize main logger instance for general application logging.
export const winstonLogger = winston.createLogger({
    level: "info",
    format: combine(timestamp(), json()),
    transports: [
        new winston.transports.Console(),
        winstonFileRotateTransport
    ]
})

// Initialize request logger middleware to log all request, where we use the winston logger stream.
export const morganLoggerMiddleware = morgan(":method :url :status :res[content-length] - :response-time ms", { stream: winstonLogger.stream.write })