import { cn } from "@/lib/utils";

type CoverArtProps = {
  src?: string | null;
  title: string;
  className?: string;
  eager?: boolean;
};

export function CoverArt({ src, title, className, eager = false }: CoverArtProps) {
  return (
    <div className={cn("cover-art", className)}>
      {src ? (
        <img
          src={src}
          alt={`ปกนิยาย ${title}`}
          loading={eager ? "eager" : "lazy"}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="cover-fallback">
          <span>No.73</span>
          <strong>{title}</strong>
        </div>
      )}
    </div>
  );
}
