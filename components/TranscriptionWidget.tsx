"use client"

import { deleteHistoryItem, fetchHistory, transcribeAudio } from "@/app/actions"
import { AnimatedCircularButton } from "@/components/AnimatedButton"
import DropZone from "@/components/DropZone"
import AudioIcon from "@/components/icons/audio"
import { ArrowLeft, Check, Copy, Gauge, Loader, RefreshCw, X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { useCallback, useRef, useState } from "react"

type HistoryItem = {
  id: number
  created_at: string
  source: string
  transcription: string
}

export default function TranscriptionWidget() {
  const [stage, setStage] = useState("initial")
  const [transcriptionText, setTranscriptionText] = useState("")
  const [copiedMessage, setCopiedMessage] = useState(false)
  const [isRateLimited, setIsRateLimited] = useState(false)
  const [sizeExceeded, setSizeExceeded] = useState(false)
  const [isRecording, setIsRecording] = useState(false)
  const [micError, setMicError] = useState(false)
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const mediaStreamRef = useRef<MediaStream | null>(null)
  const recordedChunksRef = useRef<BlobPart[]>([])

  function getSupportedMime(): { mimeType: string; ext: string } {
    const candidates = [
      { mimeType: "audio/mp4", ext: "m4a" },
      { mimeType: "audio/mpeg", ext: "mp3" },
      { mimeType: "audio/ogg;codecs=opus", ext: "ogg" },
      { mimeType: "audio/ogg", ext: "ogg" },
      { mimeType: "audio/webm;codecs=opus", ext: "webm" },
      { mimeType: "audio/webm", ext: "webm" },
    ]
    for (const c of candidates) {
      const mr = typeof window !== "undefined" ? (window as any).MediaRecorder : undefined
      if (typeof mr !== "undefined" && mr?.isTypeSupported?.(c.mimeType)) {
        return c
      }
    }
    return { mimeType: "audio/webm", ext: "webm" }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      mediaStreamRef.current = stream
      recordedChunksRef.current = []
      const { mimeType } = getSupportedMime()
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr

      mr.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) recordedChunksRef.current.push(ev.data)
      }

      mr.onstop = async () => {
        const recordedType = mr.mimeType || getSupportedMime().mimeType
        const blob = new Blob(recordedChunksRef.current, { type: recordedType })

        let file: File
        if (/webm|ogg/i.test(recordedType)) {
          try {
            file = await convertRecordedBlobToWav(blob)
          } catch (e) {
            console.error("convert to wav failed", e)
            const extFallback = recordedType.includes("ogg") ? "ogg" : "webm"
            file = new File([blob], `recording-${Date.now()}.${extFallback}`, {
              type: recordedType,
            })
          }
        } else {
          const ext = recordedType.includes("mpeg")
            ? "mp3"
            : recordedType.includes("mp4")
              ? "m4a"
              : "wav"
          file = new File([blob], `recording-${Date.now()}.${ext}`, {
            type: recordedType,
          })
        }

        cleanupStream()
        handleFile(file, "recording")
      }

      mr.start()
      setIsRecording(true)
    } catch (err) {
      console.error("mic permission or recorder error", err)
      setIsRecording(false)
      setMicError(true)
      setTimeout(() => setMicError(false), 1500)
    }
  }

  function stopRecording() {
    try {
      const mr = mediaRecorderRef.current
      if (mr && mr.state !== "inactive") {
        mr.stop()
      }
    } finally {
      setIsRecording(false)
    }
  }

  function cleanupStream() {
    try {
      mediaStreamRef.current?.getTracks().forEach((t) => t.stop())
    } catch {}
    mediaStreamRef.current = null
    mediaRecorderRef.current = null
    recordedChunksRef.current = []
  }

  async function convertRecordedBlobToWav(inputBlob: Blob): Promise<File> {
    const arrayBuffer = await inputBlob.arrayBuffer()
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0))

    const numChannels = audioBuffer.numberOfChannels
    const sampleRate = audioBuffer.sampleRate
    const length = audioBuffer.length * numChannels * 2 + 44
    const buffer = new ArrayBuffer(length)
    const view = new DataView(buffer)

    function writeString(view: DataView, offset: number, str: string) {
      for (let i = 0; i < str.length; i++) {
        view.setUint8(offset + i, str.charCodeAt(i))
      }
    }

    let offset = 0
    writeString(view, offset, "RIFF")
    offset += 4
    view.setUint32(offset, 36 + audioBuffer.length * numChannels * 2, true)
    offset += 4
    writeString(view, offset, "WAVE")
    offset += 4
    writeString(view, offset, "fmt ")
    offset += 4
    view.setUint32(offset, 16, true)
    offset += 4
    view.setUint16(offset, 1, true)
    offset += 2
    view.setUint16(offset, numChannels, true)
    offset += 2
    view.setUint32(offset, sampleRate, true)
    offset += 4
    view.setUint32(offset, sampleRate * numChannels * 2, true)
    offset += 4
    view.setUint16(offset, numChannels * 2, true)
    offset += 2
    view.setUint16(offset, 16, true)
    offset += 2
    writeString(view, offset, "data")
    offset += 4
    view.setUint32(offset, audioBuffer.length * numChannels * 2, true)
    offset += 4

    const channels = [] as Float32Array[]
    for (let i = 0; i < numChannels; i++) {
      channels.push(audioBuffer.getChannelData(i))
    }

    let sampleIndex = 0
    while (sampleIndex < audioBuffer.length) {
      for (let ch = 0; ch < numChannels; ch++) {
        const sample = Math.max(-1, Math.min(1, channels[ch][sampleIndex]))
        view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true)
        offset += 2
      }
      sampleIndex++
    }

    const wavBlob = new Blob([view], { type: "audio/wav" })
    const wavFile = new File([wavBlob], `recording-${Date.now()}.wav`, {
      type: "audio/wav",
    })
    try {
      audioContext.close()
    } catch {}
    return wavFile
  }

  function handleClick() {
    if (transcriptionText !== "") return
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "audio/*"
    input.onchange = (event: any) => {
      const file = event.target.files?.[0]
      if (file) {
        handleFile(file, file.name)
      }
    }
    input.click()
  }

  async function handleFile(file: File, source?: string) {
    if (file.size > 100 * 1024 * 1024) {
      setSizeExceeded(true)
      return
    }
    setStage("processing")
    setCopiedMessage(false)

    const formData = new FormData()
    formData.append("file", file)
    formData.append("source", source || file.name || "upload")

    let result
    try {
      result = await transcribeAudio(formData)
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : ""
      if (msg.includes("413") || msg.toLowerCase().includes("body exceeded")) {
        setSizeExceeded(true)
        setStage("initial")
        return
      }
      console.error("Transcription request failed:", err)
      setStage("initial")
      return
    }

    if (result.rateLimited) {
      setIsRateLimited(true)
      setStage("initial")
      return
    }

    if (result.sizeExceeded) {
      setSizeExceeded(true)
      setStage("initial")
      return
    }

    if (result.error || !result.transcription) {
      console.error("Transcription error:", result.error)
      setStage("initial")
      return
    }

    navigator.clipboard.writeText(result.transcription)
    setTranscriptionText(result.transcription)
    setStage("done")
    setCopiedMessage(true)
  }

  async function loadHistory() {
    setIsLoadingHistory(true)
    const result = await fetchHistory()
    setHistory(result.history)
    setIsLoadingHistory(false)
  }

  async function openHistory() {
    await loadHistory()
    setStage("history")
  }

  const [holdingId, setHoldingId] = useState<number | null>(null)

  const startHold = useCallback(
    (id: number) => {
      setHoldingId(id)
      holdTimerRef.current = setTimeout(async () => {
        setHoldingId(null)
        setDeletingId(id)
        await deleteHistoryItem(id)
        await loadHistory()
        setDeletingId(null)
      }, 1500)
    },
    [history]
  )

  const cancelHold = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    setHoldingId(null)
  }, [])

  return (
    <>
      <div className="relative">
        <AnimatePresence>
          {micError && (
            <motion.p
              initial={{ opacity: 0, y: 8, scale: 0.92, filter: "blur(2px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 6, scale: 0.92, filter: "blur(1.5px)" }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="absolute -top-[16px] left-1/2 -translate-x-1/2 -translate-y-full text-sm font-medium whitespace-nowrap text-red-600/90 antialiased"
            >
              Microphone permission missing
            </motion.p>
          )}
        </AnimatePresence>
        <DropZone onClick={handleClick} onDropped={(f) => handleFile(f, f.name)} stage={stage}>
          {(() => {
            if (isRateLimited || sizeExceeded) {
              return (
                <div
                  className="motion-preset-focus-sm flex flex-col items-center p-8 text-red-600"
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    setSizeExceeded(false)
                    setIsRateLimited(false)
                  }}
                >
                  <Gauge size={18} className="mb-3" />
                  <p className="font-jetbrains-mono text-sm">
                    {sizeExceeded ? "File too large" : "rate limited"}
                  </p>
                  <p className="font-jetbrains-mono mt-1 text-[13px] opacity-60">
                    {sizeExceeded ? "Max 100MB" : "try again later"}
                  </p>
                </div>
              )
            } else {
              if (stage === "initial") {
                return (
                  <div
                    className="motion-opacity-in-0 mt-4 mr-12 mb-4 ml-12 flex flex-col items-center gap-1 py-4"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <AnimatedCircularButton
                      className="mb-5 grid h-13 w-13 place-content-center rounded-full border border-gray-100"
                      isActive={isRecording}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        if (!isRecording) {
                          startRecording()
                        } else {
                          stopRecording()
                        }
                      }}
                      secondaryChildren={
                        <div
                          className="size-3 rounded-sm bg-red-500/80"
                          style={{ cornerShape: "squircle" } as React.CSSProperties}
                        />
                      }
                      ariaLabel="Record audio"
                    >
                      <AudioIcon size={18} />
                    </AnimatedCircularButton>
                    <p className="font-sans text-sm font-medium antialiased">
                      Drop an audio file here
                    </p>
                    <p
                      className="font-jetbrains-mono relative mt-0.5 cursor-pointer text-sm opacity-60 transition-opacity hover:text-blue-600 hover:opacity-80"
                      onMouseDown={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        openHistory()
                      }}
                    >
                      Show History
                      {isLoadingHistory && (
                        <Loader size={12} className="absolute top-0.5 -right-5 animate-spin" />
                      )}
                    </p>
                  </div>
                )
              } else if (stage === "processing") {
                return (
                  <div className="motion-preset-focus-sm flex flex-col items-center p-8 text-blue-600">
                    <Loader size={18} className="mb-3 animate-spin" />
                    <p className="font-jetbrains-mono text-sm">Transcribing</p>
                  </div>
                )
              } else if (stage === "done") {
                return (
                  <div className="flex flex-col items-center">
                    <p className="h-fit max-w-md px-1 py-3 font-sans text-[15px] antialiased">
                      {transcriptionText}
                    </p>
                  </div>
                )
              } else if (stage === "history") {
                return (
                  <div
                    className="flex w-96 flex-col gap-5 px-1 pt-1 pb-3"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex items-center justify-between">
                      <p
                        className="flex cursor-pointer items-center gap-2 font-sans text-sm font-medium antialiased"
                        onMouseDown={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          setStage("initial")
                        }}
                      >
                        <ArrowLeft size={15} /> Back
                      </p>
                      <AnimatedCircularButton
                        ariaLabel="Refresh history"
                        onMouseDown={() => {
                          loadHistory()
                        }}
                        secondaryChildren={<Loader size={16} className="animate-spin" />}
                        className="translate-x-2.5 -translate-y-0.5"
                      >
                        <RefreshCw size={16} />
                      </AnimatedCircularButton>
                    </div>
                    <div className="flex max-h-192 flex-col gap-4 overflow-y-auto">
                      {isLoadingHistory && history.length === 0 && (
                        <div className="flex justify-center py-8">
                          <Loader size={16} className="animate-spin text-gray-400" />
                        </div>
                      )}
                      {!isLoadingHistory && history.length === 0 && (
                        <p className="font-jetbrains-mono py-8 text-center text-sm text-gray-400">
                          No transcriptions yet
                        </p>
                      )}
                      {history.map((item) => {
                        const sourceLabel = item.source === "recording" ? "Recording" : item.source
                        const isHolding = holdingId === item.id
                        const isDeleting = deletingId === item.id
                        return (
                          <div key={item.id} className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <div className="relative select-none">
                                <p
                                  className="font-sans text-sm font-medium text-gray-500/80 antialiased"
                                  onMouseDown={(e) => {
                                    e.preventDefault()
                                    e.stopPropagation()
                                    if (!isDeleting) startHold(item.id)
                                  }}
                                  onMouseUp={cancelHold}
                                  onMouseLeave={cancelHold}
                                  onTouchStart={(e) => {
                                    e.stopPropagation()
                                    if (!isDeleting) startHold(item.id)
                                  }}
                                  onTouchEnd={cancelHold}
                                  onTouchCancel={cancelHold}
                                >
                                  {sourceLabel}
                                  {isDeleting && (
                                    <Loader
                                      size={11}
                                      className="ml-1.5 inline animate-spin text-red-600"
                                    />
                                  )}
                                </p>
                                <p
                                  aria-hidden
                                  className="pointer-events-none absolute inset-0 font-sans text-sm font-medium text-red-600 antialiased"
                                  style={{
                                    clipPath: isHolding ? "inset(0 0 0 0)" : "inset(0 100% 0 0)",
                                    transition: isHolding
                                      ? "clip-path 1.5s linear"
                                      : "clip-path 0.15s ease-out",
                                  }}
                                >
                                  {sourceLabel}
                                </p>
                              </div>
                              <p className="font-jetbrains-mono text-xs font-medium text-gray-400 antialiased">
                                {new Date(item.created_at).toLocaleDateString(undefined, {
                                  month: "short",
                                  day: "numeric",
                                  year: "numeric",
                                })}
                              </p>
                            </div>
                            <p
                              className="cursor-pointer font-sans text-sm antialiased transition-opacity"
                              onMouseDown={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setTranscriptionText(item.transcription)
                                setStage("done")
                                setCopiedMessage(true)
                                navigator.clipboard.writeText(item.transcription)
                              }}
                            >
                              {item.transcription.length > 120
                                ? item.transcription.slice(0, 120) + "..."
                                : item.transcription}
                            </p>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              } else {
                return null
              }
            }
          })()}
        </DropZone>
      </div>

      {copiedMessage ? (
        <div className="animate-copied-message-up mt-4 flex items-center justify-center gap-3">
          <div className="grid cursor-pointer place-content-center rounded-full bg-gray-100/70 text-gray-600">
            <AnimatedCircularButton
              ariaLabel="Copy to clipboard"
              onMouseDown={() => {
                navigator.clipboard.writeText(transcriptionText)
              }}
              secondaryChildren={<Check size={14.45} strokeWidth={2.5} />}
            >
              <Copy size={14.45} strokeWidth={2.5} />
            </AnimatedCircularButton>
          </div>
          <div className="grid cursor-pointer place-content-center rounded-full bg-gray-100/70 text-gray-600">
            <AnimatedCircularButton
              ariaLabel="Clear"
              onMouseDown={() => {
                setStage("initial")
                setCopiedMessage(false)
                setTranscriptionText("")
              }}
              secondaryChildren={<X size={15.75} strokeWidth={2.5} />}
            >
              <X size={15.75} strokeWidth={2.5} />
            </AnimatedCircularButton>
          </div>
        </div>
      ) : (
        <></>
      )}
    </>
  )
}
