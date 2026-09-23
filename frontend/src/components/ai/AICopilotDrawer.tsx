import React, { useState, useRef, useEffect } from 'react';
import { X, Send, Sparkles, Bot, Loader2 } from 'lucide-react';
import { aiService } from '../../services/index.ts';
import { Issue } from '../../types/index.ts';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext: Issue | null;
}

interface ChatMessage {
  role: 'assistant' | 'user';
  content: string;
}

export default function AICopilotDrawer({ isOpen, onClose, initialContext }: AICopilotDrawerProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: `Hello! I am your **Autonomous AFDD Maintenance Copilot**.\n\nI monitor real-time thermodynamic telemetry, BrickSchema spatial connections, and diagnostic rules across your buildings.\n\nHow can I assist you with **Building A** today?`
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (initialContext) {
      const prompt = `Can you analyze the fault on ${initialContext.entity_id} (${initialContext.title}) and recommend immediate remediation steps?`;
      handleSendMessage(prompt);
    }
  }, [initialContext]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || input;
    if (!text.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    if (!textToSend) setInput('');
    setLoading(true);

    try {
      const res = await aiService.chat(text, initialContext);
      setMessages(prev => [...prev, { role: 'assistant', content: res.response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I encountered an error connecting to the LLM agent.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: '440px', maxWidth: '90vw', background: '#ffffff', borderLeft: '1px solid var(--border-color)', boxShadow: '-10px 0 30px rgba(0,0,0,0.12)', zIndex: 1000, display: 'flex', flexDirection: 'column' }}>
      
      {/* Header */}
      <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'linear-gradient(135deg, #2563eb 0%, #7c3aed 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff' }}>
            <Sparkles size={18} />
          </div>
          <div>
            <h4 style={{ fontSize: '0.92rem', fontWeight: '700' }}>AFDD Maintenance Copilot</h4>
            <span style={{ fontSize: '0.72rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '500' }}>
              <span className="pulse-indicator green" style={{ width: '6px', height: '6px' }}></span>
              Connected to Building Ontology
            </span>
          </div>
        </div>
        <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}>
          <X size={20} />
        </button>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px', background: '#ffffff' }}>
        {messages.map((m, idx) => (
          <div key={idx} style={{ display: 'flex', gap: '10px', alignItems: 'flex-start', alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '88%' }}>
            {m.role === 'assistant' && (
              <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--primary-blue-subtle)', border: '1px solid #bfdbfe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--primary-blue)', flexShrink: 0 }}>
                <Bot size={15} />
              </div>
            )}
            <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-md)', background: m.role === 'user' ? '#2563eb' : '#f8fafc', color: m.role === 'user' ? '#ffffff' : 'var(--text-main)', fontSize: '0.84rem', lineHeight: '1.5', whiteSpace: 'pre-wrap', border: m.role === 'user' ? 'none' : '1px solid var(--border-color)', boxShadow: '0 1px 2px rgba(0,0,0,0.04)' }}>
              {m.content}
            </div>
          </div>
        ))}
        {loading && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', color: 'var(--primary-blue)', fontSize: '0.8rem', padding: '8px' }}>
            <Loader2 size={16} className="spin" />
            <span>Analyzing BrickSchema topology & telemetry streams...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border-color)', background: '#f8fafc' }}>
        <form onSubmit={e => { e.preventDefault(); handleSendMessage(); }} style={{ display: 'flex', gap: '8px' }}>
          <input 
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask AI about AHU faults, energy waste, or rooms..."
            style={{ flex: 1, background: '#ffffff', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', padding: '9px 12px', color: 'var(--text-main)', fontSize: '0.84rem', outline: 'none' }}
          />
          <button type="submit" disabled={loading} className="btn btn-primary" style={{ padding: '9px 14px' }}>
            <Send size={15} />
          </button>
        </form>
      </div>

    </div>
  );
}
