import { winstonLogger } from "#root/src/config/logger.js"

/**
 * Function to convert object array's field/ property with snake case to camel case style.
 * @param {string} identifier Unique v4 uuid as request identifier.
 * @param {Object[]} objectArray Object array to be converted.
 */
export async function arrayObjectSnakeCaseToCamelCasePropsConverter(identifier, objectArray) {
    const baseMessage = `req-${identifier} - [ stringUtils.arrayObjectSnakeCaseToCamelCasePropsConverter] called.`

    winstonLogger.info(baseMessage)

    return objectArray.map(item => {
        const mappedItem = {}

        for (const key in item) {
            if (item.hasOwnProperty(key)) {
                if (!key.includes("_")) {
                    mappedItem[key] = item[key]
                } else {
                    let mappedKey = key.toLowerCase().replace(/[-_][a-z]/g, (group) => group[1].toUpperCase())
                    mappedItem[mappedKey] = item[key]
                }
            }
        }

        return mappedItem
    })
}

/**
 * Function to convert object's field/ property with snake case to camel case style.
 * @param {string} identifier Unique v4 uuid as request identifier.
 * @param {Object} object Object to be converted.
 */
export async function singleObjectSnakeCaseToCamelCasePropsConverter(identifier, object) {
    const baseMessage = `req-${identifier} - [ stringUtils.singleObjectSnakeCaseToCamelCasePropsConverter] called.`

    winstonLogger.info(baseMessage)

    const mappedItem = {}

    for (const key in object) {
        if (object.hasOwnProperty(key)) {
            if (!key.includes("_")) {
                mappedItem[key] = object[key]
            } else {
                let mappedKey = key.toLowerCase().replace(/[-_][a-z]/g, (group) => group[1].toUpperCase())
                mappedItem[mappedKey] = object[key]
            }
        }
    }

    return mappedItem
}