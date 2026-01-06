;(() => {
  try {
    const key = "cl_checkout_debug_v1"
    const entry = {
      ts: new Date().toISOString(),
      step: "DOCUMENT_BOOT",
      href: window.location.href,
      path: window.location.pathname,
      search: window.location.search,
    }

    const raw = sessionStorage.getItem(key) || localStorage.getItem(key) || "[]"

    let arr
    try {
      arr = JSON.parse(raw)
    } catch {
      arr = []
    }

    arr.push(entry)

    const payload = JSON.stringify(arr, null, 2)
    sessionStorage.setItem(key, payload)
    localStorage.setItem(key, payload)
  } catch {
    // swallow on purpose
  }
})()
