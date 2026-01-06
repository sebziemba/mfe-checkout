// utils/debugTrace.ts
export const DEBUG_KEY = "cl_checkout_debug_v1"

type DebugEntry = {
  ts: string
  step: string
  data?: any
}

function safeParse(json: string | null): DebugEntry[] {
  if (!json) return []
  try {
    const v = JSON.parse(json)
    return Array.isArray(v) ? v : []
  } catch {
    return []
  }
}

function write(arr: DebugEntry[]) {
  const payload = JSON.stringify(arr, null, 2)
  try {
    sessionStorage.setItem(DEBUG_KEY, payload)
  } catch {
    // ignore
  }
  try {
    localStorage.setItem(DEBUG_KEY, payload)
  } catch {
    // ignore
  }
}

export function pushDebug(step: string, data?: any) {
  const entry: DebugEntry = { ts: new Date().toISOString(), step, data }

  // read from session first, fallback to local
  const prev =
    (typeof window !== "undefined" && sessionStorage.getItem(DEBUG_KEY)) ||
    (typeof window !== "undefined" && localStorage.getItem(DEBUG_KEY)) ||
    null

  const arr = safeParse(prev)
  arr.push(entry)
  write(arr)
}

export function readDebug(): DebugEntry[] {
  const prev =
    (typeof window !== "undefined" && sessionStorage.getItem(DEBUG_KEY)) ||
    (typeof window !== "undefined" && localStorage.getItem(DEBUG_KEY)) ||
    null

  return safeParse(prev)
}

export function clearDebug() {
  try {
    sessionStorage.removeItem(DEBUG_KEY)
  } catch {}
  try {
    localStorage.removeItem(DEBUG_KEY)
  } catch {}
}
