import { cn } from "@/lib/utils"
import { AnimatePresence, motion } from "motion/react"
import type React from "react"
import { useState } from "react"

export function AnimatedCircularButton({
  children,
  secondaryChildren,
  className,
  onMouseDown,
  isActive,
  ariaLabel,
  onMouseUp,
}: {
  children: React.ReactNode
  secondaryChildren?: React.ReactNode
  className?: string
  onMouseDown?: (e: React.MouseEvent<HTMLButtonElement>) => void
  isActive?: boolean
  ariaLabel: string
  onMouseUp?: (e: React.MouseEvent<HTMLButtonElement>) => void
}) {
  const [isShowingSecondary, setIsShowingSecondary] = useState(false)

  return (
    <motion.button
      type="button"
      tabIndex={0}
      aria-label={ariaLabel}
      className={cn(
        "group flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center rounded-full",
        className
      )}
      onMouseDown={(event) => {
        if (typeof isActive === "boolean") {
          onMouseDown?.(event)
          return
        }
        setIsShowingSecondary(!isShowingSecondary)
        onMouseDown?.(event)
        setTimeout(() => {
          setIsShowingSecondary(false)
          onMouseUp?.(event)
        }, 1000)
      }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {(typeof isActive === "boolean" ? isActive : isShowingSecondary) ? (
          <motion.div
            key="secondary"
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            {secondaryChildren}
          </motion.div>
        ) : (
          <motion.div
            key="primary"
            initial={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
            exit={{ opacity: 0, scale: 0.25, filter: "blur(4px)" }}
            transition={{ type: "spring", duration: 0.3, bounce: 0 }}
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  )
}
