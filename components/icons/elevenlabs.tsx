export default function ElevenLabsIcon({
  size = 24,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 876 876"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M468 292H528V584H468V292Z" fill="currentColor" />
      <path d="M348 292H408V584H348V292Z" fill="currentColor" />
    </svg>
  )
}
