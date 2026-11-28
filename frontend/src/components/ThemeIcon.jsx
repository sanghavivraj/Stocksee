/** The half-filled circle on the light / dark button. It turns half a circle when the theme changes. */
export default function ThemeIcon({ dark }) {
  return (
    <svg className={`theme-icon ${dark ? 'is-dark' : ''}`} viewBox="0 0 240 240" fill="none" aria-hidden="true" focusable="false">
      <g className="theme-icon-core">
        <path d="M120 67.5C149.25 67.5 172.5 90.75 172.5 120C172.5 149.25 149.25 172.5 120 172.5" fill="#fff" />
        <path d="M120 67.5C90.75 67.5 67.5 90.75 67.5 120C67.5 149.25 90.75 172.5 120 172.5" fill="#000" />
      </g>
      <path className="theme-icon-ring" d="M120 3.75C55.5 3.75 3.75 55.5 3.75 120C3.75 184.5 55.5 236.25 120 236.25C184.5 236.25 236.25 184.5 236.25 120C236.25 55.5 184.5 3.75 120 3.75ZM120 214.5V172.5C90.75 172.5 67.5 149.25 67.5 120C67.5 90.75 90.75 67.5 120 67.5V25.5C172.5 25.5 214.5 67.5 214.5 120C214.5 172.5 172.5 214.5 120 214.5Z" fill="#fff" />
    </svg>
  );
}
