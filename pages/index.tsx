// pages/index.tsx
import type { NextPage } from "next"
import { Route, Routes } from "react-router-dom"

import Page404 from "./404"
import Order from "./Order"

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
