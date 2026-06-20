/** Converts s3://key to the browser-accessible proxy URL */
export function resolveS3ImageSrc(src: string | undefined): string | undefined {
  if (!src) return undefined
  if (src.startsWith("s3://")) {
    return `/api/s3-image?key=${encodeURIComponent(src.slice(5))}`
  }
  return src
}

/**
 * Pre-processes Markdown content before passing to <Markdown>:
 * replaces ![](s3://key) with ![](/api/s3-image?key=...) so the
 * URL survives micromark's protocol allowlist sanitization (which blocks s3://).
 */
export function resolveS3ImagesInContent(content: string): string {
  return content.replace(
    /!\[([^\]]*)\]\(s3:\/\/([^)]+)\)/g,
    (_, alt: string, key: string) =>
      `![${alt}](/api/s3-image?key=${encodeURIComponent(key)})`,
  )
}
