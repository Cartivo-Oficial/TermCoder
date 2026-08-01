import { cn } from "@/lib/utils";

export function CardGrid({
  children, cols = 3,
}: { children: React.ReactNode; cols?: 2 | 3 | 4 }) {
  return (
    <div
      className={cn(
        "mt-10 grid gap-4 sm:grid-cols-2",
        cols === 3 && "lg:grid-cols-3",
        cols === 4 && "lg:grid-cols-4",
      )}
    >
      {children}
    </div>
  );
}
