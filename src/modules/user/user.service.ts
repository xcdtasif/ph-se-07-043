import { prisma } from "../../lib/prisma.js"
import { authUserSelect, publicUser, toAuthUser } from "../auth/auth.user.js"
import type { UpdateMePayload } from "./user.schema.js"

const updateMe = async (id: string, payload: UpdateMePayload) => {
  const user = await prisma.user.update({ where: { id }, data: payload, select: authUserSelect })

  return publicUser(toAuthUser(user))
}

export const userService = { updateMe }
