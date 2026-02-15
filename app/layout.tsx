import type { Metadata } from "next"
import { cacheLife } from "next/cache"
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"
import localFont from "next/font/local"
import "./globals.css"

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

const jetBrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
})

const ioskeleyMono = localFont({
  variable: "--font-ioskeley-mono",
  src: [
    { path: "./fonts/IoskeleyMono-Light.woff2", weight: "300" },
    { path: "./fonts/IoskeleyMono-Regular.woff2", weight: "400" },
    { path: "./fonts/IoskeleyMono-Medium.woff2", weight: "500" },
    { path: "./fonts/IoskeleyMono-SemiBold.woff2", weight: "600" },
    { path: "./fonts/IoskeleyMono-Bold.woff2", weight: "700" },
    { path: "./fonts/IoskeleyMono-ExtraBold.woff2", weight: "800" },
  ],
})

const isDevelopment = process.env.NODE_ENV === "development"

export const metadata: Metadata = {
  title: isDevelopment ? "Transcriptions (dev)" : "Transcriptions",
  description: "A *very* simple transcription app",
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  "use cache"
  cacheLife("max")
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${jetBrainsMono.variable} ${ioskeleyMono.variable} bg-background`}
      >
        {children}
      </body>
    </html>
  )
}
