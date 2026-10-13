import React, { useMemo, useState, useRef } from 'react'
import {
  useViewerState,
  pathOf,
  propsOf,
  itemTabOf,
  itemOfPiece,
  commonAncestor,
  PROP_NAME_DEFAULT,
  PROP_NAME_MIN,
  PROP_NAME_MAX,
} from '@humkyung/viewer3d'
import type { ViewerStore } from '@humkyung/viewer3d'
import { findAwpItemByNode } from '../data/awpData'

export interface AwpPropertyPaneProps {
  store: ViewerStore
  fetch?: (url: string, init?: RequestInit) => Promise<Response>
  className?: string
}

export function AwpPropertyPane({ store, className }: AwpPropertyPaneProps) {
  const picked3d = useViewerState(store, (s) => s.picked3d)
  const picked3dItem = useViewerState(store, (s) => s.picked3dItem)
  const treeIndex = useViewerState(store, (s) => s.tree3d)

  const [activeTab, setActiveTab] = useState<string | null>(null)
  const [nameWidth, setNameWidth] = useState(PROP_NAME_DEFAULT)

  // Resizing logic for property name column width
  const isDraggingRef = useRef(false)
  const dragStartXRef = useRef(0)
  const dragStartWidthRef = useRef(PROP_NAME_DEFAULT)

  const handlePointerDown = (e: React.PointerEvent) => {
    e.preventDefault()
    isDraggingRef.current = true
    dragStartXRef.current = e.clientX
    dragStartWidthRef.current = nameWidth

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return
      const delta = ev.clientX - dragStartXRef.current
      const nextWidth = Math.max(
        PROP_NAME_MIN,
        Math.min(PROP_NAME_MAX, dragStartWidthRef.current + delta),
      )
      setNameWidth(nextWidth)
    }

    const handlePointerUp = () => {
      isDraggingRef.current = false
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)
  }

  // 1. Resolve target item in tree
  const targetItem = useMemo(() => {
    if (!picked3d.length || !treeIndex) return null
    if (picked3dItem != null) return picked3dItem

    const pieceMap = itemOfPiece(treeIndex)
    const itemIds: number[] = []
    for (const p of picked3d) {
      const it = pieceMap.get(p.id)
      if (it != null) itemIds.push(it)
    }
    return commonAncestor(treeIndex.tree, itemIds)
  }, [picked3d, picked3dItem, treeIndex])

  // 2. Resolve Path breadcrumb
  const path = useMemo(() => {
    if (!treeIndex || targetItem == null) return []
    return pathOf(treeIndex.tree, targetItem)
  }, [treeIndex, targetItem])

  // 3. Resolve item name & AWP mapping
  const matchedAwp = useMemo(() => {
    if (!treeIndex || targetItem == null) return null
    const name = treeIndex.tree.name[targetItem]
    const pathStr = path.join('/')
    let match = findAwpItemByNode(name) || findAwpItemByNode(pathStr)
    if (!match) {
      const itemProps = itemTabOf(treeIndex.tree, targetItem, {
        name: '이름',
        kind: '유형',
        layer: '도면층',
        source: '소스 파일',
        icon: '아이콘',
        iconComposite: '복합 객체',
        material: '재질',
      })
      for (const [, val] of itemProps) {
        match = findAwpItemByNode(val)
        if (match) break
      }
    }
    return match
  }, [treeIndex, targetItem, path])

  // 4. Group all properties by tab/category: [category, [name, value][]]
  const tabGroups = useMemo(() => {
    if (!treeIndex || targetItem == null) return []

    // 4-1. Standard "항목" tab
    const itemProps = itemTabOf(treeIndex.tree, targetItem, {
      name: '이름',
      kind: '유형',
      layer: '도면층',
      source: '소스 파일',
      icon: '아이콘',
      iconComposite: '복합 객체',
      material: '재질',
    })

    // 4-2. Other model property categories (e.g. "AVEVA", etc.)
    const otherProps = propsOf(treeIndex.tree, targetItem)

    const groupsMap = new Map<string, [string, string][]>()

    if (itemProps && itemProps.length > 0) {
      groupsMap.set('항목', [...itemProps])
    }

    for (const [cat, name, val] of otherProps) {
      const c = cat || '속성'
      if (!groupsMap.has(c)) {
        groupsMap.set(c, [])
      }
      groupsMap.get(c)!.push([name, val])
    }

    // 4-3. AWP Tab: CWP / IWP 두 줄 (사용자 요구사항)
    const awpList: [string, string][] = [
      ['CWP', matchedAwp ? matchedAwp.cwpNo : '-'],
      ['IWP', matchedAwp ? matchedAwp.iwpNo : '-'],
    ]
    groupsMap.set('AWP', awpList)

    const result: Array<{ category: string; count: number; props: [string, string][] }> = []
    for (const [category, props] of groupsMap.entries()) {
      result.push({
        category,
        count: props.length,
        props,
      })
    }
    return result
  }, [treeIndex, targetItem, matchedAwp])

  // Determine current active tab
  const currentActiveTab = useMemo(() => {
    if (tabGroups.length === 0) return null
    if (activeTab && tabGroups.some((g) => g.category === activeTab)) {
      return activeTab
    }
    return tabGroups[0].category
  }, [tabGroups, activeTab])

  const activeGroup = useMemo(() => {
    return tabGroups.find((g) => g.category === currentActiveTab) || tabGroups[0] || null
  }, [tabGroups, currentActiveTab])

  if (!picked3d.length) {
    return (
      <div className={`v3d-side v3d-props ${className || ''}`} style={{ height: '100%' }}>
        <p className="v3d-side-note">아무것도 고르지 않았습니다</p>
      </div>
    )
  }

  return (
    <div
      className={`v3d-side v3d-props ${className || ''}`}
      style={{
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div className="v3d-props-body" style={{ flex: 1, overflowY: 'auto' }}>
        {/* 선택 부재 개수 */}
        <p className="v3d-side-dim v3d-props-line">{picked3d.length}개 선택</p>

        {/* 경로 표시 */}
        {picked3d.length === 1 && path.length > 0 && (
          <div className="v3d-props-path">
            <span className="v3d-side-dim">경로</span>
            <p className="v3d-props-path-text v3d-select" title={path.join(' / ')}>
              {path.map((segment, idx) => (
                <span key={idx}>
                  {idx > 0 && <span className="v3d-props-sep">›</span>}
                  <span className={idx === path.length - 1 ? 'v3d-strong' : undefined}>
                    {segment}
                  </span>
                </span>
              ))}
            </p>
          </div>
        )}

        {/* 속성 탭 (항목, AVEVA, AWP ...) */}
        {tabGroups.length > 0 && (
          <div className="v3d-props-tabs-wrap">
            <div className="v3d-props-tabs" role="tablist">
              {tabGroups.map((tab) => {
                const isActive = tab.category === currentActiveTab
                return (
                  <button
                    key={tab.category}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={'v3d-props-tab' + (isActive ? ' v3d-props-tab--on' : '')}
                    onClick={() => setActiveTab(tab.category)}
                  >
                    {tab.category}
                    <span className="v3d-props-tab-n">{tab.count}</span>
                  </button>
                )
              })}
            </div>

            {/* 선택된 탭의 속성 표 */}
            {activeGroup && (
              <div className="v3d-props-table">
                {/* 열 폭 조절기 */}
                <div
                  role="separator"
                  tabIndex={0}
                  className="v3d-props-resizer"
                  style={{ left: nameWidth }}
                  onPointerDown={handlePointerDown}
                  onDoubleClick={() => setNameWidth(PROP_NAME_DEFAULT)}
                >
                  <span className="v3d-props-resizer-line" />
                </div>

                {/* 속성 행들 */}
                {activeGroup.props.map(([name, value], idx) => (
                  <div key={name + idx} className="v3d-props-row">
                    <div
                      className="v3d-props-name v3d-ellipsis"
                      style={{ width: nameWidth }}
                      title={name}
                    >
                      {name}
                    </div>
                    <div className="v3d-props-value v3d-select" title={value}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
