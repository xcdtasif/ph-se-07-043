import { seedUsers } from "../utils/seed-users.js"

// Customer 08 has no profile yet, like a new Google user, to try creating one
export const seedCustomers = () =>
  seedUsers(
    [
      {
        name: "Customer 01",
        email: "customer01@example.com",
        customer: { areaName: "Mirpur 10, Block C", meterNumber: "100000000001" },
      },
      {
        name: "Customer 02",
        email: "customer02@example.com",
        customer: { areaName: "Mirpur 10, Block C", meterNumber: "100000000002" },
      },
      {
        name: "Customer 03",
        email: "customer03@example.com",
        customer: { areaName: "Pallabi, Section 6" },
      },
      {
        name: "Customer 04",
        email: "customer04@example.com",
        customer: { areaName: "Dhanmondi Road 27", meterNumber: "100000000004" },
      },
      {
        name: "Customer 05",
        email: "customer05@example.com",
        isBanned: true,
        customer: { areaName: "Jigatola", meterNumber: "100000000005" },
      },
      {
        name: "Customer 06",
        email: "customer06@example.com",
        customer: { areaName: "Uttara Sector 10" },
      },
      {
        name: "Customer 07",
        email: "customer07@example.com",
        customer: { areaName: "Mirpur 10, Block A", meterNumber: "100000000007" },
      },
      { name: "Customer 08", email: "customer08@example.com" },
    ],
    "customer",
    "customers",
  )
