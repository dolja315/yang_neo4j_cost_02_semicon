/**
 * GraphExplorer — Neo4j 인과 그래프 인터랙티브 시각화
 *
 * 노드를 클릭하면 하위 원인 노드가 펼쳐지며 원인 추적이 가능합니다.
 * dagMode="td" (top-down) 으로 계층형 레이아웃 적용.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import ForceGraph2D from 'react-force-graph-2d'
import { dashboardApi } from '../../services/api'

/* ═══════════ 타입 ═══════════ */
interface GNode {
  id: string; label: string; sublabel?: string
  type: string; source_type?: string
  val: number; level: number
  x?: number; y?: number
  __expanded?: boolean
}
interface GLink {
  source: string | GNode; target: string | GNode
  label?: string
}
interface GraphData { nodes: GNode[]; links: GLink[] }

/* ═══════════ 색상 팔레트 ═══════════ */
const NODE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  product:      { bg: '#dbeafe', border: '#1e40af', text: '#1e3a5f' },
  cost_element: { bg: '#fef3c7', border: '#d97706', text: '#78350f' },
  sub_var:      { bg: '#ede9fe', border: '#7c3aed', text: '#4c1d95' },
  detail:       { bg: '#cffafe', border: '#0891b2', text: '#164e63' },
  process:      { bg: '#f1f5f9', border: '#475569', text: '#1e293b' },
  event:        { bg: '#fee2e2', border: '#dc2626', text: '#7f1d1d' },
  spread:       { bg: '#fce7f3', border: '#db2777', text: '#831843' },
}
const LINK_COLORS: Record<string, string> = {
  '비용분해': '#d97706',
  '분해':     '#7c3aed',
  '원인':     '#0891b2',
  '근거':     '#dc2626',
  '파급(SPREADS_TO)': '#db2777',
}

/* ═══════════ 제품 라벨 ═══════════ */
const PRODUCT_LABELS: Record<string, string> = {
  HBM_001: 'HBM3E 8Hi', HBM_002: 'HBM3E 12Hi',
  SVR_001: 'DDR5 RDIMM 64G', SVR_002: 'DDR5 MRDIMM 128G',
  CXL_001: 'CXL Type3 128G', CXL_002: 'CXL Type3 256G',
  MBL_001: 'LPDDR5X 16G', MBL_002: 'LPDDR5X 12G',
  PC_001: 'DDR5 16G UDIMM', PC_002: 'DDR5 32G UDIMM',
  NAND_001: '4D NAND 238L', NAND_002: '4D NAND 321L',
  SSD_001: 'eSSD PE8110', SSD_002: 'UFS 4.1 256G',
  CIS_001: '50M Pixel CIS', CIS_002: '200M Pixel CIS',
}
const PRODUCT_LIST = Object.keys(PRODUCT_LABELS)

/* ═══════════ 노드 크기 계산 헬퍼 ═══════════ */
function measureNode(node: GNode, ctx: CanvasRenderingContext2D, fontSize: number) {
  const padding = 8
  ctx.font = `bold ${fontSize}px sans-serif`
  const labelW = ctx.measureText(node.label).width
  const valText = node.val != null && Math.abs(node.val) > 0.001
    ? `${node.val >= 0 ? '+' : ''}${node.val.toFixed(2)}억`
    : ''
  ctx.font = `bold ${fontSize * 0.85}px sans-serif`
  const valW = valText ? ctx.measureText(valText).width : 0
  const w = Math.max(labelW, valW) + padding * 3
  const h = valText ? fontSize * 2.8 : fontSize * 2.0
  return { w, h, valText }
}

