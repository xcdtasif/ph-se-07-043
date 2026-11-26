import app from "./app.js"
import { env } from "./config/env.js"

const isVercel = !!process.env["VERCEL"]

if (!isVercel) {
  app.listen(env.PORT, () => {
    console.log(`Server running on port ${env.PORT}`)
  })
}

export default app
