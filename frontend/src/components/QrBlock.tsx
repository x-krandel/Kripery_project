import { useRef } from "react";
import QRCode from "react-qr-code";

/** QR to the public passport (/p/:id). Download gives an SVG to print and stick on the back of the work. */
export function QrBlock({ artworkId, title }: { artworkId: number; title: string }) {
  const url = `${window.location.origin}/p/${artworkId}`;
  const wrap = useRef<HTMLDivElement>(null);

  const download = () => {
    const svg = wrap.current?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([new XMLSerializer().serializeToString(svg)], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rodowod-qr-${artworkId}.svg`;
    a.click();
    // Revoking right away can cancel the download in Safari and Firefox.
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <div className="flex flex-wrap items-center gap-6 rounded-2xl border border-line bg-surface p-5">
      <div ref={wrap} className="shrink-0 bg-surface p-1">
        <QRCode value={url} size={112} fgColor="#17140F" title={`Kod QR paszportu: ${title}`} />
      </div>
      <div className="flex min-w-[220px] flex-1 flex-col gap-2">
        <span className="text-[17px] font-bold">Paszport publiczny</span>
        <span className="text-sm leading-normal text-ink-soft">
          Zeskanuj kod z odwrocia obrazu, aby zobaczyć pełną historię dzieła bez logowania.
        </span>
        <button type="button" onClick={download} className="btn-outline self-start text-sm">Pobierz kod do druku</button>
      </div>
    </div>
  );
}
