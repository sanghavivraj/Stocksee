import { useState, useContext, useRef, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Send,
  Copy,
  Check,
  ShieldCheck,
  RefreshCw,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import { t } from '../utils/i18n';
import askService from '../services/askService';
import { renderMarkdown } from '../utils/formatMarkdown';
import StockScorecard from '../components/StockScorecard';

const suggestedPrompts = {
  en: [
    'Should I buy IOCL?',
    'Scorecard for Reliance',
    'Is TCS good to buy today?',
    'Should I buy HDFC Bank?',
    "What's NIFTY 50 doing today?",
    'Why is gold moving today?',
  ],
  hi: [
    'क्या मुझे IOCL खरीदना चाहिए?',
    'रिलायंस का स्कोरकार्ड कैसा है?',
    'क्या TCS में निवेश करना सही है?',
    'निफ्टी 50 में आज क्या हुआ?',
  ],
  gu: [
    'શું મારે IOCL ખરીદવું જોઈએ?',
    'રિલાયન્સનું સ્કોરકાર્ડ કેવું છે?',
    'શું TCS માં રોકાણ કરવું યોગ્ય છે?',
    'શેરબજારમાં આજે તેજી કેમ જોવા મળી?',
  ],
};

const SingleQuoteCard = ({ quote }) => {
  if (!quote) return null;
  const isUSD = quote.currency === 'USD';
  const sym = isUSD ? '$' : '₹';
  const isPos = Number(quote.dayChangePercent || 0) >= 0;

  return (
    <div className="assistant-quote-card" style={{ maxWidth: '420px', marginBottom: '0.75rem' }}>
      <div className="assistant-quote-header">
        <span className="assistant-quote-title">{quote.instrument || quote.symbol}</span>
        <span className="assistant-quote-symbol">{quote.symbol}</span>
      </div>
      <div className="assistant-quote-price-row">
        <span className="assistant-quote-price">
          {sym}{Number(quote.currentPrice).toLocaleString('en-IN')}
        </span>
        <span className={`assistant-quote-badge ${isPos ? 'positive' : 'negative'}`}>
          {isPos ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {isPos ? '+' : ''}{quote.dayChangePercent}%
        </span>
      </div>
      <div className="assistant-quote-metrics">
        <div className="assistant-quote-metric-item">
          <span>Day Range</span>
          <span className="assistant-quote-metric-val">
            {sym}{quote.dayLow} — {sym}{quote.dayHigh}
          </span>
        </div>
        {quote.weekChangePercent !== undefined && quote.weekChangePercent !== null && (
          <div className="assistant-quote-metric-item">
            <span>1-Week</span>
            <span
              className="assistant-quote-metric-val"
              style={{ color: quote.weekChangePercent >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)' }}
            >
              {quote.weekChangePercent >= 0 ? '+' : ''}{quote.weekChangePercent}%
            </span>
          </div>
        )}
      </div>
      <div className="assistant-quote-footer">
        <span>{quote.note || 'Latest available quote'}</span>
        {quote.lastUpdated && (
          <span>{new Date(quote.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        )}
      </div>
    </div>
  );
};

const AskFinGuru = () => {
  const { language, addToast } = useContext(UserContext);
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);

  const sendMessage = useCallback(async (text) => {
    const query = (text || inputQuestion).trim();
    if (!query || loading) return;

    const userMessage = {
      role: 'user',
      content: query,
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputQuestion('');
    setLoading(true);

    const conversationHistory = messages.map((m) => ({
      role: m.role,
      text: m.content,
      symbol: m.quote?.symbol || m.symbol,
      instrument: m.quote?.instrument || m.instrument,
    }));

    try {
      const res = await askService.askQuestion(query, language || 'en', conversationHistory);
      const botResponse = {
        role: 'assistant',
        content: res?.answer || 'Market data is currently unavailable.',
        quote: res?.quote || null,
        quotes: res?.quotes || null,
        scorecard: res?.scorecard || null,
        symbol: res?.symbol || null,
        instrument: res?.instrument || null,
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, botResponse]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'I could not retrieve the latest market data right now. Please verify your connection.',
          time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [inputQuestion, language, loading, messages]);

  // Auto-fill from query parameter if redirected from dashboard
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const qParam = params.get('q');
    if (qParam) {
      sendMessage(qParam);
    }
  }, [location.search, sendMessage]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const handleCopy = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    addToast('Copied to clipboard', 'info');
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const currentPrompts = suggestedPrompts[language] || suggestedPrompts.en;

  return (
    <div>
      {/* Editorial Header */}
      <div className="editorial-header">
        <div className="editorial-tag">Conversational Market Intelligence</div>
        <h1 className="editorial-headline">{t('askFinGuru', language)}</h1>
        <p className="editorial-subtext">
          Ask anything about Indian stocks, indices, gold, crude oil, or market trends in plain English, हिन्दी, or ગુજરાતી. StockSee delivers real-time market data alongside objective analysis.
        </p>
      </div>

      {/* Main Conversational Section */}
      <div className="editorial-section">
        <div
          style={{
            backgroundColor: 'var(--fg-surface)',
            border: '1px solid var(--fg-border)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '480px',
          }}
        >
          {/* Messages Stream */}
          <div style={{ flex: 1, padding: '1.5rem', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            {messages.length === 0 ? (
              <div style={{ textAlign: 'center', margin: 'auto', padding: '2rem 1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
                  <span style={{ fontSize: '1.5rem', color: 'var(--fg-accent)' }}>✦</span>
                  <span className="serif-title" style={{ fontSize: '1.5rem', fontWeight: 600 }}>StockSee Intelligence</span>
                </div>
                <p style={{ fontSize: '0.95rem', color: 'var(--fg-text-secondary)', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
                  Ask about any Indian stock, index, commodity, or market trend. Verified real-time prices, ranges, and trends.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px' }}>
                  {currentPrompts.map((p, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(p)}
                      disabled={loading}
                      className="assistant-preset-btn"
                      style={{ padding: '8px 14px', fontSize: '0.82rem' }}
                    >
                      &ldquo;{p}&rdquo;
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                const isUser = m.role === 'user';
                return (
                  <div
                    key={i}
                    style={{
                      alignSelf: isUser ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      backgroundColor: isUser ? 'var(--fg-surface-muted)' : 'var(--fg-bg)',
                      border: `1px solid ${isUser ? 'var(--fg-border)' : 'var(--fg-border-subtle)'}`,
                      borderLeft: isUser ? `1px solid var(--fg-border)` : `3px solid var(--fg-accent)`,
                      borderRadius: 'var(--radius-md)',
                      padding: '1rem 1.25rem',
                      position: 'relative',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '1rem' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          color: isUser ? 'var(--fg-accent)' : 'var(--fg-text-muted)',
                        }}
                      >
                        {isUser ? 'You' : '✦ StockSee'}
                      </span>
                      <span style={{ fontSize: '0.68rem', color: 'var(--fg-text-muted)' }}>{m.time}</span>
                    </div>

                    {/* Render Stock Scorecard & Institutional Consensus if available */}
                    {m.scorecard && <StockScorecard scorecard={m.scorecard} />}

                    {/* Render Quote Card if available and no scorecard */}
                    {m.quote && !m.scorecard && <SingleQuoteCard quote={m.quote} />}

                    {/* Render Multiple Quotes if comparison or overview */}
                    {m.quotes && Array.isArray(m.quotes) && (
                      <div className="assistant-quotes-list" style={{ maxWidth: '420px' }}>
                        {m.quotes.map((q, qIdx) => (
                          <SingleQuoteCard key={qIdx} quote={q} />
                        ))}
                      </div>
                    )}

                    <div
                      style={{
                        fontFamily: isUser ? 'var(--font-sans)' : 'inherit',
                        fontSize: '0.92rem',
                        lineHeight: 1.65,
                        color: 'var(--fg-text)',
                      }}
                    >
                      {isUser ? m.content : renderMarkdown(m.content)}
                    </div>

                    {!isUser && (
                      <button
                        type="button"
                        onClick={() => handleCopy(m.content, i)}
                        style={{
                          position: 'absolute',
                          bottom: '8px',
                          right: '8px',
                          background: 'transparent',
                          border: 'none',
                          color: 'var(--fg-text-muted)',
                          cursor: 'pointer',
                        }}
                        title="Copy"
                      >
                        {copiedIndex === i ? <Check size={13} color="var(--fg-positive)" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                );
              })
            )}

            {loading && (
              <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '8px', padding: '0.85rem 1.25rem', backgroundColor: 'var(--fg-surface-muted)', border: '1px solid var(--fg-border)', borderRadius: 'var(--radius-md)' }}>
                <RefreshCw size={14} className="spinner" color="var(--fg-accent)" />
                <span style={{ fontSize: '0.85rem', color: 'var(--fg-text-secondary)', fontStyle: 'italic' }}>
                  Retrieving live market data & synthesizing...
                </span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Prompts Bar (when messages are present) */}
          {messages.length > 0 && (
            <div style={{ padding: '0.75rem 1.5rem', borderTop: '1px solid var(--fg-border-subtle)', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--fg-text-muted)', alignSelf: 'center', marginRight: '4px' }}>
                Try asking:
              </span>
              {currentPrompts.map((p, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => sendMessage(p)}
                  disabled={loading}
                  style={{
                    background: 'var(--fg-surface-muted)',
                    border: '1px solid var(--fg-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '3px 8px',
                    fontSize: '0.75rem',
                    color: 'var(--fg-text-secondary)',
                    cursor: 'pointer',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          )}

          {/* Prompt Input Form */}
          <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} style={{ padding: '1rem 1.5rem', borderTop: '1px solid var(--fg-border)', display: 'flex', gap: '0.75rem' }}>
            <input
              type="text"
              className="editorial-input"
              placeholder="Ask about a stock, NIFTY, Gold, Crude Oil, or trend..."
              value={inputQuestion}
              onChange={(e) => setInputQuestion(e.target.value)}
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !inputQuestion.trim()}
              className="btn-editorial btn-editorial-primary"
              style={{ padding: '0 1.5rem' }}
            >
              <Send size={15} />
              <span>Send</span>
            </button>
          </form>
        </div>
      </div>

      {/* Compliance Disclaimer */}
      <div style={{ textAlign: 'center', padding: '1rem 0', color: 'var(--fg-text-muted)', fontSize: '0.75rem' }}>
        <ShieldCheck size={13} style={{ display: 'inline', verticalAlign: 'middle', marginRight: '5px' }} />
        {t('educationalDisclaimer', language)}
      </div>
    </div>
  );
};

export default AskFinGuru;