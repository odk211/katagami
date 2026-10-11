import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { db, getPatternProjectWithDetails } from '../db'
import { useProjectStore } from '../store/projectStore'
import type { PatternStep } from '../types'
import { PatternStepIndicator } from '../components/PatternStepIndicator'
import { PhotoCapture } from '../features/capture/PhotoCapture'
import { CalibrationCanvas } from '../features/calibration/CalibrationCanvas'
import { TraceCanvas } from '../features/trace/TraceCanvas'
import { Button } from '../components/ui/Button'
import { Card } from '../components/ui/Card'
import { EditableProjectName } from '../components/EditableProjectName'

export function PatternProjectPage() {
  const { projectId } = useParams<{ projectId: string }>()
  const navigate = useNavigate()
  const [step, setStep] = useState<PatternStep>('photos')
  const [loading, setLoading] = useState(true)
  const [redoCalibration, setRedoCalibration] = useState(false)

  const {
    project,
    photos,
    pieces,
    activePhotoId,
    setProject,
    setPhotos,
    setPieces,
    setActivePhotoId,
    reset,
  } = useProjectStore()

  useEffect(() => {
    if (!projectId) return
    reset()
    getPatternProjectWithDetails(projectId).then((data) => {
      if (!data) {
        navigate('/')
        return
      }
      setProject(data.project)
      setPhotos(data.photos)
      setPieces(data.pieces)
      if (data.photos.length > 0) {
        setActivePhotoId(data.photos[data.photos.length - 1].id)
      }
      setLoading(false)
    })
  }, [projectId, navigate, reset, setProject, setPhotos, setPieces, setActivePhotoId])

  if (loading || !project || project.kind !== 'pattern' || !projectId) {
    return <p className="text-center text-sm text-gray-500 py-8">読み込み中…</p>
  }

  const activePhoto = photos.find((p) => p.id === activePhotoId) ?? photos[0]
  const hasPieces = pieces.length > 0

  function goTo(next: PatternStep) {
    if (next !== 'calibration') setRedoCalibration(false)
    setStep(next)
  }

  function startRecalibration() {
    setRedoCalibration(true)
  }

  return (
    <div>
      <EditableProjectName
        prefix="型紙"
        name={project.name}
        onSave={async (name) => {
          useProjectStore.getState().updateProject({ name })
          await db.projects.update(projectId, { name, updatedAt: Date.now() })
        }}
      />

      <PatternStepIndicator current={step} onNavigate={goTo} />

      {step === 'photos' && (
        <div>
          <PhotoCapture
            projectId={projectId}
            onPhotoAdded={() => goTo('calibration')}
          />
          {photos.length > 0 && (
            <Card className="mt-6">
              <p className="text-sm font-medium mb-2">登録済み写真 ({photos.length})</p>
              <div className="flex gap-2 overflow-x-auto pb-2">
                {photos.map((photo) => (
                  <button
                    key={photo.id}
                    onClick={() => {
                      setActivePhotoId(photo.id)
                      goTo(photo.calibration ? 'trace' : 'calibration')
                    }}
                    className="shrink-0"
                  >
                    <img
                      src={photo.imageDataUrl}
                      alt="型紙"
                      className="h-20 w-20 rounded object-cover border-2 border-gray-200"
                    />
                    <p className="text-xs text-center mt-1 text-gray-500">
                      {photo.calibration ? '校正済' : '未校正'}
                    </p>
                  </button>
                ))}
              </div>
              <Button fullWidth variant="secondary" className="mt-3" onClick={() => goTo('calibration')}>
                次へ: 校正
              </Button>
            </Card>
          )}
        </div>
      )}

      {step === 'calibration' && (
        <div>
          {!activePhoto ? (
            <p className="text-sm text-gray-500">まず写真を追加してください。</p>
          ) : activePhoto.calibration && !redoCalibration ? (
            <Card>
              <p className="text-sm text-green-700 mb-3">この写真は校正済みです。</p>
              <div className="space-y-2">
                <Button fullWidth onClick={() => goTo('trace')}>
                  次へ: トレース
                </Button>
                <Button fullWidth variant="ghost" onClick={startRecalibration}>
                  校正をやり直す
                </Button>
              </div>
            </Card>
          ) : (
            <CalibrationCanvas
              key={`${activePhoto.id}${redoCalibration ? '-redo' : ''}`}
              photo={activePhoto}
              initialCalibration={redoCalibration ? activePhoto.calibration : null}
              isRedo={redoCalibration}
              onComplete={() => {
                setRedoCalibration(false)
                goTo('trace')
              }}
              onCancel={redoCalibration ? () => setRedoCalibration(false) : undefined}
            />
          )}
          {photos.length > 1 && (
            <div className="mt-4 flex gap-2 overflow-x-auto">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  onClick={() => {
                    setActivePhotoId(photo.id)
                    setRedoCalibration(false)
                  }}
                >
                  <img
                    src={photo.imageDataUrl}
                    className={`h-14 w-14 rounded object-cover ${activePhotoId === photo.id ? 'ring-2 ring-primary' : ''}`}
                    alt=""
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {step === 'trace' && (
        <div>
          {!activePhoto?.calibration ? (
            <p className="text-sm text-gray-500">先に校正を完了してください。</p>
          ) : (
            <>
              <TraceCanvas
                photo={activePhoto}
                existingPieces={pieces}
                onPieceAdded={() => {}}
              />
              <div className="mt-4 space-y-2">
                <Button fullWidth variant="secondary" onClick={() => goTo('photos')}>
                  別の写真を追加
                </Button>
                {hasPieces && (
                  <p className="text-center text-sm text-green-700">
                    パーツ {pieces.length} 件登録済み。配置は配置プロジェクトから行えます。
                  </p>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
