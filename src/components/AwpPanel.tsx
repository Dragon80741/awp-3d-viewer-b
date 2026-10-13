import React, { useState, useMemo } from 'react'
import {
  getAwpCwpGroups,
  findAwpItemByNode,
  AwpCwpGroup,
  AwpIwpGroup,
  AwpLineItem,
} from '../data/awpData'

export interface AwpPanelProps {
  onSelectLine: (lineItem: AwpLineItem, isolate?: boolean) => void
  onSelectIwp?: (iwp: AwpIwpGroup, isolate?: boolean) => void
  onSelectCwp?: (cwp: AwpCwpGroup, isolate?: boolean) => void
  pickedItemName?: string | null
}

export const AwpPanel: React.FC<AwpPanelProps> = ({
  onSelectLine,
  onSelectIwp,
  onSelectCwp,
  pickedItemName,
}) => {
  // Search query
  const [searchTerm, setSearchTerm] = useState('')

  // Expanded CWP IDs
  const [expandedCwps, setExpandedCwps] = useState<Set<string>>(
    () => new Set(['K030-0500-L022-C0404']),
  )

  // Expanded IWP IDs
  const [expandedIwps, setExpandedIwps] = useState<Set<string>>(
    () => new Set(['K030-0500-L022-C0404-0010']),
  )

  // All CWP groups
  const cwpGroups = useMemo(() => getAwpCwpGroups(), [])

  // Matched AWP Item from 3D Pick
  const matchedPickItem = useMemo(() => {
    return findAwpItemByNode(pickedItemName)
  }, [pickedItemName])

  // Filtered groups based on search term
  const filteredGroups = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return cwpGroups

    return cwpGroups
      .map((cwp) => {
        const cwpMatches = cwp.cwpNo.toLowerCase().includes(term)

        const matchedIwps = cwp.iwps
          .map((iwp) => {
            const iwpMatches =
              iwp.iwpNo.toLowerCase().includes(term) ||
              iwp.iwpName.toLowerCase().includes(term)

            const matchedLines = iwp.lines.filter(
              (line) =>
                line.lineName.toLowerCase().includes(term) ||
                line.isoNo.toLowerCase().includes(term) ||
                line.reactor.toLowerCase().includes(term) ||
                line.basis.toLowerCase().includes(term) ||
                line.zone.toLowerCase().includes(term),
            )

            if (cwpMatches || iwpMatches) {
              return iwp
            }

            if (matchedLines.length > 0) {
              return {
                ...iwp,
                lines: matchedLines,
              }
            }

            return null
          })
          .filter(Boolean) as AwpIwpGroup[]

        if (cwpMatches) {
          return cwp
        }

        if (matchedIwps.length > 0) {
          const totalLines = matchedIwps.reduce((acc, cur) => acc + cur.lines.length, 0)
          return {
            ...cwp,
            iwps: matchedIwps,
            totalLines,
          }
        }

        return null
      })
      .filter(Boolean) as AwpCwpGroup[]
  }, [cwpGroups, searchTerm])

  const toggleCwp = (cwpNo: string) => {
    setExpandedCwps((prev) => {
      const next = new Set(prev)
      if (next.has(cwpNo)) {
        next.delete(cwpNo)
      } else {
        next.add(cwpNo)
      }
      return next
    })
  }

  const toggleIwp = (iwpNo: string) => {
    setExpandedIwps((prev) => {
      const next = new Set(prev)
      if (next.has(iwpNo)) {
        next.delete(iwpNo)
      } else {
        next.add(iwpNo)
      }
      return next
    })
  }

  const expandAll = () => {
    setExpandedCwps(new Set(cwpGroups.map((c) => c.cwpNo)))
    setExpandedIwps(new Set(cwpGroups.flatMap((c) => c.iwps.map((i) => i.iwpNo))))
  }

  const collapseAll = () => {
    setExpandedCwps(new Set())
    setExpandedIwps(new Set())
  }

  return (
    <div className="v3d-side v3d-tree" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Header Toolbar & Search (노드 트리 검색창 스타일 일치) */}
      <div className="v3d-side-bar v3d-side-bar--dense">
        <div className="v3d-search">
          <input
            type="text"
            className="v3d-search-input"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="CWP, IWP, 배관 검색..."
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                padding: '0 6px',
                fontSize: '11px',
              }}
            >
              초기화
            </button>
          )}
        </div>
        <button type="button" className="v3d-mini-btn" onClick={expandAll} title="모두 펼치기">
          펼치기
        </button>
        <button type="button" className="v3d-mini-btn" onClick={collapseAll} title="모두 접기">
          접기
        </button>
      </div>

      {/* 2. Matched 3D Selection Summary (단정하고 일관된 정보 스타일) */}
      {matchedPickItem && (
        <div
          style={{
            padding: '6px 8px',
            borderBottom: '1px solid #374151',
            backgroundColor: '#18202f',
            fontSize: '11px',
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3px' }}>
            <span style={{ fontWeight: 600, color: '#e5e7eb' }}>선택 부재 AWP 매핑</span>
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                type="button"
                className="v3d-mini-btn"
                onClick={() => onSelectLine(matchedPickItem, false)}
              >
                포커스
              </button>
              <button
                type="button"
                className="v3d-mini-btn"
                onClick={() => onSelectLine(matchedPickItem, true)}
              >
                격리
              </button>
            </div>
          </div>
          <div style={{ color: '#38bdf8', fontWeight: 600, wordBreak: 'break-all' }}>
            {matchedPickItem.lineName}
          </div>
          <div style={{ color: '#9ca3af', fontSize: '11px', marginTop: '2px' }}>
            <div>CWP: {matchedPickItem.cwpNo}</div>
            <div>IWP: {matchedPickItem.iwpNo}</div>
            <div style={{ color: '#cbd5e1' }}>{matchedPickItem.iwpName}</div>
            <div>
              구분: {matchedPickItem.basis}
              {matchedPickItem.reactor ? ` | Reactor: ${matchedPickItem.reactor}` : ''}
            </div>
          </div>
        </div>
      )}

      {/* 3. CWP -> IWP -> Line Tree View (노드 트리 구조와 100% 동일한 그리드/트리 스타일) */}
      <div className="v3d-tree-list" role="tree" style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {filteredGroups.length === 0 ? (
          <p className="v3d-side-note">일치하는 항목이 없습니다.</p>
        ) : (
          filteredGroups.map((cwp) => {
            const isCwpExpanded = expandedCwps.has(cwp.cwpNo)
            return (
              <div key={cwp.cwpNo}>
                {/* Level 0: CWP Row */}
                <div
                  className="v3d-tree-row"
                  style={{
                    paddingLeft: '4px',
                    height: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                  }}
                  onClick={() => toggleCwp(cwp.cwpNo)}
                >
                  <button
                    type="button"
                    className="v3d-tree-toggle"
                    onClick={(e) => {
                      e.stopPropagation()
                      toggleCwp(cwp.cwpNo)
                    }}
                    aria-label={cwp.cwpNo}
                  >
                    <span className={'v3d-tree-box' + (isCwpExpanded ? '' : ' v3d-tree-box--closed')} />
                  </button>

                  <span
                    className="v3d-tree-label"
                    style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '11px' }}
                    title={cwp.cwpNo}
                  >
                    CWP {cwp.cwpNo}
                  </span>

                  <span
                    style={{
                      marginLeft: 'auto',
                      fontSize: '11px',
                      color: '#9ca3af',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      paddingRight: '6px',
                      flexShrink: 0,
                    }}
                  >
                    <span>{cwp.totalLines}개</span>
                    {onSelectCwp && (
                      <button
                        type="button"
                        className="v3d-mini-btn"
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectCwp(cwp, false)
                        }}
                        title="CWP 부재 전체 3D 선택"
                      >
                        3D
                      </button>
                    )}
                  </span>
                </div>

                {/* Level 1: IWP Rows */}
                {isCwpExpanded &&
                  cwp.iwps.map((iwp) => {
                    const isIwpExpanded = expandedIwps.has(iwp.iwpNo)
                    return (
                      <div key={iwp.iwpNo}>
                        <div
                          className="v3d-tree-row"
                          style={{
                            paddingLeft: '18px',
                            minHeight: '26px',
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                          }}
                          onClick={() => toggleIwp(iwp.iwpNo)}
                        >
                          <button
                            type="button"
                            className="v3d-tree-toggle"
                            onClick={(e) => {
                              e.stopPropagation()
                              toggleIwp(iwp.iwpNo)
                            }}
                            aria-label={iwp.iwpNo}
                          >
                            <span className={'v3d-tree-box' + (isIwpExpanded ? '' : ' v3d-tree-box--closed')} />
                          </button>

                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              className="v3d-tree-label"
                              style={{ fontWeight: 500, color: '#e5e7eb', fontSize: '11px' }}
                              title={iwp.iwpNo}
                            >
                              IWP {iwp.iwpNo}
                            </div>
                            <div
                              style={{
                                fontSize: '10px',
                                color: '#9ca3af',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              title={iwp.iwpName}
                            >
                              {iwp.iwpName}
                            </div>
                          </div>

                          <span
                            style={{
                              marginLeft: 'auto',
                              fontSize: '11px',
                              color: '#9ca3af',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              paddingRight: '6px',
                              flexShrink: 0,
                            }}
                          >
                            <span>{iwp.lines.length}개</span>
                            {onSelectIwp && (
                              <button
                                type="button"
                                className="v3d-mini-btn"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectIwp(iwp, false)
                                }}
                                title="IWP 배관 전체 3D 선택"
                              >
                                3D
                              </button>
                            )}
                          </span>
                        </div>

                        {/* Level 2: Piping Lines */}
                        {isIwpExpanded &&
                          iwp.lines.map((line, idx) => {
                            const isCurrentPicked =
                              matchedPickItem?.lineName === line.lineName ||
                              (pickedItemName &&
                                pickedItemName.includes(line.lineName.replace(/^\/+/, '')))

                            return (
                              <div
                                key={line.lineName + idx}
                                className={
                                  'v3d-tree-row' + (isCurrentPicked ? ' v3d-tree-row--on' : '')
                                }
                                style={{
                                  paddingLeft: '32px',
                                  height: '22px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  cursor: 'pointer',
                                  paddingRight: '6px',
                                }}
                                onClick={() => onSelectLine(line, false)}
                                title={`${line.lineName} (${line.basis}${line.reactor ? `, ${line.reactor}` : ''})`}
                              >
                                <span className="v3d-tree-toggle" />

                                <span
                                  className="v3d-tree-label"
                                  style={{
                                    fontSize: '11px',
                                    color: isCurrentPicked ? '#ffffff' : '#d1d5db',
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {line.lineName}
                                </span>

                                <span
                                  style={{
                                    fontSize: '10px',
                                    color: '#9ca3af',
                                    marginLeft: 'auto',
                                    flexShrink: 0,
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {line.basis}
                                  {line.reactor ? ` | ${line.reactor}` : ''}
                                </span>
                              </div>
                            )
                          })}
                      </div>
                    )
                  })}
              </div>
            )
          })
        )}
      </div>

      {/* 4. Footer Summary (노드 패널 하단 바 스타일) */}
      <div
        className="v3d-side-bar v3d-side-bar--dense v3d-side-bar--top"
        style={{
          color: '#9ca3af',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: '11px',
        }}
      >
        <span>총 {cwpGroups.length}개 CWP</span>
        <span>
          {cwpGroups.reduce((acc, c) => acc + c.totalLines, 0)}개 배관 라인
        </span>
      </div>
    </div>
  )
}
