/** Converts s3://key to the browser-accessible proxy URL */
export function resolveS3ImageSrc(src: string | undefined): string | undefined {
  if (!src) return src
  if (src.startsWith("s3://")) {
    return `/api/s3-image?key=${encodeURIComponent(src.slice(5))}`
  }
  return src
}
