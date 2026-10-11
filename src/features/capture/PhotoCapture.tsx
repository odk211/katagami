import { useRef } from 'react'
import { db } from '../../db'
import { useProjectStore } from '../../store/projectStore'
import type { Photo } from '../../types'
import { getImageDimensions, readFileAsDataUrl } from '../../lib/image/loadImage'
import { Button } from '../../components/ui/Button'
import { PhotoGuide } from '../../components/PhotoGuide'

type Props = {
  projectId: string
  onPhotoAdded: () => void
}

export function PhotoCapture({ projectId, onPhotoAdded }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const addPhoto = useProjectStore((s) => s.addPhoto)

  async function handleFile(file: File) {
    const imageDataUrl = await readFileAsDataUrl(file)
    const { width, height } = await getImageDimensions(imageDataUrl)

    const photo: Photo = {
      id: crypto.randomUUID(),
      projectId,
      imageDataUrl,
      width,
      height,
      calibration: null,
      createdAt: Date.now(),
    }

    await db.photos.add(photo)
    addPhoto(photo)
    onPhotoAdded()
  }

  return (
    <div>
      <PhotoGuide />

      <div className="space-y-3">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) handleFile(file)
            e.target.value = ''
          }}
        />

        <Button fullWidth onClick={() => cameraRef.current?.click()}>
          カメラで撮影
        </Button>
        <Button fullWidth variant="secondary" onClick={() => fileRef.current?.click()}>
          写真を選択
        </Button>
      </div>
    </div>
  )
}
