import { mediaUrl } from "../api/client";

interface Props {
  src: string;
  alt: string;
  /** Width of the white mat around the picture. */
  mat?: "sm" | "md" | "lg";
  shadow?: boolean;
  className?: string;
  imgClassName?: string;
}

const MAT = { sm: "p-2", md: "p-[18px]", lg: "p-6 sm:p-8" };

/** A picture on a white passe-partout: the gallery look used on every screen. */
export function ArtworkFrame({ src, alt, mat = "md", shadow = false, className = "", imgClassName = "aspect-[4/5]" }: Props) {
  return (
    <div className={`border border-line bg-surface ${MAT[mat]} ${shadow ? "shadow-[0_30px_60px_-32px_rgba(23,20,15,0.35)]" : ""} ${className}`}>
      <div className={`overflow-hidden outline outline-1 outline-line-strong ${imgClassName}`}>
        <img src={mediaUrl(src)} alt={alt} className="h-full w-full object-cover" loading="lazy" />
      </div>
    </div>
  );
}
