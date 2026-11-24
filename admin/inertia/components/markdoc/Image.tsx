export function Image({ src, alt, title }: { src: string; alt?: string; title?: string }) {
  return (
    <figure className="my-8">
      <div className="overflow-hidden rounded-xl border border-border-default">
        <img src={src} alt={alt || ''} title={title} className="w-full h-auto" loading="lazy" />
      </div>
      {alt && (
        <figcaption className="mt-3 text-center nd-eyebrow !normal-case !tracking-normal !text-xs">
          {alt}
        </figcaption>
      )}
    </figure>
  )
}
