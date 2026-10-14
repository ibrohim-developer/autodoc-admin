import { useEffect, useId, useRef, useState } from 'react'
import { formatCount, formatDay } from './format'

export type DailyPoint = { day: string; value: number }

const HEIGHT = 160
const AXIS = 36
const TOP = 8

/** A clean round top for the y-axis: 0 … 1, 2, 5, 10, 20, 50… */
function niceMax(value: number): number {
  if (value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const step = [1, 2, 5, 10].find((n) => n * power >= value) ?? 10
  return step * power
}

/**
 * One measure per day as columns: one series, so no legend (the title names it). Hover or
 * focus a day for its exact number; the same numbers are in a table for screen readers.
 */
export function DailyChart({
  points,
  label,
  unit,
}: {
  points: DailyPoint[]
  /** What the columns are, e.g. "Просмотры по дням". */
  label: string
  /** Shown in the tooltip after the number: "просмотров". */
  unit: string
}) {
  const id = useId()
  const [active, setActive] = useState<number | null>(null)
  // Drawn at the real width, so text stays 11px whether the chart is in a card or full width.
  const ref = useRef<HTMLElement>(null)
  const [width, setWidth] = useState(720)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => {
      if (entry && entry.contentRect.width > 0) setWidth(Math.round(entry.contentRect.width))
    })
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  const max = niceMax(Math.max(0, ...points.map((point) => point.value)))
  const plot = width - AXIS
  const slot = points.length > 0 ? plot / points.length : plot
  const bar = Math.max(2, Math.min(24, slot - 2))
  const y = (value: number) => TOP + (HEIGHT - TOP) * (1 - value / max)
  // A label every few days so they never collide.
  const every = Math.max(1, Math.ceil(points.length / Math.max(2, Math.floor(width / 70))))
  const hovered = active === null ? null : points[active]

  return (
    <figure ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT + 24}
        viewBox={`0 0 ${width} ${HEIGHT + 24}`}
        className="block max-w-full overflow-visible"
        role="img"
        aria-labelledby={`${id}-title`}
      >
        <title id={`${id}-title`}>{label}</title>
        {[0, max / 2, max].map((tick) => (
          <g key={tick}>
            <line
              x1={AXIS}
              x2={width}
              y1={y(tick)}
              y2={y(tick)}
              className="stroke-border"
              strokeWidth={1}
            />
            <text
              x={AXIS - 6}
              y={y(tick)}
              textAnchor="end"
              dominantBaseline="middle"
              className="fill-muted-foreground text-[11px]"
            >
              {formatCount(tick)}
            </text>
          </g>
        ))}
        {points.map((point, index) => {
          const x = AXIS + index * slot + (slot - bar) / 2
          const top = y(point.value)
          const h = HEIGHT - top
          const r = Math.min(4, h, bar / 2)
          return (
            // biome-ignore lint/a11y/noStaticElementInteractions: hover only adds a tooltip; the same numbers are in the table below for keyboards and screen readers
            <g
              key={point.day}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
            >
              {/* The whole column slot is the hover target, not just the thin bar. */}
              <rect
                x={AXIS + index * slot}
                y={TOP}
                width={slot}
                height={HEIGHT - TOP}
                fill="transparent"
              />
              {h > 0 ? (
                <path
                  d={`M${x},${HEIGHT} V${top + r} Q${x},${top} ${x + r},${top} H${x + bar - r} Q${x + bar},${top} ${x + bar},${top + r} V${HEIGHT} Z`}
                  className={active === index ? 'fill-primary' : 'fill-primary/80'}
                />
              ) : null}
              {index % every === 0 ? (
                <text
                  x={AXIS + index * slot + slot / 2}
                  y={HEIGHT + 16}
                  textAnchor="middle"
                  className="fill-muted-foreground text-[11px]"
                >
                  {formatDay(point.day)}
                </text>
              ) : null}
            </g>
          )
        })}
      </svg>
      {hovered && active !== null ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-md border bg-popover px-2 py-1 text-popover-foreground text-xs shadow-sm"
          style={{ left: `${((AXIS + active * slot + slot / 2) / width) * 100}%` }}
        >
          <span className="font-medium">{formatDay(hovered.day)}</span>:{' '}
          {formatCount(hovered.value)} {unit}
        </div>
      ) : null}
      <table className="sr-only">
        <caption>{label}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.day}>
              <th scope="row">{formatDay(point.day)}</th>
              <td>{point.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
