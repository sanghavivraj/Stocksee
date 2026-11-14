import { useState, useEffect, useContext, useRef } from 'react';
import {
  Sparkles,
  X,
  Loader2,
  ShieldCheck,
  Send,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import askService from '../services/askService';
import { renderMarkdown } from '../utils/formatMarkdown';
import StockScorecard from './StockScorecard';
import TipCheckResult from './TipCheckResult';

const SOURCE_LABEL = {
  gemini: 'AI-written • numbers checked against live data',
  groq: 'AI-written • numbers checked against live data',
  template: 'Built from live data',
  'tip-check': 'Tip Check',
};

/** Short follow-up questions for the instrument the answer was about. */
const followUpsFor = (msg) => {
  const name = msg.quote?.instrument || msg.instrument || msg.symbol;
  if (!name || msg.tipCheck) return [];
  return [`Why is ${name} moving today?`, `${name} trend this month`, `Compare ${name} and NIFTY`];
};

const promptPresets = [
  "Why is Reliance moving today?",
  "IOC price today",
  "Compare TCS and Infosys",
  "How has BEL performed this month?",
  "What's NIFTY doing today?",
  "Why is gold moving?",
  "Give me today's top 10 gainers",
];

const SingleQuoteCard = ({ quote }) => {
  if (!quote) return null;
  const isUSD = quote.currency === 'USD';
  const sym = isUSD ? '$' : '₹';
  const isPos = Number(quote.dayChangePercent || 0) >= 0;

  return (
    <div className="assistant-quote-card">
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

const AskAssistant = ({ isOpen, onToggle, initialPrompt }) => {
  const { language } = useContext(UserContext);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [conversation, setConversation] = useState([]);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (!isOpen) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onToggle(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onToggle]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
      scrollToBottom();
    }
  }, [isOpen]);

  useEffect(() => {
    scrollToBottom();
  }, [conversation, loading]);

  const handleSubmit = async (textToSubmit) => {
    const q = (textToSubmit || question).trim();
    if (!q || loading) return;

    const userMsg = { sender: 'user', text: q, time: new Date() };
    setConversation((prev) => [...prev, userMsg]);
    setQuestion('');
    setLoading(true);

    const conversationHistory = conversation.map((msg) => ({
      role: msg.sender,
      text: msg.text,
      symbol: msg.quote?.symbol || msg.symbol,
      instrument: msg.quote?.instrument || msg.instrument,
    }));

    try {
      const response = await askService.askQuestion(q, language || 'en', conversationHistory);
      const answerText = response?.answer || 'Market data is currently unavailable. Please try again shortly.';
      setConversation((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: answerText,
          quote: response?.quote || null,
          quotes: response?.quotes || null,
          scorecard: response?.scorecard || null,
          tipCheck: response?.tipCheck || null,
          source: response?.answerSource || null,
          symbol: response?.symbol || null,
          instrument: response?.instrument || null,
          time: new Date(),
        },
      ]);
    } catch (err) {
      setConversation((prev) => [
        ...prev,
        {
          sender: 'assistant',
          text: 'We could not retrieve the latest market data right now. Please verify your connection.',
          time: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Pages can open the assistant with a ready question ("Ask StockSee about X")
  const lastPromptId = useRef(null);
  useEffect(() => {
    if (isOpen && initialPrompt?.text && initialPrompt.id !== lastPromptId.current) {
      lastPromptId.current = initialPrompt.id;
      handleSubmit(initialPrompt.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialPrompt]);

  return (
    <>
      {/* Floating Trigger Button */}
      <button
        type="button"
        className={`floating-assistant-btn ${isOpen ? 'active' : ''}`}
        onClick={onToggle}
        aria-label="Ask StockSee Assistant"
        title="Ask StockSee AI Assistant"
      >
        <Sparkles size={15} className="assistant-btn-sparkle" />
        <span className="assistant-btn-text">✦ StockSee</span>
      </button>

      {/* Backdrop for Mobile Bottom Sheet */}
      {isOpen && (
        <div className="assistant-sheet-backdrop" onClick={onToggle} />
      )}

      {/* Slide-Up Bottom Sheet (Mobile) / Floating Panel (Desktop) */}
      {isOpen && (
        <aside className="floating-assistant-panel" aria-label="StockSee Assistant Modal">
          {/* Mobile Drag Indicator Handle */}
          <div className="sheet-drag-handle" />

          {/* Header */}
          <div className="assistant-panel-header">
            <div className="assistant-panel-title">
              <span className="assistant-dot"></span>
              <span className="serif-title assistant-heading-title">✦ StockSee</span>
              <span className="assistant-badge">Companion</span>
            </div>
            <button
              type="button"
              className="assistant-close-btn"
              onClick={onToggle}
              aria-label="Close Assistant"
            >
              <X size={18} />
            </button>
          </div>

          {/* Assistant Body / Messages Area */}
          <div className="assistant-panel-body">
            {conversation.length === 0 ? (
              <div className="assistant-intro">
                <div className="assistant-intro-header">
                  <span className="assistant-intro-star">✦</span>
                  <span className="serif-title assistant-intro-brand">StockSee</span>
                </div>
                <p className="assistant-intro-headline">
                  Your vernacular market companion.
                </p>
                <p className="assistant-intro-subtext">
                  Ask in English, हिन्दी, or ગુજરાતી about Indian stocks, Nifty/Sensex, gold, crude oil, or gainers/losers. Paste a stock tip you received and I&apos;ll check it for pump-and-dump warning signs.
                </p>

                <div className="assistant-presets-section">
                  <span className="presets-label">Suggested Inquiries:</span>
                  <div className="assistant-preset-chips">
                    {promptPresets.map((preset, idx) => (
                      <button
                        key={idx}
                        type="button"
                        className="assistant-preset-btn"
                        onClick={() => handleSubmit(preset)}
                      >
                        &ldquo;{preset}&rdquo;
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="assistant-messages">
                {conversation.map((msg, idx) => (
                  <div key={idx} className={`assistant-msg-bubble ${msg.sender}`}>
                    <div className="msg-sender-label">
                      {msg.sender === 'user' ? 'You' : '✦ StockSee'}
                    </div>

                    {/* Tip Check result card */}
                    {msg.tipCheck && <TipCheckResult result={msg.tipCheck} compact />}

                    {/* Factual price snapshot (no recommendations) */}
                    {msg.scorecard && <StockScorecard scorecard={msg.scorecard} />}

                    {/* Grounded Single Quote Card (if no scorecard) */}
                    {msg.quote && !msg.scorecard && <SingleQuoteCard quote={msg.quote} />}

                    {/* Grounded Multiple Quotes List */}
                    {msg.quotes && Array.isArray(msg.quotes) && (
                      <div className="assistant-quotes-list">
                        {msg.quotes.map((q, qIdx) => (
                          <SingleQuoteCard key={qIdx} quote={q} />
                        ))}
                      </div>
                    )}

                    {/* Zero-Leak Markdown Explanation Content */}
                    {!msg.tipCheck && (
                      <div className="msg-content">
                        {msg.sender === 'assistant' ? renderMarkdown(msg.text) : msg.text}
                      </div>
                    )}

                    {msg.sender === 'assistant' && msg.source && (
                      <div className="answer-meta">
                        <span className={`source-badge ${msg.source === 'gemini' || msg.source === 'groq' ? 'verified' : ''}`}>
                          <ShieldCheck size={10} aria-hidden="true" /> {SOURCE_LABEL[msg.source] || msg.source}
                        </span>
                      </div>
                    )}

                    {msg.sender === 'assistant' && idx === conversation.length - 1 && !loading && followUpsFor(msg).length > 0 && (
                      <div className="followup-chips" role="group" aria-label="Follow-up questions">
                        {followUpsFor(msg).map((f) => (
                          <button key={f} type="button" className="followup-chip" onClick={() => handleSubmit(f)}>{f}</button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {loading && (
                  <div className="assistant-msg-bubble assistant loading">
                    <Loader2 size={15} className="spinner" />
                    <span>Checking live NSE/BSE data…</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          {/* Form Input Footer */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSubmit();
            }}
            className="assistant-panel-footer"
          >
            <div className="assistant-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="assistant-input"
                placeholder="Ask about a stock, or paste a tip to check…"
                aria-label="Ask StockSee"
                maxLength={500}
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                disabled={loading}
              />
              <button
                type="submit"
                className="assistant-send-btn"
                disabled={!question.trim() || loading}
                title="Send Question"
                aria-label="Send"
              >
                {loading ? <Loader2 size={14} className="spinner" /> : <Send size={14} />}
              </button>
            </div>
            <div className="assistant-compliance-note">
              <ShieldCheck size={11} className="compliance-shield" />
              <span>Educational market context only. Not SEBI investment advice.</span>
            </div>
          </form>
        </aside>
      )}
    </>
  );
};

export default AskAssistant;
