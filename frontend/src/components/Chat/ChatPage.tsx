import { useState, useRef, useEffect } from 'react'
import { chatApi } from '../../services/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [yyyymm, setYyyymm] = useState('202501')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)

    try {
      const res = await chatApi.ask(userMsg, yyyymm)
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }])
    } catch (error: any) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `오류가 발생했습니다: ${error.message}`,
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">질의응답</h2>
        <p className="page-subtitle">원가 변동에 대해 자연어로 질문하세요</p>
      </div>

      <div className="month-selector">
        <label>분석 기준월:</label>
        <select value={yyyymm} onChange={e => setYyyymm(e.target.value)}>
          <option value="202501">2025년 01월</option>
          <option value="202412">2024년 12월</option>
        </select>
      </div>

      <div className="card chat-container" style={{ padding: 0 }}>
        {/* 메시지 영역 */}
        <div style={{
          minHeight: 400,
          maxHeight: 600,
          overflowY: 'auto',
          padding: 20,
        }}>
          {messages.length === 0 && (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: 40 }}>
              <p style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
                원가 변동에 대해 질문해보세요
              </p>
              <p style={{ fontSize: 13 }}>예시:</p>
              <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[
                  '이번 달 원가가 왜 올랐나요?',
                  'HBM 제품의 배부율이 왜 상승했나요?',
                  '과거에도 이런 패턴이 있었나요?',
                  '어떤 제품에 파급이 있었나요?',
                ].map(q => (
                  <button
                    key={q}
                    className="btn"
                    style={{
                      background: '#f1f5f9',
                      fontSize: 13,
                      padding: '8px 16px',
                    }}
                    onClick={() => { setInput(q); }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                marginBottom: 12,
              }}
            >
              <div
                style={{
                  maxWidth: '80%',
                  padding: '10px 16px',
                  borderRadius: 12,
                  background: msg.role === 'user' ? '#1a56db' : '#f1f5f9',
                  color: msg.role === 'user' ? 'white' : '#1e293b',
                  fontSize: 14,
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
              <div style={{
                padding: '10px 16px', borderRadius: 12,
                background: '#f1f5f9', color: '#64748b', fontSize: 14,
              }}>
                분석 중...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 입력 영역 */}
        <div className="chat-input">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="원가 변동에 대해 질문하세요..."
            disabled={loading}
          />
          <button className="btn btn-primary" onClick={handleSend} disabled={loading}>
            전송
          </button>
        </div>
      </div>
    </div>
  )
}
