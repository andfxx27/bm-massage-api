import pgPromise from "pg-promise"

const initOptions = {}

export const pgp = pgPromise(initOptions)

const { ColumnSet } = pgp.helpers

export const TblMassageOrderInsertColumnSet = new ColumnSet([
    { name: "member_user_id", prop: "memberUserId" },
    { name: "massage_package_id", prop: "massagePackageId" }
], {
    table: "ms_massage_order"
})

export const TblMassageOrderUpdateOrderStatusColumnSet = new ColumnSet([
    { name: "id", cnd: true },
    { name: "order_status", prop: "orderStatus" },
    { name: "admin_user_id", prop: "adminUserId" },
    { name: "updated_at", cast: "timestamp", prop: "updatedAt" },
], {
    table: "ms_massage_order"
})

export const TblMassagePackageInsertColumnSet = new ColumnSet([
    { name: "name", prop: "name" },
    { name: "capacity", prop: "capacity" },
    { name: "price", prop: "price" },
    { name: "admin_user_id", prop: "adminUserId" },
    { name: "massage_place_id", prop: "massagePlaceId" },
    { name: "massage_package_type_id", prop: "massagePackageTypeId" }
], {
    table: "ms_massage_package"
})

export const TblMassagePlaceInsertColumnSet = new ColumnSet([
    { name: "name", prop: "name" },
    { name: "max_capacity", prop: "maxCapacity" },
    { name: "address", prop: "address" },
    { name: "owner_user_id", prop: "ownerUserId" },
    { name: "city_id", prop: "cityId" }
], {
    table: "ms_massage_place"
})

export const TblMassagePlaceAdminInsertColumnSet = new ColumnSet([
    { name: "admin_user_id", prop: "adminUserId" },
    { name: "massage_place_id", prop: "massagePlaceId" }
], {
    table: "ms_massage_place_admin"
})

export const TblUserInsertColumnSet = new ColumnSet([
    { name: "fullname", prop: "fullname" },
    { name: "gender", prop: "gender" },
    { name: "username", prop: "username" },
    { name: "email", prop: "email" },
    { name: "password", prop: "password" },
    { name: "role", prop: "role" }
], {
    table: "ms_user"
})

export const TblUserAdminInsertColumnSet = new ColumnSet([
    { name: "fullname", prop: "fullname" },
    { name: "gender", prop: "gender" },
    { name: "username", prop: "username" },
    { name: "email", prop: "email" },
    { name: "password", prop: "password" },
    { name: "role", prop: "role" },
    { name: "is_active", prop: "isActive" }
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
    { name: "ban_reason", prop: "banReason" }
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