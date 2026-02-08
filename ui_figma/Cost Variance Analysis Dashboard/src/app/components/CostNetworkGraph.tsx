import { useState } from 'react';
import { Card, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, 
  Maximize2, 
  ZoomIn, 
  ZoomOut, 
  Home,
  TrendingUp,
  TrendingDown
} from 'lucide-react';

interface NetworkNode {
  id: string;
  label: string;
  value: number;
  variance: number;
  type: 'root' | 'process' | 'element' | 'driver' | 'detail';
  children?: NetworkNode[];
  expanded?: boolean;
  x?: number;
  y?: number;
  relationType?: string;
}

// Mock network data
const networkData: NetworkNode = {
  id: 'root',
  label: 'HBM_001',
  value: 552.8,
  variance: 45.3,
  type: 'root',
  children: [
    {
      id: 'process-1',
      label: '조립 공정',
      value: 354,
      variance: 22.8,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-1-1',
          label: '재료비',
          value: 142,
          variance: 14,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-1-1-1', label: '와이어본딩', value: 58, variance: 8.2, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-1-1-2', label: '다이본딩', value: 45, variance: 3.8, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-1-1-3', label: '몰딩재료', value: 39, variance: 2.0, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        },
        {
          id: 'element-1-2',
          label: '감가상각비',
          value: 98,
          variance: 6,
          type: 'element',
          relationType: 'DEPRECIATION',
          children: [
            { id: 'driver-1-2-1', label: '조립설비 신규', value: 62, variance: 4.5, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-1-2-2', label: '기존설비 이월', value: 36, variance: 1.5, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        },
        {
          id: 'element-1-3',
          label: '인건비',
          value: 67,
          variance: 2,
          type: 'element',
          relationType: 'LABOR',
          children: [
            { id: 'driver-1-3-1', label: '직접인건비', value: 42, variance: 1.2, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-1-3-2', label: '간접인건비', value: 25, variance: 0.8, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    },
    {
      id: 'process-2',
      label: '포토 공정',
      value: 245,
      variance: 18.5,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-2-1',
          label: '감가상각비',
          value: 112,
          variance: 14,
          type: 'element',
          relationType: 'DEPRECIATION',
          children: [
            { id: 'driver-2-1-1', label: 'EUV 장비 신규', value: 76, variance: 10.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                { id: 'detail-2-1-1-1', label: '설비 투자액 증가', value: 50, variance: 7.0, type: 'detail', relationType: 'ROOT_CAUSE' },
                { id: 'detail-2-1-1-2', label: '가동률 상승', value: 26, variance: 3.2, type: 'detail', relationType: 'ROOT_CAUSE' }
              ]
            },
            { id: 'driver-2-1-2', label: '기존 ArF 장비', value: 36, variance: 3.8, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        },
        {
          id: 'element-2-2',
          label: '재료비',
          value: 78,
          variance: 3,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-2-2-1', label: '포토레지스트', value: 48, variance: 2.1, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                { id: 'detail-2-2-1-1', label: '단가 상승', value: 30, variance: 1.5, type: 'detail', relationType: 'ROOT_CAUSE' },
                { id: 'detail-2-2-1-2', label: '사용량 증가', value: 18, variance: 0.6, type: 'detail', relationType: 'ROOT_CAUSE' }
              ]
            },
            { id: 'driver-2-2-2', label: '마스크비', value: 30, variance: 0.9, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    },
    {
      id: 'process-3',
      label: 'CMP 공정',
      value: 167,
      variance: 15.6,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-3-1',
          label: '재료비',
          value: 98,
          variance: 9,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-3-1-1', label: '슬러리', value: 56, variance: 5.2, type: 'driver', relationType: 'CAUSED_BY',
              children: [
                { id: 'detail-3-1-1-1', label: '슬러리 단가 상승', value: 35, variance: 3.5, type: 'detail', relationType: 'ROOT_CAUSE' },
                { id: 'detail-3-1-1-2', label: '품질 개선품 사용', value: 21, variance: 1.7, type: 'detail', relationType: 'ROOT_CAUSE' }
              ]
            },
            { id: 'driver-3-1-2', label: '패드비용', value: 28, variance: 2.8, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-3-1-3', label: '린스액', value: 14, variance: 1.0, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        },
        {
          id: 'element-3-2',
          label: '감가상각비',
          value: 45,
          variance: 5,
          type: 'element',
          relationType: 'DEPRECIATION',
          children: [
            { id: 'driver-3-2-1', label: 'CMP 장비 추가', value: 45, variance: 5.0, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    },
    {
      id: 'process-4',
      label: '식각 공정',
      value: 198,
      variance: 12.2,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-4-1',
          label: '재료비',
          value: 89,
          variance: 7,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-4-1-1', label: '에칭가스', value: 54, variance: 4.5, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-4-1-2', label: '챔버부품', value: 35, variance: 2.5, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        },
        {
          id: 'element-4-2',
          label: '감가상각비',
          value: 65,
          variance: 4,
          type: 'element',
          relationType: 'DEPRECIATION',
          children: [
            { id: 'driver-4-2-1', label: '식각설비 신규', value: 65, variance: 4.0, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    },
    {
      id: 'process-5',
      label: '패키징',
      value: 287,
      variance: 8.9,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-5-1',
          label: '재료비',
          value: 134,
          variance: 6,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-5-1-1', label: '기판비용', value: 78, variance: 3.5, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-5-1-2', label: '솔더볼', value: 56, variance: 2.5, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    },
    {
      id: 'process-6',
      label: '증착',
      value: 223,
      variance: 8.3,
      type: 'process',
      relationType: 'CONSUMES',
      children: [
        {
          id: 'element-6-1',
          label: '재료비',
          value: 95,
          variance: 5,
          type: 'element',
          relationType: 'MATERIAL',
          children: [
            { id: 'driver-6-1-1', label: '타겟재료', value: 58, variance: 3.2, type: 'driver', relationType: 'CAUSED_BY' },
            { id: 'driver-6-1-2', label: '가스류', value: 37, variance: 1.8, type: 'driver', relationType: 'CAUSED_BY' }
          ]
        }
      ]
    }
  ]
};

export function CostNetworkGraph() {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['root']));
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewBox, setViewBox] = useState({ x: 0, y: 0, width: 1200, height: 800 });

  const toggleNode = (nodeId: string) => {
    const newExpanded = new Set(expandedNodes);
    if (newExpanded.has(nodeId)) {
      // Collapse - remove this node and all its descendants
      const removeDescendants = (id: string) => {
        newExpanded.delete(id);
        const node = findNode(networkData, id);
        node?.children?.forEach(child => removeDescendants(child.id));
      };
      removeDescendants(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    setExpandedNodes(newExpanded);
    setSelectedNode(nodeId);
  };

  const findNode = (node: NetworkNode, id: string): NetworkNode | null => {
    if (node.id === id) return node;
    if (node.children) {
      for (const child of node.children) {
        const found = findNode(child, id);
        if (found) return found;
      }
    }
    return null;
  };

  const resetView = () => {
    setExpandedNodes(new Set(['root']));
    setSelectedNode(null);
    setZoom(1);
  };

  // Calculate positions for visible nodes
  const calculatePositions = () => {
    const positions: Map<string, { x: number; y: number; node: NetworkNode }> = new Map();
    const centerX = 600;
    const centerY = 400;
    
    const positionNode = (
      node: NetworkNode, 
      parentX: number, 
      parentY: number, 
      angle: number, 
      radius: number,
      level: number
    ) => {
      const x = level === 0 ? centerX : parentX + Math.cos(angle) * radius;
      const y = level === 0 ? centerY : parentY + Math.sin(angle) * radius;
      
      positions.set(node.id, { x, y, node });

      if (expandedNodes.has(node.id) && node.children) {
        const childCount = node.children.length;
        const angleStep = (Math.PI * 2) / Math.max(childCount, 3);
        const startAngle = level === 0 ? 0 : angle - angleStep * (childCount - 1) / 2;
        
        node.children.forEach((child, index) => {
          const childAngle = startAngle + angleStep * index;
          const childRadius = level === 0 ? 250 : 180;
          positionNode(child, x, y, childAngle, childRadius, level + 1);
        });
      }
    };

    positionNode(networkData, centerX, centerY, 0, 0, 0);
    return positions;
  };

  const positions = calculatePositions();

  const getNodeSize = (variance: number, type: string) => {
    const baseSize = {
      root: 80,
      process: 70,
      element: 60,
      driver: 50,
      detail: 40
    }[type] || 50;
    
    const scale = 1 + Math.min(Math.abs(variance) / 30, 1);
    return baseSize * scale;
  };

  const getNodeColor = (variance: number, type: string) => {
    if (variance > 10) return '#ef4444'; // Red for high increase
    if (variance > 5) return '#f97316'; // Orange
    if (variance > 0) return '#fbbf24'; // Yellow
    if (variance > -5) return '#60a5fa'; // Light blue
    return '#3b82f6'; // Blue for decrease
  };

  const getRelationshipLabel = (type: string) => {
    const labels: Record<string, string> = {
      'CONSUMES': '투입',
      'MATERIAL': '재료비',
      'DEPRECIATION': '감가상각',
      'LABOR': '인건비',
      'CAUSED_BY': '원인',
      'ROOT_CAUSE': '근본원인'
    };
    return labels[type] || type;
  };

  return (
    <div className="space-y-4">
      {/* Control Panel */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <h3 className="text-lg font-bold text-slate-900">원가 드라이버 네트워크 그래프</h3>
              <Badge variant="outline" className="gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                {positions.size}개 노드 표시
              </Badge>
            </div>
            
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setZoom(Math.min(zoom + 0.2, 3))}
                className="gap-2"
              >
                <ZoomIn className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setZoom(Math.max(zoom - 0.2, 0.5))}
                className="gap-2"
              >
                <ZoomOut className="w-4 h-4" />
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={resetView}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                초기화
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="shadow-lg border-slate-200">
        <CardContent className="p-4">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-red-500" />
              <span className="text-slate-600">고증가 (&gt;10억)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-orange-500" />
              <span className="text-slate-600">중증가 (5~10억)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-yellow-400" />
              <span className="text-slate-600">소증가 (0~5억)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-400" />
              <span className="text-slate-600">감소</span>
            </div>
            <div className="ml-auto text-slate-500">💡 노드를 클릭하여 하위 드라이버 확장/축소</div>
          </div>
        </CardContent>
      </Card>

      {/* Graph Canvas */}
      <Card className="shadow-lg border-slate-200 overflow-hidden">
        <CardContent className="p-0">
          <div className="relative w-full h-[800px] bg-gradient-to-br from-slate-50 to-white overflow-hidden">
            <svg 
              className="w-full h-full" 
              viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.width} ${viewBox.height}`}
              style={{ cursor: 'grab' }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                <marker
                  id="arrowhead"
                  markerWidth="10"
                  markerHeight="10"
                  refX="9"
                  refY="3"
                  orient="auto"
                >
                  <polygon points="0 0, 10 3, 0 6" fill="#94a3b8" />
                </marker>
              </defs>

              {/* Draw connections */}
              <g>
                {Array.from(positions.entries()).map(([nodeId, pos]) => {
                  const node = pos.node;
                  if (!node.children || !expandedNodes.has(nodeId)) return null;
                  
                  return node.children.map(child => {
                    const childPos = positions.get(child.id);
                    if (!childPos) return null;

                    const angle = Math.atan2(childPos.y - pos.y, childPos.x - pos.x);
                    const nodeSize = getNodeSize(node.variance, node.type) / 2;
                    const childSize = getNodeSize(child.variance, child.type) / 2;
                    
                    const startX = pos.x + Math.cos(angle) * nodeSize;
                    const startY = pos.y + Math.sin(angle) * nodeSize;
                    const endX = childPos.x - Math.cos(angle) * childSize;
                    const endY = childPos.y - Math.sin(angle) * childSize;

                    // Calculate midpoint for label
                    const midX = (startX + endX) / 2;
                    const midY = (startY + endY) / 2;

                    return (
                      <g key={`${nodeId}-${child.id}`}>
                        <motion.line
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ pathLength: 1, opacity: 0.3 }}
                          transition={{ duration: 0.5 }}
                          x1={startX}
                          y1={startY}
                          x2={endX}
                          y2={endY}
                          stroke="#94a3b8"
                          strokeWidth="2"
                          markerEnd="url(#arrowhead)"
                        />
                        {child.relationType && (
                          <text
                            x={midX}
                            y={midY - 5}
                            fontSize="11"
                            fill="#64748b"
                            textAnchor="middle"
                            className="pointer-events-none"
                          >
                            {getRelationshipLabel(child.relationType)}
                          </text>
                        )}
                      </g>
                    );
                  });
                })}
              </g>

              {/* Draw nodes */}
              <g>
                {Array.from(positions.entries()).map(([nodeId, pos], index) => {
                  const node = pos.node;
                  const size = getNodeSize(node.variance, node.type);
                  const color = getNodeColor(node.variance, node.type);
                  const isSelected = selectedNode === nodeId;
                  const hasChildren = node.children && node.children.length > 0;

                  return (
                    <g key={nodeId}>
                      <motion.circle
                        initial={{ scale: 0, opacity: 0 }}
                        animate={{ 
                          scale: isSelected ? 1.15 : 1, 
                          opacity: 1,
                          x: pos.x,
                          y: pos.y
                        }}
                        transition={{ 
                          duration: 0.4,
                          delay: index * 0.02,
                          type: 'spring',
                          stiffness: 200
                        }}
                        r={size / 2}
                        fill={color}
                        stroke={isSelected ? '#3b82f6' : '#fff'}
                        strokeWidth={isSelected ? 4 : 2}
                        style={{ 
                          cursor: hasChildren ? 'pointer' : 'default',
                          filter: isSelected ? 'url(#glow)' : 'none'
                        }}
                        onClick={() => hasChildren && toggleNode(nodeId)}
                        className="transition-all"
                      />
                      
                      {/* Node label */}
                      <text
                        x={pos.x}
                        y={pos.y - size / 2 - 10}
                        fontSize="13"
                        fontWeight="600"
                        fill="#1e293b"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {node.label}
                      </text>
                      
                      {/* Variance value */}
                      <text
                        x={pos.x}
                        y={pos.y + 5}
                        fontSize="14"
                        fontWeight="bold"
                        fill="#fff"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        {node.variance > 0 ? '+' : ''}{node.variance}억
                      </text>
                      
                      {/* Total value */}
                      <text
                        x={pos.x}
                        y={pos.y + size / 2 + 20}
                        fontSize="11"
                        fill="#64748b"
                        textAnchor="middle"
                        className="pointer-events-none select-none"
                      >
                        ({node.value}억)
                      </text>

                      {/* Expand indicator */}
                      {hasChildren && !expandedNodes.has(nodeId) && (
                        <g>
                          <circle
                            cx={pos.x + size / 2 - 8}
                            cy={pos.y - size / 2 + 8}
                            r="10"
                            fill="#3b82f6"
                            stroke="#fff"
                            strokeWidth="2"
                          />
                          <text
                            x={pos.x + size / 2 - 8}
                            y={pos.y - size / 2 + 12}
                            fontSize="12"
                            fontWeight="bold"
                            fill="#fff"
                            textAnchor="middle"
                            className="pointer-events-none select-none"
                          >
                            +
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        </CardContent>
      </Card>

      {/* Selected Node Detail Panel */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <Card className="shadow-lg border-blue-500 border-2">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-2">
                      {positions.get(selectedNode)?.node.label}
                    </h3>
                    <div className="flex items-center gap-4">
                      <div>
                        <div className="text-sm text-slate-500">총 원가</div>
                        <div className="text-2xl font-bold text-slate-900">
                          {positions.get(selectedNode)?.node.value}억원
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-slate-500">차이</div>
                        <div className={`text-2xl font-bold flex items-center gap-2 ${
                          (positions.get(selectedNode)?.node.variance || 0) > 0 ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {(positions.get(selectedNode)?.node.variance || 0) > 0 ? (
                            <TrendingUp className="w-6 h-6" />
                          ) : (
                            <TrendingDown className="w-6 h-6" />
                          )}
                          {positions.get(selectedNode)?.node.variance > 0 ? '+' : ''}
                          {positions.get(selectedNode)?.node.variance}억원
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedNode(null)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                {positions.get(selectedNode)?.node.children && (
                  <div>
                    <div className="text-sm font-semibold text-slate-600 mb-3">
                      하위 드라이버 ({positions.get(selectedNode)?.node.children?.length}개)
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      {positions.get(selectedNode)?.node.children?.map(child => (
                        <div 
                          key={child.id}
                          className="p-3 bg-slate-50 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors"
                          onClick={() => toggleNode(child.id)}
                        >
                          <div className="text-sm font-medium text-slate-900 mb-1">{child.label}</div>
                          <div className={`text-lg font-bold ${child.variance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                            {child.variance > 0 ? '+' : ''}{child.variance}억
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