/* ═══════════ 컴포넌트 ═══════════ */
export default function GraphExplorer() {
  const [yyyymm, setYyyymm] = useState('202501')
  const [productCd, setProductCd] = useState('HBM_001')
  const [expandedSet, setExpandedSet] = useState<Set<string>>(new Set())
  const [maxLevel, setMaxLevel] = useState(1)
  const fgRef = useRef<any>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dims, setDims] = useState({ w: 900, h: 620 })

  /* ── 컨테이너 크기 추적 ── */
  useEffect(() => {
    const update = () => {
      if (containerRef.current) {
        setDims({
          w: containerRef.current.clientWidth,
          h: Math.max(550, window.innerHeight - 300),
        })
      }
    }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  /* ── 데이터 로드 ── */
  const { data: rawGraph, isLoading } = useQuery({
    queryKey: ['graphData', yyyymm, productCd],
    queryFn: () => dashboardApi.getGraphData(yyyymm, productCd).then(r => r.data),
  })

  /* ── 제품 변경 시 초기화 ── */
  useEffect(() => {
    setExpandedSet(new Set())
    setMaxLevel(1)
    setTimeout(() => fgRef.current?.zoomToFit(400, 80), 600)
  }, [productCd, yyyymm])

  /* ── 필터링된 그래프 데이터 ── */
  const filteredGraph: GraphData = useMemo(() => {
    if (!rawGraph) return { nodes: [], links: [] }
    const allNodes = rawGraph.nodes as GNode[]
    const allLinks = rawGraph.links as GLink[]

    // 부모→자식 맵
    const childByParent = new Map<string, string[]>()
    allLinks.forEach((l: GLink) => {
      const src = typeof l.source === 'string' ? l.source : l.source.id
      const tgt = typeof l.target === 'string' ? l.target : l.target.id
      childByParent.set(src, [...(childByParent.get(src) || []), tgt])
    })

    // BFS 가시 노드 결정
    const visibleIds = new Set<string>()
    const rootNode = allNodes.find(n => n.level === 0)
    if (!rootNode) return { nodes: [], links: [] }

    const queue = [rootNode.id]
    visibleIds.add(rootNode.id)

    while (queue.length > 0) {
      const pid = queue.shift()!
      const pNode = allNodes.find(n => n.id === pid)
      if (!pNode) continue
      const isExpanded = expandedSet.has(pid) || pNode.level < maxLevel - 1
      if (!isExpanded) continue
      for (const cid of (childByParent.get(pid) || [])) {
        const cNode = allNodes.find(n => n.id === cid)
        if (cNode && cNode.level <= maxLevel) {
          visibleIds.add(cid)
          queue.push(cid)
        }
      }
    }

    const nodes = allNodes
      .filter(n => visibleIds.has(n.id))
      .map(n => ({ ...n, __expanded: expandedSet.has(n.id) }))
    const nodeIdSet = new Set(nodes.map(n => n.id))
    const links = allLinks.filter(l => {
      const s = typeof l.source === 'string' ? l.source : l.source.id
      const t = typeof l.target === 'string' ? l.target : l.target.id
      return nodeIdSet.has(s) && nodeIdSet.has(t)
    })
    return { nodes, links }
  }, [rawGraph, expandedSet, maxLevel])

  /* ── 노드 클릭 ── */
  const handleNodeClick = useCallback((node: any) => {
    setExpandedSet(prev => {
      const next = new Set(prev)
      if (next.has(node.id)) {
        next.delete(node.id)
      } else {
        next.add(node.id)
        const childLevel = (node.level || 0) + 1
        if (childLevel >= maxLevel) {
          setMaxLevel(m => Math.max(m, childLevel + 1))
        }
      }
      return next
    })
    setTimeout(() => fgRef.current?.zoomToFit(400, 80), 400)
  }, [maxLevel])

  /* ── 전체 확장/축소 ── */
  const expandAll = () => {
    if (!rawGraph) return
    setMaxLevel(10)
    setExpandedSet(new Set(rawGraph.nodes.map((n: GNode) => n.id)))
    setTimeout(() => fgRef.current?.zoomToFit(400, 80), 400)
  }
  const collapseAll = () => {
    setExpandedSet(new Set())
    setMaxLevel(1)
    setTimeout(() => fgRef.current?.zoomToFit(400, 80), 400)
  }

  /* ══════════ Canvas 노드 렌더링 ══════════ */
  const paintNode = useCallback((node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const n = node as GNode
    const fontSize = Math.max(11, 12 / globalScale)
    const colors = NODE_COLORS[n.type] || NODE_COLORS.process
    const { w, h, valText } = measureNode(n, ctx, fontSize)
    const x = (n.x || 0) - w / 2
    const y = (n.y || 0) - h / 2
    const r = 6

    // 그림자
    ctx.shadowColor = 'rgba(0,0,0,0.12)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetY = 2

    // 배경 사각형
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, r)
    ctx.fillStyle = colors.bg
    ctx.fill()

    // 테두리
    ctx.shadowColor = 'transparent'
    ctx.strokeStyle = colors.border
    ctx.lineWidth = n.__expanded ? 3 : 1.8
    ctx.stroke()

    // 좌측 컬러 바
    ctx.beginPath()
    ctx.roundRect(x, y, 5, h, [r, 0, 0, r])
    ctx.fillStyle = colors.border
    ctx.fill()

    // 라벨
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillStyle = colors.text
    ctx.font = `bold ${fontSize}px sans-serif`
    const textY = valText ? (n.y || 0) - fontSize * 0.35 : (n.y || 0)
    ctx.fillText(n.label, (n.x || 0) + 2, textY)

    // 금액
    if (valText) {
      ctx.font = `bold ${fontSize * 0.9}px sans-serif`
      ctx.fillStyle = n.val >= 0 ? '#dc2626' : '#16a34a'
      ctx.fillText(valText, (n.x || 0) + 2, (n.y || 0) + fontSize * 0.55)
    }

    // 확장 힌트 (하위 자식이 있으면 + 표시)
    if (!n.__expanded && n.level < 4) {
      ctx.font = `bold ${fontSize * 0.7}px sans-serif`
      ctx.fillStyle = '#94a3b8'
      ctx.textAlign = 'right'
      ctx.fillText('▶', x + w - 4, (n.y || 0))
    }

    // 노드의 바운더리를 저장 (링크 연결에 사용)
    ;(node as any).__bw = w
    ;(node as any).__bh = h
  }, [])

  /* ══════════ Canvas 링크 렌더링 ══════════ */
  const paintLink = useCallback((link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const src = link.source as any
    const tgt = link.target as any
    if (src.x == null || tgt.x == null) return

    // 사각형 노드 경계에서 시작/끝점 계산
    const srcW = (src.__bw || 60) / 2
    const srcH = (src.__bh || 30) / 2
    const tgtW = (tgt.__bw || 60) / 2
    const tgtH = (tgt.__bh || 30) / 2

    const dx = tgt.x - src.x
    const dy = tgt.y - src.y
    const dist = Math.sqrt(dx * dx + dy * dy)
    if (dist < 1) return

    // 사각형 경계와의 교점 계산
    const clipRect = (cx: number, cy: number, hw: number, hh: number, ax: number, ay: number) => {
      const adx = ax - cx
      const ady = ay - cy
      const scaleX = hw / Math.abs(adx || 0.001)
      const scaleY = hh / Math.abs(ady || 0.001)
      const s = Math.min(scaleX, scaleY)
      return { x: cx + adx * s, y: cy + ady * s }
    }

    const p1 = clipRect(src.x, src.y, srcW + 2, srcH + 2, tgt.x, tgt.y)
    const p2 = clipRect(tgt.x, tgt.y, tgtW + 2, tgtH + 2, src.x, src.y)

    const linkColor = LINK_COLORS[link.label] || '#94a3b8'

    // 선
    ctx.beginPath()
    ctx.moveTo(p1.x, p1.y)
    ctx.lineTo(p2.x, p2.y)
    ctx.strokeStyle = linkColor
    ctx.lineWidth = 2.0
    ctx.setLineDash([])
    ctx.stroke()

    // 화살표 머리
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x)
    const arrowLen = 10
    ctx.beginPath()
    ctx.moveTo(p2.x, p2.y)
    ctx.lineTo(
      p2.x - arrowLen * Math.cos(angle - Math.PI / 7),
      p2.y - arrowLen * Math.sin(angle - Math.PI / 7)
    )
    ctx.lineTo(
      p2.x - arrowLen * Math.cos(angle + Math.PI / 7),
      p2.y - arrowLen * Math.sin(angle + Math.PI / 7)
    )
    ctx.closePath()
    ctx.fillStyle = linkColor
    ctx.fill()

    // 라벨
    if (link.label && globalScale > 0.4) {
      const midX = (p1.x + p2.x) / 2
      const midY = (p1.y + p2.y) / 2
      const fontSize = Math.max(9, 10 / globalScale)
      ctx.font = `bold ${fontSize}px sans-serif`
      const textW = ctx.measureText(link.label).width

      // 라벨 배경
      ctx.fillStyle = 'rgba(255,255,255,0.92)'
      ctx.fillRect(midX - textW / 2 - 3, midY - fontSize / 2 - 1, textW + 6, fontSize + 2)

      // 라벨 텍스트
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = linkColor
      ctx.fillText(link.label, midX, midY)
    }
  }, [])

  /* ── 노드 포인터 영역 ── */
  const nodePointerArea = useCallback((node: any, color: string, ctx: CanvasRenderingContext2D) => {
    const bw = (node.__bw || 60) / 2
    const bh = (node.__bh || 30) / 2
    ctx.fillStyle = color
    ctx.fillRect((node.x || 0) - bw, (node.y || 0) - bh, bw * 2, bh * 2)
  }, [])

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">그래프 기반 원인 추적</h2>
        <p className="page-subtitle">
          Neo4j 인과 그래프를 탐색하며 원가 변동의 원인을 추적합니다.
          노드를 클릭하면 하위 원인이 펼쳐집니다.
        </p>
      </div>

      {/* ── 컨트롤 바 ── */}
      <div className="card" style={{ padding: '12px 20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>기준월</label>
            <select value={yyyymm} onChange={e => setYyyymm(e.target.value)}
              className="product-selector">
              <option value="202501">2025.01</option>
              <option value="202412">2024.12</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <label style={{ fontSize: 14, fontWeight: 600 }}>제품</label>
            <select value={productCd} onChange={e => setProductCd(e.target.value)}
              className="product-selector">
              {PRODUCT_LIST.map(p => (
                <option key={p} value={p}>{p} ({PRODUCT_LABELS[p]})</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
            <button className="btn btn-primary" onClick={expandAll}
              style={{ padding: '6px 14px', fontSize: 13 }}>
              전체 확장
            </button>
            <button className="btn" onClick={collapseAll}
              style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #e2e8f0' }}>
              전체 축소
            </button>
            <button className="btn" onClick={() => fgRef.current?.zoomToFit(400, 80)}
              style={{ padding: '6px 14px', fontSize: 13, border: '1px solid #e2e8f0' }}>
              화면 맞춤
            </button>
          </div>
        </div>
      </div>

      {/* ── 범례 ── */}
      <div className="card" style={{ padding: '10px 20px' }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: '#64748b', fontWeight: 600 }}>노드:</span>
          {([
            ['product', '제품 원가'],
            ['cost_element', '원가요소'],
            ['sub_var', '하위 분해'],
            ['detail', '상세 원인'],
            ['event', '소스 이벤트'],
            ['spread', '파급 제품'],
          ] as [string, string][]).map(([type, label]) => (
            <span key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12 }}>
              <span style={{
                width: 14, height: 14, borderRadius: 3, display: 'inline-block',
                background: NODE_COLORS[type]?.bg,
                border: `2px solid ${NODE_COLORS[type]?.border}`,
              }} />
              {label}
            </span>
          ))}
          <span style={{ fontSize: 12, color: '#94a3b8', marginLeft: 12 }}>
            | 화살표 색상: 관계 유형별 구분
          </span>
        </div>
      </div>

      {/* ── 그래프 영역 ── */}
      <div ref={containerRef} className="card" style={{ padding: 0, overflow: 'hidden', position: 'relative' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: 80, color: '#94a3b8' }}>
            <div className="spinner" />
            <p style={{ marginTop: 12 }}>그래프 데이터를 불러오는 중...</p>
          </div>
        ) : (
          <ForceGraph2D
            ref={fgRef}
            graphData={filteredGraph}
            width={dims.w}
            height={dims.h}
            backgroundColor="#fafbfc"
            /* ── 계층형 레이아웃 ── */
            dagMode="td"
            dagLevelDistance={90}
            /* ── 노드 ── */
            nodeCanvasObject={paintNode}
            nodePointerAreaPaint={nodePointerArea}
            onNodeClick={handleNodeClick}
            nodeLabel={(n: any) =>
              `${n.label}${n.sublabel ? `\n${n.sublabel}` : ''}${n.val ? `\n${n.val >= 0 ? '+' : ''}${n.val.toFixed(2)}억원` : ''}`
            }
            /* ── 링크 ── */
            linkCanvasObject={paintLink}
            linkCanvasObjectMode={() => 'replace' as any}
            /* ── 물리 엔진 ── */
            d3AlphaDecay={0.05}
            d3VelocityDecay={0.4}
            cooldownTicks={120}
            warmupTicks={50}
            onEngineStop={() => fgRef.current?.zoomToFit(400, 80)}
          />
        )}

        {/* ── 인터랙션 가이드 ── */}
        <div style={{
          position: 'absolute', top: 12, left: 16,
          background: 'rgba(255,255,255,0.92)', padding: '6px 14px',
          borderRadius: 6, fontSize: 12, color: '#64748b',
          border: '1px solid #e2e8f0', lineHeight: 1.8,
        }}>
          <strong>조작법</strong><br />
          노드 클릭 → 하위 원인 펼치기/접기<br />
          마우스 휠 → 확대/축소<br />
          드래그 → 이동
        </div>

        {/* ── 카운트 ── */}
        <div style={{
          position: 'absolute', bottom: 12, right: 16,
          background: 'rgba(255,255,255,0.92)', padding: '4px 12px',
          borderRadius: 6, fontSize: 12, color: '#64748b',
          border: '1px solid #e2e8f0',
        }}>
          표시: {filteredGraph.nodes.length}개 노드, {filteredGraph.links.length}개 관계
          {rawGraph && ` / 전체 ${rawGraph.nodes.length}개`}
        </div>
      </div>
    </div>
  )
}
