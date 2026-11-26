import { seedUsers } from "../utils/seed-users.js"

// Plain users for now; their Customer profiles (area, meter) come with the Customer model
export const seedCustomers = () =>
  seedUsers(
    [
      { name: "Customer 01", email: "customer01@example.com" },
      { name: "Customer 02", email: "customer02@example.com" },
      { name: "Customer 03", email: "customer03@example.com" },
      { name: "Customer 04", email: "customer04@example.com" },
      { name: "Customer 05", email: "customer05@example.com", isBanned: true },
      { name: "Customer 06", email: "customer06@example.com" },
      { name: "Customer 07", email: "customer07@example.com" },
      { name: "Customer 08", email: "customer08@example.com" },
    ],
    "customer",
    "customers",
  )
