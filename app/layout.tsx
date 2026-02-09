import type { Metadata } from "next"
import { cacheLife } from "next/cache"
import { Geist, Geist_Mono, JetBrains_Mono } from "next/font/google"
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
        className={`${geistSans.variable} ${geistMono.variable} ${jetBrainsMono.variable} bg-background`}
      >
        {children}
      </body>
    </html>
  )
}
