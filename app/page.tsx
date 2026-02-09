import TranscriptionWidget from "@/components/TranscriptionWidget"
import { cacheLife } from "next/cache"
import { Suspense } from "react"

export default async function Home() {
  "use cache"
  cacheLife("max")
  return (
    <div className="motion-opacity-in-0 grid h-dvh w-screen place-content-center">
      <Suspense>
        <TranscriptionWidget />
      </Suspense>
    </div>
  )
}
