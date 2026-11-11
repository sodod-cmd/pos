// Plain class strings, importable from both server and client components.
import { cn } from '@/lib/utils'

export const controlClass =
  'w-full rounded-xl border border-input/80 bg-card px-3.5 py-2.5 text-[15px] text-foreground shadow-[inset_0_1px_1px_rgb(36_26_44/0.04)] placeholder:text-muted-foreground/60 transition-[border-color,box-shadow] focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/10 aria-[invalid=true]:border-destructive aria-[invalid=true]:ring-destructive/10'

export const selectClass = cn(
  controlClass,
  'appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2712%27 height=%2712%27 fill=%27none%27 stroke=%27%235b1fa8%27 stroke-width=%272%27%3E%3Cpath d=%27M2 4l4 4 4-4%27/%3E%3C/svg%3E")] bg-[length:12px] bg-[right_1rem_center] bg-no-repeat pr-10',
)
