import { isHosted } from "./isHosted"

export const getSubdomain = (hostname: string) => {
  return isHosted()
    ? hostname?.split(":")[0].split(".")[0]
    : (process.env.CL_ORGANIZATION as string)
}
