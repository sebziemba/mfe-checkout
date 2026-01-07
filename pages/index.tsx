// pages/index.tsx

import i18n from "i18next"
import type { NextPage } from "next"
import { Route, Routes } from "react-router-dom"
import Page404 from "./404"
import Order from "./Order"

console.log("I18N FROM COMPONENT:", i18n)
console.log("SAME INSTANCE?", (window as any).__I18N_INSTANCE__ === i18n)

const Home: NextPage = () => {
  return (
    <Routes>
      <Route path="/404" element={<Page404 />} />
      <Route path="/order/:orderId" element={<Order />} />
      <Route path="*" element={<Page404 />} />
    </Routes>
  )
}

export default Home
