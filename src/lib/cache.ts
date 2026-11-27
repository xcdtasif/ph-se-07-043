import { redis } from "./redis.js"

/*
Public reads are cached in Redis under a version number per namespace. A write bumps the
version after it commits, so every older entry stops being read at once; the TTL then clears
them out. "grid" holds zones, feeders and areas; "schedules" holds slots, which show feeder
names; "outages" holds outages, which show zone, feeder and area names. So a grid write that
changes a name bumps the namespaces that show it
*/
type Namespace = "grid" | "schedules" | "outages"

const TTL_SECONDS = 5 * 60
const TIMEOUT_MS = 1000

const versionKey = (namespace: Namespace) => `cache:version:${namespace}`

// Redis being down or slow must not take the API with it, so callers fall back to the database
const withTimeout = <T>(promise: Promise<T>) =>
  Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error("Redis timed out")), TIMEOUT_MS).unref(),
    ),
  ])

/*
Returns the cached value for `key`, or loads and stores it. Errors from `load` aren't cached.
A cached value comes back as parsed JSON, so dates are ISO strings; responses look the same
*/
export const cached = async <T>(
  namespace: Namespace,
  key: string,
  load: () => Promise<T>,
): Promise<T> => {
  let fullKey: string

  try {
    const version = (await withTimeout(redis.get<number>(versionKey(namespace)))) ?? 0
    fullKey = `cache:${namespace}:v${version}:${key}`

    const hit = await withTimeout(redis.get<T>(fullKey))

    if (hit !== null) {
      return hit
    }
  } catch (err) {
    console.error("Cache read failed", err)

    return load()
  }

  const value = await load()

  try {
    await withTimeout(redis.set(fullKey, value, { ex: TTL_SECONDS }))
  } catch (err) {
    console.error("Cache write failed", err)
  }

  return value
}

/*
Call after the write has committed. If the bump fails, readers may see old data until the
TTL runs out; the write itself still stands
*/
export const bumpCache = async (...namespaces: Namespace[]) => {
  try {
    await withTimeout(Promise.all(namespaces.map((namespace) => redis.incr(versionKey(namespace)))))
  } catch (err) {
    console.error("Cache invalidation failed", err)
  }
}
