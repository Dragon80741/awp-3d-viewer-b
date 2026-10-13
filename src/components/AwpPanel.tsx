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

  // Expanded CWP IDs (Set of cwpNo)
  const [expandedCwps, setExpandedCwps] = useState<Set<string>>(() => new Set(['K030-0500-L022-C0404']))

  // Expanded IWP IDs (Set of iwpNo)
  const [expandedIwps, setExpandedIwps] = useState<Set<string>>(() => new Set(['K030-0500-L022-C0404-0010']))

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
                line.zone.toLowerCase().includes(term)
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

  // Helper for basis badge color
  const getBasisBadgeStyle = (basis: string): React.CSSProperties => {
    if (basis.includes('직접')) {
      return {
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        color: '#34d399',
        border: '1px solid rgba(16, 185, 129, 0.3)',
      }
    }
    if (basis.includes('1단계')) {
      return {
        backgroundColor: 'rgba(56, 189, 248, 0.15)',
        color: '#38bdf8',
        border: '1px solid rgba(56, 189, 248, 0.3)',
      }
    }
    return {
      backgroundColor: 'rgba(245, 158, 11, 0.15)',
      color: '#fbbf24',
      border: '1px solid rgba(245, 158, 11, 0.3)',
    }
  }

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#181b22',
        color: '#e2e8f0',
        fontSize: '0.8rem',
      }}
    >
      {/* 1. Header Toolbar & Search */}
      <div
        style={{
          padding: '0.6rem 0.75rem',
          backgroundColor: '#111827',
          borderBottom: '1px solid #374151',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontWeight: 600, color: '#f3f4f6', fontSize: '0.85rem' }}>
            AWP 워크패키지 (CWP / IWP)
          </span>
          <div style={{ display: 'flex', gap: '0.3rem' }}>
            <button
              onClick={expandAll}
              style={{
                background: 'transparent',
                border: '1px solid #4b5563',
                borderRadius: '0.25rem',
                color: '#9ca3af',
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                cursor: 'pointer',
              }}
              title="모두 펼치기"
            >
              모두 펼치기
            </button>
            <button
              onClick={collapseAll}
              style={{
                background: 'transparent',
                border: '1px solid #4b5563',
                borderRadius: '0.25rem',
                color: '#9ca3af',
                fontSize: '0.7rem',
                padding: '0.15rem 0.4rem',
                cursor: 'pointer',
              }}
              title="모두 접기"
            >
              접기
            </button>
          </div>
        </div>

        {/* Search input */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="CWP, IWP, 배관 태그, Reactor 검색..."
            style={{
              width: '100%',
              padding: '0.35rem 1.8rem 0.35rem 0.6rem',
              borderRadius: '0.35rem',
              backgroundColor: '#1f2937',
              border: '1px solid #374151',
              color: '#f9fafb',
              fontSize: '0.75rem',
              outline: 'none',
            }}
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              style={{
                position: 'absolute',
                right: '0.4rem',
                background: 'none',
                border: 'none',
                color: '#9ca3af',
                cursor: 'pointer',
                fontSize: '0.8rem',
                padding: 0,
              }}
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* 2. Matched 3D Selection Card (When object is picked in 3D viewer) */}
      {matchedPickItem && (
        <div
          style={{
            margin: '0.6rem 0.75rem 0 0.75rem',
            padding: '0.6rem',
            backgroundColor: '#0f2942',
            border: '1px solid #0284c7',
            borderRadius: '0.4rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '0.72rem', fontWeight: 600, color: '#38bdf8' }}>
              🎯 선택 부재 AWP 매핑 정보
            </span>
            <span
              style={{
                fontSize: '0.68rem',
                padding: '0.1rem 0.35rem',
                borderRadius: '0.2rem',
                ...getBasisBadgeStyle(matchedPickItem.basis),
              }}
            >
              {matchedPickItem.basis}
            </span>
          </div>
          <div style={{ fontWeight: 600, color: '#ffffff', fontSize: '0.82rem', wordBreak: 'break-all' }}>
            {matchedPickItem.lineName}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#93c5fd', lineHeight: 1.4 }}>
            <div>
              <span style={{ color: '#60a5fa' }}>CWP:</span> {matchedPickItem.cwpNo}
            </div>
            <div>
              <span style={{ color: '#60a5fa' }}>IWP:</span> {matchedPickItem.iwpNo}
            </div>
            <div style={{ color: '#cbd5e1', fontSize: '0.7rem' }}>
              {matchedPickItem.iwpName}
            </div>
            {matchedPickItem.reactor && (
              <div style={{ marginTop: '0.2rem' }}>
                <span style={{ color: '#60a5fa' }}>Reactor:</span> {matchedPickItem.reactor}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.2rem' }}>
            <button
              onClick={() => onSelectLine(matchedPickItem, false)}
              style={{
                flex: 1,
                padding: '0.25rem 0.4rem',
                backgroundColor: '#0284c7',
                border: 'none',
                borderRadius: '0.25rem',
                color: '#ffffff',
                fontSize: '0.7rem',
                cursor: 'pointer',
                fontWeight: 500,
              }}
            >
              3D 포커스
            </button>
            <button
              onClick={() => onSelectLine(matchedPickItem, true)}
              style={{
                flex: 1,
                padding: '0.25rem 0.4rem',
                backgroundColor: '#1e3a8a',
                border: '1px solid #3b82f6',
                borderRadius: '0.25rem',
                color: '#ffffff',
                fontSize: '0.7rem',
                cursor: 'pointer',
              }}
            >
              격리(Isolate)
            </button>
          </div>
        </div>
      )}

      {/* 3. CWP -> IWP -> Line Hierarchical List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '0.6rem 0.75rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.6rem',
        }}
      >
        {filteredGroups.length === 0 ? (
          <div
            style={{
              padding: '2rem 1rem',
              textAlign: 'center',
              color: '#9ca3af',
              fontSize: '0.75rem',
            }}
          >
            검색 조건에 맞는 CWP / IWP 항목이 없습니다.
          </div>
        ) : (
          filteredGroups.map((cwp) => {
            const isCwpExpanded = expandedCwps.has(cwp.cwpNo)
            return (
              <div
                key={cwp.cwpNo}
                style={{
                  backgroundColor: '#1f2937',
                  border: '1px solid #374151',
                  borderRadius: '0.45rem',
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* CWP Header */}
                <div
                  onClick={() => toggleCwp(cwp.cwpNo)}
                  style={{
                    padding: '0.55rem 0.75rem',
                    backgroundColor: isCwpExpanded ? '#242e42' : '#1e2430',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    userSelect: 'none',
                    borderBottom: isCwpExpanded ? '1px solid #374151' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.65rem',
                        color: '#9ca3af',
                        transition: 'transform 0.2s',
                        transform: isCwpExpanded ? 'rotate(90deg)' : 'none',
                        display: 'inline-block',
                      }}
                    >
                      ▶
                    </span>
                    <span
                      style={{
                        backgroundColor: '#0369a1',
                        color: '#ffffff',
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '0.2rem',
                      }}
                    >
                      CWP
                    </span>
                    <span
                      style={{
                        fontWeight: 600,
                        color: '#f9fafb',
                        fontSize: '0.78rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cwp.cwpNo}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>
                      {cwp.totalLines} 라인
                    </span>
                    {onSelectCwp && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          onSelectCwp(cwp, false)
                        }}
                        style={{
                          background: '#374151',
                          border: 'none',
                          borderRadius: '0.2rem',
                          color: '#38bdf8',
                          fontSize: '0.65rem',
                          padding: '0.15rem 0.35rem',
                          cursor: 'pointer',
                        }}
                        title="CWP 전체 부재 3D 선택"
                      >
                        3D 전체
                      </button>
                    )}
                  </div>
                </div>

                {/* Subordinate IWPs (Displayed directly below CWP when expanded) */}
                {isCwpExpanded && (
                  <div
                    style={{
                      padding: '0.45rem',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.45rem',
                      backgroundColor: '#171c26',
                    }}
                  >
                    {cwp.iwps.map((iwp) => {
                      const isIwpExpanded = expandedIwps.has(iwp.iwpNo)
                      return (
                        <div
                          key={iwp.iwpNo}
                          style={{
                            backgroundColor: '#1f2937',
                            border: '1px solid #374151',
                            borderRadius: '0.35rem',
                            overflow: 'hidden',
                          }}
                        >
                          {/* IWP Header */}
                          <div
                            onClick={() => toggleIwp(iwp.iwpNo)}
                            style={{
                              padding: '0.45rem 0.6rem',
                              backgroundColor: isIwpExpanded ? '#2d3748' : '#222a36',
                              cursor: 'pointer',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '0.2rem',
                              borderBottom: isIwpExpanded ? '1px solid #374151' : 'none',
                            }}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                                <span
                                  style={{
                                    fontSize: '0.6rem',
                                    color: '#9ca3af',
                                    transform: isIwpExpanded ? 'rotate(90deg)' : 'none',
                                    display: 'inline-block',
                                    transition: 'transform 0.15s',
                                  }}
                                >
                                  ▶
                                </span>
                                <span
                                  style={{
                                    backgroundColor: '#047857',
                                    color: '#ffffff',
                                    fontSize: '0.62rem',
                                    fontWeight: 700,
                                    padding: '0.1rem 0.3rem',
                                    borderRadius: '0.2rem',
                                  }}
                                >
                                  IWP
                                </span>
                                <span
                                  style={{
                                    fontWeight: 600,
                                    color: '#e2e8f0',
                                    fontSize: '0.74rem',
                                    wordBreak: 'break-all',
                                  }}
                                >
                                  {iwp.iwpNo}
                                </span>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexShrink: 0 }}>
                                <span style={{ fontSize: '0.68rem', color: '#10b981', fontWeight: 600 }}>
                                  {iwp.lines.length}개
                                </span>
                                {onSelectIwp && (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation()
                                      onSelectIwp(iwp, false)
                                    }}
                                    style={{
                                      backgroundColor: '#047857',
                                      border: 'none',
                                      borderRadius: '0.2rem',
                                      color: '#ffffff',
                                      fontSize: '0.62rem',
                                      padding: '0.12rem 0.35rem',
                                      cursor: 'pointer',
                                    }}
                                    title="IWP 배관 전체 3D 표시"
                                  >
                                    3D 보기
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* IWP Title / Description */}
                            <div
                              style={{
                                fontSize: '0.68rem',
                                color: '#94a3b8',
                                paddingLeft: '1rem',
                                wordBreak: 'break-word',
                              }}
                            >
                              {iwp.iwpName}
                            </div>
                          </div>

                          {/* Lines List inside IWP */}
                          {isIwpExpanded && (
                            <div
                              style={{
                                maxHeight: '320px',
                                overflowY: 'auto',
                                backgroundColor: '#181b22',
                                padding: '0.3rem 0.4rem',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '0.25rem',
                              }}
                            >
                              {iwp.lines.map((line, idx) => {
                                const isCurrentPicked =
                                  matchedPickItem?.lineName === line.lineName ||
                                  (pickedItemName && pickedItemName.includes(line.lineName.replace(/^\/+/, '')))

                                return (
                                  <div
                                    key={line.lineName + idx}
                                    onClick={() => onSelectLine(line, false)}
                                    style={{
                                      padding: '0.35rem 0.5rem',
                                      backgroundColor: isCurrentPicked ? '#1e3a8a' : '#222834',
                                      border: isCurrentPicked ? '1px solid #38bdf8' : '1px solid #2d3748',
                                      borderRadius: '0.3rem',
                                      cursor: 'pointer',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '0.2rem',
                                      transition: 'background-color 0.15s',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isCurrentPicked) e.currentTarget.style.backgroundColor = '#2d3748'
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isCurrentPicked) e.currentTarget.style.backgroundColor = '#222834'
                                    }}
                                  >
                                    {/* Line Name and Badges */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        gap: '0.3rem',
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontWeight: 600,
                                          color: isCurrentPicked ? '#ffffff' : '#f1f5f9',
                                          fontSize: '0.72rem',
                                          wordBreak: 'break-all',
                                        }}
                                      >
                                        {line.lineName}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: '0.62rem',
                                          padding: '0.05rem 0.25rem',
                                          borderRadius: '0.2rem',
                                          flexShrink: 0,
                                          ...getBasisBadgeStyle(line.basis),
                                        }}
                                      >
                                        {line.basis}
                                      </span>
                                    </div>

                                    {/* Sub detail: Reactor & Counts */}
                                    <div
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        fontSize: '0.66rem',
                                        color: '#94a3b8',
                                      }}
                                    >
                                      <span>
                                        Reactor: <strong style={{ color: '#cbd5e1' }}>{line.reactor || '-'}</strong>
                                      </span>
                                      <span>
                                        연결: {line.directConnectCount} / 분기: {line.branchCount}
                                      </span>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            )
          })
        )}
      </div>

      {/* Footer Info */}
      <div
        style={{
          padding: '0.4rem 0.75rem',
          backgroundColor: '#111827',
          borderTop: '1px solid #374151',
          fontSize: '0.7rem',
          color: '#6b7280',
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        <span>총 {cwpGroups.length}개 CWP</span>
        <span>
          {cwpGroups.reduce((acc, c) => acc + c.totalLines, 0)}개 배관 라인 매핑
        </span>
      </div>
    </div>
  )
}
