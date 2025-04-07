import pgPromise from "pg-promise"

const initOptions = {}

export const pgp = pgPromise(initOptions)

const { ColumnSet } = pgp.helpers

export const TblMassageOrderColumnSet = new ColumnSet([
    { name: "member_user_id", prop: "memberUserId" },
    { name: "massage_package_id", prop: "massagePackageId" }
], {
    table: "ms_massage_order"
})

export const TblMassagePlaceColumnSet = new ColumnSet([
    { name: "name", prop: "name" },
    { name: "max_capacity", prop: "maxCapacity" },
    { name: "address", prop: "address" },
    { name: "owner_user_id", prop: "ownerUserId" },
    { name: "city_id", prop: "cityId" }
], {
    table: "ms_massage_place"
})

export const TblMassagePlaceAdminColumnSet = new ColumnSet([
    { name: "admin_user_id", prop: "adminUserId" },
    { name: "massage_place_id", prop: "massagePlaceId" }
], {
    table: "ms_massage_place_admin"
})

export const TblUserColumnSet = new ColumnSet([
    { name: "fullname", prop: "fullname" },
    { name: "gender", prop: "gender" },
    { name: "username", prop: "username" },
    { name: "email", prop: "email" },
    { name: "password", prop: "password" },
    { name: "role", prop: "role" }
], {
    table: "ms_user"
})

export const TblUserUpdateColumnSet = new ColumnSet([
    { name: "id", cnd: true },
    { name: "fullname", prop: "fullname" },
    { name: "username", prop: "username" },
    { name: "is_active", prop: "isActive" },
    { name: "updated_at", cast: "timestamp", prop: "updatedAt" }
], {
    table: "ms_user"
})

export const TblMemberBanColumnSet = new ColumnSet([
    { name: "member_user_id", prop: "memberUserId" },
    { name: "admin_user_id", prop: "adminUserId" },
    { name: "ban_reason", prop: "banReason" },
    { name: "ban_lifted_at", prop: "banLiftedAt" }
], {
    table: "ms_member_ban"
})

const dbUser = process.env.DATABASE_USER
const dbPass = process.env.DATABASE_PASS
const dbHost = process.env.DATABASE_HOST
const dbPort = process.env.DATABASE_PORT
const dbName = process.env.DATABASE_NAME

const connectionString = `postgres://${dbUser}:${dbPass}@${dbHost}:${dbPort}/${dbName}`

export const db = pgp(connectionString)