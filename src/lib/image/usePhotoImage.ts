import { useEffect, useState } from 'react'

/** Load photo at original resolution for Konva display */
export function usePhotoImage(dataUrl: string) {
  const [image, setImage] = useState<HTMLImageElement | null>(null)

  useEffect(() => {
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled) setImage(img)
    }
    img.onerror = () => {
      if (!cancelled) setImage(null)
    }
    img.src = dataUrl
    return () => {
      cancelled = true
    }
  }, [dataUrl])

  return image
}
