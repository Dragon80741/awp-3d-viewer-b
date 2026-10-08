import React, { useRef, useEffect, useCallback } from 'react'
import { Box } from '@mui/material'

export interface Awp3dViewerProps {
  /** 3D 뷰어 서버 URL (예: 'http://awp-dev:3104' 또는 환경변수) */
  viewerUrl?: string
  /** 모델 식별자 (기본값: 'amiral') */
  dataset?: string
  /** 워크패키지에 매핑된 태그 목록 (예: ['310-FM-0003']) */
  selectedTags?: string[]
  /** 선택 외 나머지 부재 숨김/격리 여부 */
  isolate?: boolean
  /** 3D 부재 클릭 시 AWP 플랫폼으로 전달되는 콜백 */
  onObjectSelected?: (data: {
    oid: string
    pickId?: number
    tag?: string | null
    objectName?: string | null
    systemPath?: string | null
  }) => void
}

/**
 * AWP Platform 3D Viewer IFrame Adapter Component
 *
 * AWP 프로젝트(awp_front)의 src/components/common/Awp3dViewer.tsx에 배치하여 사용합니다.
 */
export const Awp3dViewer: React.FC<Awp3dViewerProps> = ({
  viewerUrl = process.env.NEXT_PUBLIC_VIEWER_URL || 'http://localhost:3104',
  dataset = 'amiral',
  selectedTags = [],
  isolate = false,
  onObjectSelected,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null)

  // 1. AWP -> 3D 뷰어로 태그 선택 메시지 전송
  useEffect(() => {
    if (!iframeRef.current?.contentWindow) return

    if (selectedTags.length > 0) {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'AWP_SELECT_TAGS',
          tags: selectedTags,
          isolate,
          focusCamera: true,
        },
        '*',
      )
    } else {
      iframeRef.current.contentWindow.postMessage(
        {
          type: 'AWP_CLEAR_SELECTION',
        },
        '*',
      )
    }
  }, [selectedTags, isolate])

  // 2. 3D 뷰어 -> AWP 객체 클릭 이벤트 수신 (역방향 연동)
  const handleMessage = useCallback(
    (event: MessageEvent) => {
      const data = event.data
      if (data?.type === 'VIEWER_OBJECT_SELECTED' && onObjectSelected) {
        onObjectSelected(data.payload)
      }
    },
    [onObjectSelected],
  )

  useEffect(() => {
    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [handleMessage])

  const srcUrl = `${viewerUrl.replace(/\/+$/, '')}/?dataset=${encodeURIComponent(dataset)}&embed=true`

  return (
    <Box className="w-full h-full relative overflow-hidden bg-slate-900 rounded-lg shadow-inner">
      <iframe
        ref={iframeRef}
        src={srcUrl}
        className="w-full h-full border-none"
        title="3D Model Viewer"
        allow="fullscreen"
      />
    </Box>
  )
}
