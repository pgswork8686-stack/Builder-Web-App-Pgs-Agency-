/**
 * Fixed, synthetic records reserved for the local acceptance environment.
 *
 * These identifiers must never be pointed at a hosted database. The local
 * seed and runner both import this manifest so assertions never choose the
 * first row of a real-looking table.
 */
export const LOCAL_UAT = Object.freeze({
  label: "PGS HUB local synthetic UAT",
  titlePrefix: "[LOCAL-UAT]",
  password: "Password123!",
  companyInfoName: "PGS Agency Test",
  office: Object.freeze({
    latitude: 20.9768,
    longitude: 105.7725,
    radiusMeters: 100,
  }),
  users: Object.freeze({
    admin: Object.freeze({
      id: "00000000-0000-4000-8000-000000000001",
      email: "admin@test.local",
      role: "admin",
      fullName: "UAT Admin Local",
    }),
    leader: Object.freeze({
      id: "00000000-0000-4000-8000-000000000002",
      email: "leader@test.local",
      role: "team_leader",
      fullName: "UAT Leader Local",
    }),
    employee: Object.freeze({
      id: "00000000-0000-4000-8000-000000000003",
      email: "employee@test.local",
      role: "employee",
      fullName: "UAT Employee Local",
    }),
    accountant: Object.freeze({
      id: "00000000-0000-4000-8000-000000000004",
      email: "accountant@test.local",
      role: "accountant",
      fullName: "UAT Accountant Local",
    }),
    client: Object.freeze({
      id: "00000000-0000-4000-8000-000000000005",
      email: "client@test.local",
      role: "client",
      fullName: "UAT Client Local",
    }),
    foreignEmployee: Object.freeze({
      id: "00000000-0000-4000-8000-000000000006",
      email: "foreign-employee@test.local",
      role: "employee",
      fullName: "UAT Foreign Employee Local",
    }),
  }),
  departments: Object.freeze({
    primary: Object.freeze({
      id: "00000000-0000-4000-9000-000000000101",
      code: "PB_90",
      name: "Phòng UAT PGS Agency Test",
    }),
    foreign: Object.freeze({
      id: "00000000-0000-4000-9000-000000000102",
      code: "PB_91",
      name: "Phòng UAT Không Quản Lý",
    }),
  }),
  teams: Object.freeze({
    managed: Object.freeze({
      id: "00000000-0000-4000-9000-000000000201",
      code: "N_90",
      name: "Đội UAT do Leader quản lý",
    }),
    foreign: Object.freeze({
      id: "00000000-0000-4000-9000-000000000202",
      code: "N_91",
      name: "Đội UAT không thuộc Leader",
    }),
  }),
  companies: Object.freeze({
    primary: Object.freeze({
      id: "00000000-0000-4000-9000-000000000301",
      code: "KH_90",
      name: "PGS Agency Test Client",
    }),
    foreign: Object.freeze({
      id: "00000000-0000-4000-9000-000000000302",
      code: "KH_91",
      name: "PGS Agency Test Foreign Client",
    }),
  }),
  projects: Object.freeze({
    managed: Object.freeze({
      id: "00000000-0000-4000-9000-000000000401",
      code: "DA_90",
      name: "Dự án UAT do Leader quản lý",
    }),
    foreign: Object.freeze({
      id: "00000000-0000-4000-9000-000000000402",
      code: "DA_91",
      name: "Dự án UAT không thuộc Leader",
    }),
  }),
  projectService: Object.freeze({
    id: "00000000-0000-4000-9000-000000000501",
    serviceCode: "DV_01",
  }),
  attendance: Object.freeze({
    scopeDate: "2000-01-15",
    managedRecordId: "00000000-0000-4000-9000-000000000601",
    foreignRecordId: "00000000-0000-4000-9000-000000000602",
  }),
  compensation: Object.freeze({
    admin: Object.freeze({ baseSalary: 35_000_000, allowances: 2_000_000 }),
    leader: Object.freeze({ baseSalary: 28_000_000, allowances: 1_750_000 }),
    employee: Object.freeze({
      baseSalary: 22_000_000,
      allowances: 1_500_000,
    }),
    accountant: Object.freeze({
      baseSalary: 26_000_000,
      allowances: 1_250_000,
    }),
    foreignEmployee: Object.freeze({
      baseSalary: 20_000_000,
      allowances: 1_000_000,
    }),
  }),
  payroll: Object.freeze({
    periodMonth: "2099-12",
    title: "[LOCAL-UAT] Payroll 2099-12",
    standardWorkingDays: 22,
  }),
  documents: Object.freeze({
    title: "[LOCAL-UAT] Storage byte-equality proof",
    fileName: "local-uat-storage-proof.pdf",
    payload: "%PDF-1.4 PGS HUB LOCAL UAT DETERMINISTIC STORAGE PROOF",
  }),
});

export const UAT_USERS = Object.freeze(Object.values(LOCAL_UAT.users));

export const UAT_EMPLOYEE_USERS = Object.freeze([
  LOCAL_UAT.users.admin,
  LOCAL_UAT.users.leader,
  LOCAL_UAT.users.employee,
  LOCAL_UAT.users.accountant,
  LOCAL_UAT.users.foreignEmployee,
]);

export const UAT_USER_IDS = Object.freeze(UAT_USERS.map((user) => user.id));
