import { BookOpen, DoorOpen } from 'lucide-react'

export const cx = (...values: (string | false | undefined | null)[]) => values.filter(Boolean).join(' ')

export function Logo({ inverse = false }: { inverse?: boolean }) {
  return (
    <div className={cx('flex items-center gap-3 font-semibold', inverse && 'text-primary-foreground')}>
      <span className={cx('grid size-9 place-items-center rounded-xl', inverse ? 'bg-primary-foreground text-primary' : 'bg-primary text-primary-foreground')}>
        <BookOpen size={18} />
      </span>
      <span>Mock Test</span>
    </div>
  )
}

export function Field({
  label,
  name,
  hint,
  ...props
}: { label: string; name: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2 text-sm font-medium">
      {label}
      <input
        name={name}
        className="rounded-xl border bg-background px-4 py-3 font-normal outline-none transition focus:ring-2 focus:ring-ring"
        {...props}
      />
      {hint && <span className="font-normal text-xs text-muted-foreground">{hint}</span>}
    </label>
  )
}

export function Heading({ eyebrow, title, action }: { eyebrow: string; title: string; action?: React.ReactNode }) {
  return (
    <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="font-mono text-xs uppercase tracking-[.2em] text-primary">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-semibold text-balance md:text-4xl">{title}</h1>
      </div>
      {action}
    </header>
  )
}

export function Stat({ label, value, note }: { label: string; value: string | number; note: string }) {
  return (
    <article className="rounded-2xl border bg-card p-5">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-semibold">{value}</p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </article>
  )
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card p-12 text-center">
      <DoorOpen className="mx-auto text-muted-foreground" />
      <p className="mt-4 font-medium">Nothing here yet</p>
      <p className="mt-2 text-sm text-muted-foreground">{text}</p>
    </div>
  )
}
