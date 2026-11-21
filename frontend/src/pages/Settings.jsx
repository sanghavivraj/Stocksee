import { useContext, useState, useEffect } from 'react';
import { tr } from '../utils/uiStrings';
import {
  Sun,
  Moon,
  ExternalLink,
  CheckCircle2,
  MessageSquare,
} from 'lucide-react';
import { UserContext } from '../context/UserContext';
import telegramService from '../services/telegramService';
import { t } from '../utils/i18n';

const Settings = () => {
  const { visitor, language, updateUserLanguage, theme, toggleTheme, addToast, refreshVisitor } = useContext(UserContext);
  const [selectedLang, setSelectedLang] = useState(language || 'en');
  const [saving, setSaving] = useState(false);

  const [telegram, setTelegram] = useState(visitor?.telegram || { connected: false });
  const [waitingForTelegram, setWaitingForTelegram] = useState(false);
  const [linking, setLinking] = useState(false);

  // After opening the bot, poll until the account is linked (max 15 min, the link's lifetime)
  useEffect(() => {
    if (!waitingForTelegram) return undefined;
    const startedAt = Date.now();
    const interval = setInterval(async () => {
      try {
        const status = await telegramService.status();
        if (status.connected) {
          setTelegram(status);
          setWaitingForTelegram(false);
          refreshVisitor().catch(() => {});
          addToast('Telegram connected 🎉', 'info');
        }
      } catch {
        // keep polling
      }
      if (Date.now() - startedAt > 15 * 60 * 1000) setWaitingForTelegram(false);
    }, 3000);
    return () => clearInterval(interval);
  }, [waitingForTelegram, refreshVisitor, addToast]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateUserLanguage(selectedLang);
      addToast('Preferences saved successfully', 'info');
    } catch (err) {
      addToast('Failed to save preferences', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleConnectTelegram = async () => {
    // Open the tab synchronously (inside the click) so pop-up blockers allow it, then point it at the bot
    const tab = window.open('', '_blank');
    setLinking(true);
    try {
      const { botUrl } = await telegramService.createLink();
      if (tab) {
        tab.opener = null;
        tab.location.href = botUrl;
      } else {
        window.location.href = botUrl;
      }
      setWaitingForTelegram(true);
      if (!visitor) refreshVisitor().catch(() => {}); // first save from this browser
    } catch (err) {
      tab?.close();
      addToast(err.userMessage || 'Could not start Telegram connection', 'error');
    } finally {
      setLinking(false);
    }
  };

  const handleDisconnectTelegram = async () => {
    try {
      await telegramService.unlink();
      setTelegram({ connected: false });
      refreshVisitor().catch(() => {});
      addToast('Telegram disconnected', 'info');
    } catch (err) {
      addToast(err.userMessage || 'Could not disconnect Telegram', 'error');
    }
  };

  const previewTexts = {
    en: 'Daily 8:30 AM market intelligence and automated price triggers are active in English.',
    hi: 'दैनिक सुबह 8:30 बजे का बाजार विश्लेषण और मूल्य अलर्ट हिन्दी में सक्रिय हैं।',
    gu: 'દૈનિક સવારે 8:30 વાગ્યાનું બજાર વિશ્લેષણ અને ભાવ અલર્ટ્સ ગુજરાતીમાં સક્રિય છે.',
  };

  return (
    <div className="editorial-page-container">
      {/* Page Header */}
      <header className="editorial-lead-header">
        <div className="lead-meta-row">
          <span className="editorial-kicker">{tr("APPLICATION PREFERENCES", language)}</span>
          <span className="lead-date-stamp">{tr("Profile & Language Config", language)}</span>
        </div>
        <h1 className="lead-headline">{t('settings', language)}</h1>
        <p className="lead-description">
          {tr("Customize your display language, appearance theme, and Telegram Bot companion synchronization.", language)}
        </p>
      </header>

      <form onSubmit={handleSave} className="settings-page-form">
        {/* Vernacular Language Preference */}
        <section className="editorial-flow-section" aria-label="Language Preferences">
          <div className="flow-section-header">
            <div>
              <span className="flow-kicker">{tr("VERNACULAR LOCALIZATION", language)}</span>
              <h3 className="flow-title">{tr("Primary Display Language", language)}</h3>
            </div>
          </div>

          <div className="settings-card">
            <p className="settings-card-intro">
              {tr("Select your preferred language for the Daily Market Brief, conversational explanations, and Telegram push updates.", language)}
            </p>

            <div className="language-options-grid">
              {[
                { code: 'en', label: 'English', desc: 'Default Indian market terminology' },
                { code: 'hi', label: 'हिन्दी (Hindi)', desc: 'सरल एवं स्पष्ट वित्तीय शब्दावली' },
                { code: 'gu', label: 'ગુજરાતી (Gujarati)', desc: 'વેપાર અને રોકાણની માતૃભાષા' },
              ].map((lang) => {
                const isSelected = selectedLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setSelectedLang(lang.code)}
                    className={`language-selection-card ${isSelected ? 'active' : ''}`}
                  >
                    <div className="lang-card-header">
                      <span className="lang-name">{lang.label}</span>
                      {isSelected && <CheckCircle2 size={16} className="lang-check-icon" />}
                    </div>
                    <span className="lang-desc">{lang.code === 'en' ? tr(lang.desc, language) : lang.desc}</span>
                  </button>
                );
              })}
            </div>

            <div className="settings-preview-banner">
              <span className="preview-label">{tr("Live Preview:", language)}</span>
              <span className="preview-content">{previewTexts[selectedLang]}</span>
            </div>
          </div>
        </section>

        {/* Appearance Theme */}
        <section className="editorial-flow-section" aria-label="Theme Preferences">
          <div className="flow-section-header">
            <div>
              <span className="flow-kicker">{tr("VISUAL IDENTITY", language)}</span>
              <h3 className="flow-title">{tr("Appearance Theme", language)}</h3>
            </div>
          </div>

          <div className="settings-card">
            <div className="theme-options-grid">
              <button
                type="button"
                onClick={() => theme !== 'light' && toggleTheme()}
                className={`theme-selection-card ${theme === 'light' ? 'active' : ''}`}
              >
                <Sun size={20} className="theme-option-icon" />
                <div className="theme-option-info">
                  <span className="theme-option-title">{tr("Aubergine & Warm Cream (Light)", language)}</span>
                  <span className="theme-option-desc">{tr("Deep aubergine navigation with warm cream paper canvas", language)}</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => theme !== 'dark' && toggleTheme()}
                className={`theme-selection-card ${theme === 'dark' ? 'active' : ''}`}
              >
                <Moon size={20} className="theme-option-icon" />
                <div className="theme-option-info">
                  <span className="theme-option-title">{tr("Night: Aubergine & Amber (Dark)", language)}</span>
                  <span className="theme-option-desc">{tr("Deep aubergine background with warm cream text and amber accents, easy on the eyes at night", language)}</span>
                </div>
              </button>
            </div>
          </div>
        </section>

        {/* Telegram Companion Sync - One-Click Deep Link */}
        <section className="editorial-flow-section" aria-label="Telegram Sync">
          <div className="flow-section-header">
            <div>
              <span className="flow-kicker">{tr("ONE-CLICK TELEGRAM INTEGRATION", language)}</span>
              <h3 className="flow-title">{tr("Telegram Financial Companion", language)}</h3>
            </div>
          </div>

          <div className="settings-card highlight">
            <div className="telegram-sync-layout">
              <div className="telegram-info">
                <div className="telegram-badge-row">
                  <h4 className="telegram-handle">{tr("StockSee Telegram bot", language)}</h4>
                  {telegram.connected ? (
                    <span className="telegram-status-pill" style={{ background: 'rgba(30,138,79,0.15)', color: 'var(--fg-positive)' }}>
                      CONNECTED{telegram.username ? ` • @${telegram.username}` : ''}
                    </span>
                  ) : waitingForTelegram ? (
                    <span className="telegram-status-pill" style={{ background: 'rgba(255, 185, 56, 0.15)', color: 'var(--fg-accent)' }}>
                      {tr("WAITING FOR TELEGRAM…", language)}
                    </span>
                  ) : (
                    <span className="telegram-status-pill" style={{ background: 'var(--fg-border-subtle)', color: 'var(--fg-text-muted)' }}>
                      {tr("NOT CONNECTED", language)}
                    </span>
                  )}
                </div>
                <p className="telegram-desc">
                  {telegram.connected
                    ? tr('You will receive the 8:30 AM morning brief (weekdays), your price alerts and a Monday watchlist digest on Telegram.', language)
                    : waitingForTelegram
                      ? tr('Telegram opened in a new tab. Tap “Start” in the bot chat to finish connecting — this page updates automatically.', language)
                      : tr('Get the 8:30 AM morning brief, your price alerts and a weekly watchlist digest on Telegram. Click below, then tap “Start” in Telegram. The secure link expires after 15 minutes.', language)}
                </p>
                {telegram.connected && telegram.linkedAt && (
                  <div style={{ marginTop: '0.4rem', fontSize: '0.78rem', color: 'var(--fg-positive)', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} />
                    <span>Connected on {new Date(telegram.linkedAt).toLocaleDateString('en-IN')}</span>
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
                {telegram.connected ? (
                  <button type="button" onClick={handleDisconnectTelegram} className="btn-editorial btn-editorial-secondary">
                    {tr("Disconnect", language)}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleConnectTelegram}
                    disabled={linking}
                    className="btn-editorial btn-editorial-primary telegram-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
                  >
                    <MessageSquare size={15} />
                    <span>{linking ? tr('Opening…', language) : waitingForTelegram ? tr('Open Telegram again', language) : tr('Connect Telegram', language)}</span>
                    <ExternalLink size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Save Preferences Button */}
        <div className="settings-submit-row">
          <button
            type="submit"
            disabled={saving}
            className="btn-editorial btn-editorial-primary settings-save-btn"
          >
            <span>{saving ? tr('Saving...', language) : tr('Save Preferences', language)}</span>
          </button>
        </div>
      </form>
    </div>
  );
};

export default Settings;