import { useContext, useState, useEffect } from 'react';
import { UserContext } from '../context/UserContext';
import marketService from '../services/marketService';
import { t } from '../utils/i18n';
import FinGuruTheme from '../styles/FinGuruTheme';

const MarketBrief = () => {
  const { language } = useContext(UserContext);
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBrief = async () => {
      try {
        const res = await marketService.getMarketBrief();
        setBrief(res);
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };

    fetchBrief();
  }, []);

  if (loading) {
    return (
      <div style={{
        backgroundColor: 'var(--fg-surface)',
        borderRadius: FinGuruTheme.borders.radius,
        padding: FinGuruTheme.spacing.md,
        boxShadow: 'var(--shadow-sm)',
        border: '1px solid var(--fg-border)',
      }}>
        <div style={{ height: '20px', width: '80%', backgroundColor: 'var(--fg-border-subtle)' }}></div>
      </div>
    );
  }

  return (
    <div style={{
      backgroundColor: 'var(--fg-surface)',
      borderRadius: FinGuruTheme.borders.radius,
      padding: FinGuruTheme.spacing.md,
      boxShadow: 'var(--shadow-sm)',
      border: '1px solid var(--fg-border)',
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: FinGuruTheme.spacing.sm,
      }}>
        <span style={{
          fontSize: FinGuruTheme.typography.h3.fontSize,
          fontWeight: FinGuruTheme.typography.h3.fontWeight,
          color: 'var(--fg-text)',
        }}>Market Brief</span>
        <span style={{
          fontSize: FinGuruTheme.typography.small.fontSize,
          color: 'var(--fg-text-muted)',
        }}>
          {brief?.timestamp ? new Date(brief.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
        </span>
      </div>

      <div style={{
        marginBottom: FinGuruTheme.spacing.md,
        color: 'var(--fg-text-secondary)',
        lineHeight: FinGuruTheme.typography.body.lineHeight,
      }}>
        {brief?.content ? brief.content : t('marketBriefUnavailable', language)}
      </div>

      <div style={{ display: 'flex', gap: FinGuruTheme.spacing.md }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: FinGuruTheme.typography.small.fontSize, color: 'var(--fg-text-muted)' }}>NIFTY 50</div>
          <div style={{
            fontSize: FinGuruTheme.typography.body.fontSize,
            fontWeight: FinGuruTheme.typography.body.fontWeight,
            color: brief?.nifty50?.change >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)',
          }}>
            {brief?.nifty50?.value || '—'}
            {brief?.nifty50?.change !== undefined && (
              <span style={{ fontSize: FinGuruTheme.typography.small.fontSize, marginLeft: FinGuruTheme.spacing.xs }}>
                {brief.nifty50.change >= 0 ? '+' : ''}{brief.nifty50.change}%
              </span>
            )}
          </div>
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ fontSize: FinGuruTheme.typography.small.fontSize, color: 'var(--fg-text-muted)' }}>SENSEX</div>
          <div style={{
            fontSize: FinGuruTheme.typography.body.fontSize,
            fontWeight: FinGuruTheme.typography.body.fontWeight,
            color: brief?.sensex?.change >= 0 ? 'var(--fg-positive)' : 'var(--fg-negative)',
          }}>
            {brief?.sensex?.value || '—'}
            {brief?.sensex?.change !== undefined && (
              <span style={{ fontSize: FinGuruTheme.typography.small.fontSize, marginLeft: FinGuruTheme.spacing.xs }}>
                {brief.sensex.change >= 0 ? '+' : ''}{brief.sensex.change}%
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MarketBrief;