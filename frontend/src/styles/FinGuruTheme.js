const FinGuruTheme = {
  colors: {
    primary: '#2E1A47',      // nav, hero band, tab bar
    primarySoft: '#3F2760',  // tiles on the dark band
    accent: '#FFB938',       // CTAs, badges, active states
    accentText: '#8A4F00',   // links on cream, 5.3:1 contrast
    background: '#FFF7EA',   // warm cream
    surface: '#FFFFFF',
    surfaceMuted: '#3F2760', // dark band tiles
    border: '#E8D9BF',
    borderSubtle: '#F2E6D2',
    text: '#2E1A47',
    textSecondary: '#5E4A78',
    textMuted: '#7D6A94',

    // on cream / light cards
    positive: '#1E8A4F',
    positiveBg: '#E7F6ED',
    negative: '#C73535',
    negativeBg: '#FDECEE',

    // on aubergine / dark band
    positiveOnDark: '#6BE59A',
    negativeOnDark: '#FF8A8A',
  },

  gradients: {
    hero: 'linear-gradient(135deg, #2E1A47 0%, #3F2760 100%)',
    cta: 'linear-gradient(135deg, #FFB938 0%, #FFCA65 100%)',
  },

  charts: {
    series: ['#2E1A47', '#FFB938', '#5E4A78', '#6BE59A'],
    grid: '#E8D9BF',
  },

  typography: {
    fontFamily: "'Inter', -apple-system, sans-serif",
    serifFamily: "'Newsreader', Georgia, serif",
    monoFamily: "'JetBrains Mono', monospace",
    h1: { fontSize: '2rem', fontWeight: 800, lineHeight: 1.2 },
    h2: { fontSize: '1.5rem', fontWeight: 700, lineHeight: 1.3 },
    h3: { fontSize: '1.2rem', fontWeight: 700, lineHeight: 1.4 },
    body: { fontSize: '0.95rem', fontWeight: 400, lineHeight: 1.6 },
    small: { fontSize: '0.8rem', fontWeight: 500, lineHeight: 1.4 },
  },

  spacing: { xs: '0.25rem', sm: '0.5rem', md: '1rem', lg: '1.5rem', xl: '2rem' },
  borders: { radius: '8px', radiusMd: '12px', radiusLg: '16px', width: '1px', style: 'solid' },
  shadows: {
    card: '0 4px 16px rgba(46, 26, 71, 0.06)',
    lift: '0 8px 24px rgba(46, 26, 71, 0.12)',
  },

  buttons: {
    primary: { backgroundColor: '#2E1A47', color: '#FFFFFF', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 700 },
    cta: { backgroundColor: '#FFB938', color: '#2E1A47', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 700 },
    secondary: { backgroundColor: '#FFFFFF', color: '#2E1A47', border: '1px solid #E8D9BF', borderRadius: '8px', padding: '0.6rem 1.2rem', fontWeight: 600 },
  },

  cards: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D9BF',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(46, 26, 71, 0.06)',
    padding: '1.25rem',
  },

  inputs: {
    backgroundColor: '#FFFFFF',
    border: '1px solid #E8D9BF',
    borderRadius: '8px',
    padding: '0.6rem 0.9rem',
    fontSize: '0.92rem',
    color: '#2E1A47',
    focusRing: '0 0 0 3px rgba(46, 26, 71, 0.25)',
  },

  dark: {
    background: '#0F131A',       // light black / refined dark obsidian
    surface: '#171C26',          // elevated light black card surface
    surfaceMuted: '#1E2433',     // secondary dark tier
    primary: '#10B981',          // vibrant emerald growth
    accent: '#10B981',           // emerald accent
    text: '#F1F5F9',             // clean off-white
    textSecondary: '#94A3B8',    // cool slate silver
    textMuted: '#64748B',        // muted slate
    positive: '#22C55E',         // vivid profit green
    negative: '#F87171',         // subtle, restrained coral red (used sparingly for deltas)
    border: '#262E3D',           // sleek charcoal-slate border
  },
};

export default FinGuruTheme;