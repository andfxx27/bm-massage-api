# bm-massage-api

Restful API project for bm-massage web application

## Entities

[Enum]
- BanApprovalStatus [PENDING,BANNED,REVOKED]
- BanStatus [ACTIVE,PENDING,BANNED]
- Gender [MALE,FEMALE]
- MassageOrderStatus [PENDING,COMPLETED,EXPIRED]
- UserRole [OWNER,ADMIN,MEMBER]

[Table]
- City [Id(PK),Name,UpdatedAt,CreatedAt]
- User [Id(PK),Fullname,Gender,Username,Email,Password,Role,BanStatus,IsActive,UpdatedAt,CreatedAt]
- MassagePlace [Id(PK),Name,MaxCapacity,Address,OwnerUserId(FK-User),CityId(FK-City),UpdatedAt,CreatedAt]
- MassagePlaceAdmin [AdminUserId(PK,FK-User),MassagePlaceId(FK-MassagePlace),CreatedAt]
- MassagePackage [Id(PK),Name,Capacity,Price,MassagePlaceId(FK-MassagePlace),MassagePackageTypeId(FK-MassagePackageType),UpdatedAt,CreatedAt]
- MassagePackageType [Id(PK),Name,UpdatedAt,CreatedAt]
- MassageOrder [Id(PK),OrderStatus,MemberUserId(FK-User),AdminUserId(FK-User),MassagePackageId(FK-MassagePackage),UpdatedAt,CreatedAt]
- MemberBan [Id(PK),MemberUserId(FK-User),AdminUserId(FK-User),OwnerUserId(FK-User),BanReason,ApprovalStatus,BanLiftedAt,UpdatedAt,CreatedAt]

## Respective roles and authorization

### Owner

- Auth (Sign in)
- View cities
- View massage places by cities
- Create massage place @ specific city
- View & update massage place detail (including the admin information)
- Member control (Approve Ban Request, Revoke Ban Request)
- Profit reporting by date

### Admin

- Auth (Sign in)
- View ongoing massage orders
- View ongoing massage order detail
- Update massage order status (Mark as complete/ expired)
- View massage order logs history
- Member control (View member's completed & expired orders count; Request member ban approval)
- View managed massage place detail
- Add new massage package @ specific massage place

### Member

- Auth (Sign up; Sign in)
- View cities
- View ongoing massage orders
- View massage places by cities
- View massage place detail
- Create massage order @ specific massage place

Notes: some role can have similar functions (such as view cities) but could have different json response object fields

## Todos

- [x] Sign up endpoint
- [x] Sign in endpoint
- [x] Get cities endpoint
- [x] Create massage place endpoint
- [x] View massage places endpoint
- [x] View massage place detail endpoint
- [x] Update massage place endpoint
- [x] Update massage place admins endpoint
- [x] Create massage order endpoint
- [x] View ongoing massage orders endpoint
- [x] View ongoing massage order detail endpoint
- [x] View massage orders log history endpoint
- [x] View member's completed, expired orders count, and ban status endpoint
- [x] Request member ban approval endpoint
- [x] Approve member ban request endpoint
- [ ] View member ban requests endpoint
- [ ] View profit reporting endpoint
- [ ] View massage package types endpoint
- [ ] Add new massage package at specific massage place endpoint
- [ ] Adjust response message for failed cases across all endpoint