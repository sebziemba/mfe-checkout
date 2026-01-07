import { Base } from "components/ui/Base"
import { Card } from "components/ui/Card"
import { Container } from "components/ui/Container"
import localFont from "next/font/local"
import type { FC } from "react"

interface Props {
  aside: React.ReactNode
  main: React.ReactNode
}

/** Keep your existing font variables exactly */
const Hyundai = localFont({
  variable: "--font-body",
  display: "swap",
  fallback: [],
  adjustFontFallback: false,
  src: [
    {
      path: "../../styles/fonts/HyundaiSansHeadOffice-Light.ttf",
      weight: "300",
      style: "normal",
    },
    {
      path: "../../styles/fonts/HyundaiSansHeadOffice-Regular.ttf",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../styles/fonts/HyundaiSansHeadOffice-Medium.ttf",
      weight: "500",
      style: "normal",
    },
  ],
})

const ClassyVogue = localFont({
  src: "../../styles/fonts/Classyvogueregular.ttf",
  variable: "--font-title",
})

export const LayoutDefault: FC<Props> = ({ main, aside }) => {
  return (
    <Base>
      <Container>
        <div
          className={`${Hyundai.variable} font-body ${ClassyVogue.variable} font-title flex flex-wrap justify-end items-stretch flex-col min-h-full md:h-screen md:flex-row`}
        >
          <div className="flex-none md:flex-1">{aside}</div>
          <div className="flex-none md:flex-1 justify-center order-first md:order-last">
            <Card fullHeight>{main}</Card>
          </div>
        </div>
      </Container>
    </Base>
  )
}
