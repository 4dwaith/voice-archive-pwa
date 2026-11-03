export function NavigationArrows({
  direction,
  noOfArrows,
}: {
  direction: number
  noOfArrows: number
}) {
  return (
    <svg
      aria-hidden="true"
      className="h-[max(24px,1em)] w-[max(36px,1.5em)] shrink-0 text-lg"
      viewBox="0 0 36 24"
      fill="currentColor"
    >
      <g transform={direction < 0 ? 'rotate(180 18 12)' : undefined}>
        {Array.from({ length: noOfArrows }, (_, index) => (
          <path
            key={index}
            d="M0 3 L10 12 L0 21Z"
            transform={`translate(${(36 - noOfArrows * 12) / 2 + index * 12} 0)`}
          />
        ))}
      </g>
    </svg>
  )
}
