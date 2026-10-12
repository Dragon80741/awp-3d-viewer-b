import { useEffect, useState, useRef, useCallback } from 'react'
import {
  Viewer3D,
  ModelTreePanel,
  PropertyPane,
  createViewerStore,
  useViewerState,
  pathOf,
} from '@humkyung/viewer3d'
import type { TileSource, ViewerLogEvent } from '@humkyung/viewer3d'
import '@humkyung/viewer3d/style.css'
import { createFolderTileSource } from './folderTileSource'
import {
  isAwpInboundMessage,
  sendToParentPlatform,
  findItemsAndPiecesByTags,
} from './viewerBridge'

const store = createViewerStore()

export function App() {
  const [modelFolder, setModelFolder] = useState('/phu')
  const [source, setSource] = useState<TileSource | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [ao, setAo] = useState(false)
  const [shadow, setShadow] = useState(false)
  const [toast, setToast] = useState<{ message: string; level: string } | null>(null)
  const [isEmbedded, setIsEmbedded] = useState(false)
  const [showTreePanel, setShowTreePanel] = useState(true)
  const [showPropsPanel, setShowPropsPanel] = useState(true)
  const [isXray, setIsXray] = useState(false)

  const measureMode = useViewerState(store, (s) => s.measureMode)
  const clipOn = useViewerState(store, (s) => s.clipOn)
  const treeIndex = useViewerState(store, (s) => s.tree3d)
  const picked3d = useViewerState(store, (s) => s.picked3d)
  const picked3dItem = useViewerState(store, (s) => s.picked3dItem)

  const pendingTagsRef = useRef<{ tags: string[]; isolate?: boolean; focusCamera?: boolean } | null>(null)

  // 1. URL Query parameter handling (?model=..., ?tags=..., ?embed=true)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)
    const embedParam = params.get('embed')
    if (embedParam === 'true' || window.parent !== window) {
      setIsEmbedded(true)
    }

    const modelParam = params.get('model') || params.get('dataset')
    if (modelParam) {
      setModelFolder(modelParam.startsWith('/') ? modelParam : `/${modelParam}`)
    }

    const initialTags = params.get('tags') || params.get('tag')
    if (initialTags) {
      const tagList = initialTags.split(',').map((t) => t.trim()).filter(Boolean)
      if (tagList.length > 0) {
        pendingTagsRef.current = { tags: tagList, focusCamera: true, isolate: false }
      }
    }
  }, [])

  // 2. Load model tile source
  useEffect(() => {
    let cancelled = false
    setLoadError(null)
    createFolderTileSource(modelFolder)
      .then((src) => {
        if (!cancelled) {
          setSource(src)
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error(err)
          setLoadError(err.message || '모델을 불러오지 못했습니다.')
        }
      })
    return () => {
      cancelled = true
    }
  }, [modelFolder])

  const showToast = (message: string, level: string = 'info') => {
    setToast({ message, level })
    setTimeout(() => {
      setToast((prev) => (prev?.message === message ? null : prev))
    }, 4000)
  }

  const handleLog = (event: ViewerLogEvent, docId: string) => {
    console.log(`[Viewer3D ${docId}] [${event.level}]`, event.message, event.detail)
    if (event.level === 'warn' || event.level === 'error') {
      showToast(`${event.message}${event.detail ? ` (${event.detail})` : ''}`, event.level)
    }
  }

  // 3. Selection helper for given tags
  const applyTagsSelection = useCallback(
    (tags: string[], focusCamera = true, isolate = false) => {
      if (!treeIndex) return
      console.log('[AWP Bridge] Searching tags:', tags)
      const { items, pieces } = findItemsAndPiecesByTags(treeIndex, tags)

      if (pieces.length > 0) {
        const s = store.getState()
        s.requestPick3d(pieces, items[0] ?? null)
        if (isolate) {
          s.requestHide3d('isolate')
        }
        if (focusCamera) {
          s.requestFit3d(pieces)
        }
        showToast(`${tags.length}개 태그 (${pieces.length}개 부재) 선택됨`, 'info')
      } else {
        console.warn('[AWP Bridge] No matching pieces found for tags:', tags)
        showToast(`태그 [${tags.join(', ')}]에 해당하는 부재를 찾지 못했습니다.`, 'warn')
      }
    },
    [treeIndex],
  )

  // 4. When treeIndex is ready, send VIEWER_READY and apply any pending tags
  useEffect(() => {
    if (!treeIndex) return
    console.log('[AWP Bridge] Model tree ready, total items:', treeIndex.tree.name.length)
    sendToParentPlatform({
      type: 'VIEWER_READY',
      payload: {
        engine: 'viewer3d',
        dataset: modelFolder.replace(/^\/+/, ''),
      },
    })

    if (pendingTagsRef.current) {
      const { tags, focusCamera, isolate } = pendingTagsRef.current
      pendingTagsRef.current = null
      applyTagsSelection(tags, focusCamera, isolate)
    }
  }, [treeIndex, applyTagsSelection])

  // 5. Inbound postMessage listener (AWP Platform -> 3D Viewer)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data
      if (!isAwpInboundMessage(data)) return

      console.log('[AWP Bridge] Received message:', data)

      if ((data as any).type === 'CAPTURE_3D_SNAPSHOT' || (data as any).type === 'CAPTURE_3D_VIEW') {
        try {
          const canvas = document.querySelector('canvas')
          const image = canvas ? canvas.toDataURL('image/png') : null
          window.parent.postMessage({ type: '3D_SNAPSHOT_RESULT', image }, '*')
        } catch (err) {
          console.error('[Viewer] 캡처 실패:', err)
          window.parent.postMessage({ type: '3D_SNAPSHOT_RESULT', image: null }, '*')
        }
        return
      }

      if (data.type === 'AWP_SELECT_TAGS') {
        const tags = data.tags || []
        if (treeIndex) {
          applyTagsSelection(tags, data.focusCamera !== false, Boolean(data.isolate))
        } else {
          pendingTagsRef.current = {
            tags,
            focusCamera: data.focusCamera !== false,
            isolate: Boolean(data.isolate),
          }
        }
      } else if (data.type === 'AWP_CLEAR_SELECTION') {
        const s = store.getState()
        s.requestPick3d([])
        s.requestHide3d('showAll')
        setIsXray(false)
      }
    }

    window.addEventListener('message', handleMessage)
    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [treeIndex, applyTagsSelection])

  // 6. Outbound postMessage (3D Viewer -> AWP Platform) when user picks an object in 3D
  useEffect(() => {
    if (picked3d.length === 0) {
      sendToParentPlatform({
        type: 'VIEWER_OBJECT_SELECTED',
        payload: {
          oid: '',
          tag: null,
          objectName: null,
          systemPath: null,
        },
      })
      return
    }
    const pieceId = picked3d[0].id
    const item = picked3dItem
    const currentTree = store.getState().tree3d
    const name = item != null && currentTree?.tree.name[item] ? currentTree.tree.name[item] : null
    const systemPath = item != null && currentTree ? pathOf(currentTree.tree, item).join('\\') : null

    sendToParentPlatform({
      type: 'VIEWER_OBJECT_SELECTED',
      payload: {
        oid: String(pieceId),
        pickId: pieceId,
        tag: name,
        objectName: name,
        systemPath,
      },
    })
  }, [picked3d, picked3dItem])

  const toggleXray = useCallback(() => {
    const st = store.getState()
    if (isXray) {
      st.requestHide3d('restore')
      setIsXray(false)
      showToast('X-ray 모드 해제됨', 'info')
    } else {
      if (picked3d.length === 0) {
        showToast('X-ray를 적용할 부재를 먼저 선택해주세요.', 'warn')
        return
      }
      const ids = picked3d.map((p) => p.id)
      st.requestHide3d({
        kind: 'ghostOthers',
        ids,
        item: picked3dItem ?? undefined,
        xray: true,
      } as any)
      setIsXray(true)
      showToast(`${ids.length}개 부재 X-ray 투시 켜짐`, 'info')
    }
  }, [isXray, picked3d, picked3dItem])

  const s = () => store.getState()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', backgroundColor: '#18181b', color: '#f4f4f5' }}>
      {/* Top Header Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.4rem 0.8rem',
          backgroundColor: '#27272a',
          borderBottom: '1px solid #3f3f46',
          flexShrink: 0,
          gap: '0.6rem',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <strong style={{ fontSize: '0.95rem', color: '#38bdf8' }}>3D Viewer</strong>
          {!isEmbedded && (
            <span style={{ fontSize: '0.75rem', color: '#a1a1aa' }}>
              {modelFolder === '/phu'
                ? 'GS Model PHU_Area_E3D (13 타일 / 30만 부재)'
                : modelFolder === '/phu_all'
                ? 'GS Model PHU_Area_ALL (15 타일 / 83만 부재)'
                : 'AMIRAL_NWX_TILES (136 타일 / 1.67억 삼각형)'}
            </span>
          )}
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => s().requestFitAll()}
            style={btnStyle(false)}
            title="전체 맞춤"
          >
            전체 맞춤
          </button>

          <div style={dividerStyle} />

          <button
            onClick={() => s().requestPreset('iso')}
            style={btnStyle(false)}
            title="ISO 뷰"
          >
            ISO
          </button>
          <button
            onClick={() => s().requestPreset('top')}
            style={btnStyle(false)}
            title="평면 뷰"
          >
            Top
          </button>
          <button
            onClick={() => s().requestPreset('front')}
            style={btnStyle(false)}
            title="정면 뷰"
          >
            Front
          </button>
          <button
            onClick={() => s().requestPreset('right')}
            style={btnStyle(false)}
            title="측면 뷰"
          >
            Right
          </button>

          <div style={dividerStyle} />

          <button
            onClick={() => s().setMeasureMode(measureMode === 'dist' ? 'none' : 'dist')}
            style={btnStyle(measureMode === 'dist')}
            title="거리 측정"
          >
            거리
          </button>
          <button
            onClick={() => s().setMeasureMode(measureMode === 'angle' ? 'none' : 'angle')}
            style={btnStyle(measureMode === 'angle')}
            title="각도 측정"
          >
            각도
          </button>
          <button
            onClick={() => s().setClipOn(!clipOn)}
            style={btnStyle(clipOn)}
            title="단면 상자"
          >
            단면
          </button>

          <div style={dividerStyle} />

          <button
            onClick={() => s().requestHide3d('isolate')}
            style={btnStyle(false)}
            title="선택한 부재만 표시"
          >
            격리
          </button>
          <button
            onClick={() => s().requestHide3d('hide')}
            style={btnStyle(false)}
            title="선택한 부재 숨기기"
          >
            숨기기
          </button>
          <button
            onClick={toggleXray}
            style={btnStyle(isXray)}
            title="선택 부재 외 주변을 반투명하게 투시"
          >
            X-ray {isXray ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => {
              s().requestHide3d('showAll')
              setIsXray(false)
            }}
            style={btnStyle(false)}
            title="모든 부재 표시"
          >
            전체 표시
          </button>

          <div style={dividerStyle} />

          <button
            onClick={() => setAo((v) => !v)}
            style={btnStyle(ao)}
            title="주변광 차폐 (AO)"
          >
            AO {ao ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShadow((v) => !v)}
            style={btnStyle(shadow)}
            title="그림자 토글"
          >
            그림자 {shadow ? 'ON' : 'OFF'}
          </button>

          <div style={dividerStyle} />

          <button
            onClick={() => setShowTreePanel((v) => !v)}
            style={btnStyle(showTreePanel)}
            title="좌측 모델 트리 패널 토글"
          >
            트리 {showTreePanel ? 'ON' : 'OFF'}
          </button>
          <button
            onClick={() => setShowPropsPanel((v) => !v)}
            style={btnStyle(showPropsPanel)}
            title="우측 속성 정보 패널 토글"
          >
            속성 {showPropsPanel ? 'ON' : 'OFF'}
          </button>
        </div>
      </header>

      {/* Main Viewport: Left Tree + Center 3D + Right Properties */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0, position: 'relative' }}>
        {/* Toast Alert */}
        {toast && (
          <div
            style={{
              position: 'absolute',
              top: '1rem',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 9999,
              backgroundColor: toast.level === 'error' ? '#ef4444' : toast.level === 'warn' ? '#f59e0b' : '#0284c7',
              color: '#fff',
              padding: '0.4rem 0.8rem',
              borderRadius: '0.375rem',
              boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
              fontSize: '0.8rem',
            }}
          >
            {toast.message}
          </div>
        )}

        {/* Left Panel: Model Tree (노드 목록) */}
        {showTreePanel && (
          <aside
            style={{
              width: 320,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1f2937',
              borderRight: '1px solid #374151',
              height: '100%',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#9ca3af',
                backgroundColor: '#111827',
                borderBottom: '1px solid #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>모델 트리 (노드)</span>
              {treeIndex ? (
                <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
                  {treeIndex.tree.name.length.toLocaleString()} 항목
                </span>
              ) : (
                <span style={{ fontSize: '0.7rem', color: '#f59e0b' }}>로딩 중...</span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', position: 'relative' }}>
              {!treeIndex ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    gap: '0.75rem',
                    color: '#a1a1aa',
                    fontSize: '0.8rem',
                    padding: '1.5rem',
                    textAlign: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      border: '3px solid #374151',
                      borderTopColor: '#38bdf8',
                      borderRadius: '50%',
                      animation: 'spin 1s linear infinite',
                    }}
                  />
                  <div>모델 트리 로드 중…</div>
                  <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                    대용량 계층 정보(트리 색인)를 로드하고 있습니다
                  </div>
                </div>
              ) : (
                <ModelTreePanel store={store} />
              )}
            </div>
          </aside>
        )}

        {/* Center: 3D Canvas Area */}
        <div style={{ flex: 1, minWidth: 0, height: '100%', position: 'relative', backgroundColor: '#09090b' }}>
          {loadError ? (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#f87171' }}>
              <div>{loadError}</div>
            </div>
          ) : source ? (
            <Viewer3D
              documentId={modelFolder.replace(/^\/+/, '')}
              source={source}
              store={store}
              onLog={handleLog}
              partPick={true}
              ao={ao}
              shadow={shadow}
            />
          ) : (
            <div style={{ display: 'grid', placeItems: 'center', height: '100%', color: '#a1a1aa' }}>
              <div>모델 불러오는 중...</div>
            </div>
          )}
        </div>

        {/* Right Panel: Property Pane (속성 정보) */}
        {showPropsPanel && (
          <aside
            style={{
              width: 340,
              display: 'flex',
              flexDirection: 'column',
              backgroundColor: '#1f2937',
              borderLeft: '1px solid #374151',
              height: '100%',
              flexShrink: 0,
            }}
          >
            <div
              style={{
                padding: '0.4rem 0.6rem',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#9ca3af',
                backgroundColor: '#111827',
                borderBottom: '1px solid #374151',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <span>속성 정보</span>
              {picked3d.length > 0 && (
                <span style={{ fontSize: '0.7rem', color: '#38bdf8' }}>
                  {picked3d.length}개 선택
                </span>
              )}
            </div>
            <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
              <PropertyPane store={store} fetch={source?.fetch} />
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}

function btnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '0.25rem 0.5rem',
    borderRadius: '0.25rem',
    border: '1px solid ' + (active ? '#0284c7' : '#52525b'),
    backgroundColor: active ? '#0284c7' : '#3f3f46',
    color: '#ffffff',
    fontSize: '0.75rem',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  }
}

const dividerStyle: React.CSSProperties = {
  width: '1px',
  height: '1rem',
  backgroundColor: '#52525b',
  margin: '0 0.15rem',
}
