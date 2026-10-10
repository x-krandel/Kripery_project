const PALETTE = ["bg-accent", "bg-[#2F4A3A]", "bg-brass", "bg-[#3B4A6B]", "bg-[#7A3E5B]", "bg-[#4E5D3A]"];

export function Avatar({ id, name, size = 34 }: { id: number; name: string; size?: number }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size }}
      className={`flex shrink-0 items-center justify-center rounded-full text-sm font-bold uppercase text-ground ${PALETTE[(id - 1) % PALETTE.length] ?? "bg-ink"}`}>
      {name.charAt(0)}
    </span>
  );
}
