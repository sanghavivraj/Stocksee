// Static drawing of the opening animation (no user data goes in here). Elements are found by data-j in journeyEngine.js.
export default `<svg viewBox="0 0 360 640" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="jny-bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1f0f40"/><stop offset="1" stop-color="#0d0620"/></linearGradient>
    <radialGradient id="jny-rg"><stop data-j="rg0" offset="0" stop-color="#fff" stop-opacity="1"/><stop data-j="rg1" offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="jny-sunG"><stop offset="0" stop-color="#ffe9a0"/><stop offset=".55" stop-color="#ffc83d"/><stop offset="1" stop-color="#ffc83d" stop-opacity="0"/></radialGradient>
    <linearGradient id="jny-lineG" gradientUnits="userSpaceOnUse" x1="0" y1="200" x2="0" y2="480"><stop offset="0" stop-color="#3ee6a8"/><stop data-j="gA" offset=".46" stop-color="#3ee6a8"/><stop data-j="gB" offset=".46" stop-color="#ff6b6b"/><stop offset="1" stop-color="#ff6b6b"/></linearGradient>
    <linearGradient id="jny-tileG" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6dc7c"/><stop offset="1" stop-color="#D4AF37"/></linearGradient>
    <linearGradient id="jny-vigR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff2d2d" stop-opacity="0"/><stop offset="1" stop-color="#ff2d2d" stop-opacity=".55"/></linearGradient>
    <clipPath id="jny-tileClip"><rect x="-26" y="-66" width="52" height="52" rx="13"/></clipPath>
  </defs>

  <rect x="-1500" y="-800" width="3360" height="2240" fill="url(#jny-bg)"/>
  <g data-j="root">
    <g data-j="stars"></g>
    <circle data-j="sun" cx="180" cy="760" r="120" fill="url(#jny-sunG)" opacity="0"/>
    <rect data-j="vig" x="-1500" y="-800" width="3360" height="2240" fill="url(#jny-vigR)" opacity="0"/>
    <circle data-j="glow" cx="150" cy="390" r="150" fill="url(#jny-rg)" opacity=".5"/>

    <g data-j="world">
      <line data-j="base" x1="-400" x2="1200" y1="330" y2="330" stroke="#b9a9dd" stroke-width="1.4" stroke-dasharray="3 7" opacity=".55"/>
      <text data-j="entry" x="26" y="350" font-size="12" fill="#b9a9dd">entry</text>
      <path data-j="area" fill="url(#jny-lineG)" opacity=".16"/>
      <path data-j="lineGlow" fill="none" stroke="url(#jny-lineG)" stroke-width="12" stroke-linecap="round" stroke-linejoin="round" opacity=".18"/>
      <path data-j="line" fill="none" stroke="url(#jny-lineG)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
    </g>

    <g data-j="shards"></g><g data-j="dust"></g>

    <!-- the character: the StockSee tile -->
    <g data-j="who">
      <ellipse data-j="shadow" cx="0" cy="2" rx="26" ry="5" fill="#000" opacity=".3"/>
      <g data-j="legs"><rect data-j="legL" x="-14" y="-16" width="9" height="19" rx="4.5" fill="#b58a1e"/><rect data-j="legR" x="5" y="-16" width="9" height="19" rx="4.5" fill="#b58a1e"/></g>
      <g data-j="armL"><rect x="-8" y="-4" width="9" height="24" rx="4.5" fill="#b58a1e" transform="translate(-26 -42) translate(-1 0)"/></g>
      <g data-j="armR"><rect x="-1" y="-4" width="9" height="24" rx="4.5" fill="#b58a1e" transform="translate(26 -42)"/></g>
      <rect x="-26" y="-66" width="52" height="52" rx="13" fill="url(#jny-tileG)"/>
      <rect data-j="tint" x="-26" y="-66" width="52" height="52" rx="13" fill="#ff4d4d" opacity="0"/>
      <g clip-path="url(#jny-tileClip)"><rect data-j="shine" x="-60" y="-80" width="16" height="90" fill="#fff" opacity="0" transform="rotate(20)"/></g>
      <g data-j="ss" opacity="0"><text x="0" y="-27" font-size="30" font-weight="800" text-anchor="middle" fill="#2B1650" style="font-family:Fraunces,Georgia,'Times New Roman',serif">SS</text></g>
      <g data-j="face">
        <g fill="none" stroke="#2b1650" stroke-width="2.6" stroke-linecap="round"><path data-j="bl"/><path data-j="br"/></g>
        <g data-j="eW"><circle cx="-11" cy="-44" r="8.5" fill="#fff" stroke="#2b1650" stroke-width="1.6"/><circle cx="11" cy="-44" r="8.5" fill="#fff" stroke="#2b1650" stroke-width="1.6"/><circle cx="-10" cy="-44" r="4.2" fill="#2b1650"/><circle cx="12" cy="-44" r="4.2" fill="#2b1650"/><circle cx="-8.6" cy="-46" r="1.5" fill="#fff"/><circle cx="13.4" cy="-46" r="1.5" fill="#fff"/></g>
        <g data-j="eS"><circle cx="-11" cy="-43" r="3.6" fill="#2b1650"/><circle cx="11" cy="-43" r="3.6" fill="#2b1650"/><circle cx="-10" cy="-44.2" r="1.2" fill="#fff"/><circle cx="12" cy="-44.2" r="1.2" fill="#fff"/></g>
        <g data-j="eH" fill="none" stroke="#2b1650" stroke-width="3" stroke-linecap="round"><path d="M-17 -41q6-9 12 0"/><path d="M5 -41q6-9 12 0"/></g>
        <g data-j="eC" fill="none" stroke="#2b1650" stroke-width="3" stroke-linecap="round"><path d="M-17 -45q6 6 12 0"/><path d="M5 -45q6 6 12 0"/></g>
        <g data-j="eO"><circle cx="-11" cy="-44" r="6.6" fill="#fff" stroke="#2b1650" stroke-width="1.4"/><circle cx="11" cy="-44" r="6.6" fill="#fff" stroke="#2b1650" stroke-width="1.4"/><g data-j="look"><circle cx="-11" cy="-44" r="3.3" fill="#2b1650"/><circle cx="11" cy="-44" r="3.3" fill="#2b1650"/></g></g>
        <ellipse cx="-19" cy="-33" rx="4.4" ry="2.6" fill="#ff7a6b" opacity=".5"/><ellipse cx="19" cy="-33" rx="4.4" ry="2.6" fill="#ff7a6b" opacity=".5"/>
        <path data-j="sweat" d="M22 -62q-4 6 0 9q4-3 0-9z" fill="#8fb8ff" opacity="0"/>
        <path data-j="mouth" stroke="#5a1f1a" stroke-width="2.6" stroke-linecap="round"/>
      </g>
      <g data-j="spk" fill="#ffe9a0" opacity="0"><path d="M36 -70l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"/><path d="M-38 -60l1.6 4 4 1.6-4 1.6-1.6 4-1.6-4-4-1.6 4-1.6z"/></g>
    </g>

    <g data-j="conf"></g>

    <!-- words -->
    <g data-j="hud">
      <text data-j="cap1" x="180" y="58" font-size="16" font-weight="600" text-anchor="middle" fill="#f4efff" opacity="0"></text>
      <text data-j="cap2" x="180" y="80" font-size="16" font-weight="600" text-anchor="middle" fill="#f4efff" opacity="0"></text>
      <text data-j="portL" x="180" y="112" font-size="12" text-anchor="middle" fill="#b9a9dd">Portfolio · example</text>
      <text data-j="num" x="180" y="154" font-size="40" font-weight="800" text-anchor="middle" fill="#3ee6a8">+0.0%</text>
      <g data-j="dots"></g>
    </g>
    <g data-j="logoText" opacity="0">
      <text data-j="word" x="180" y="354" font-size="42" font-weight="700" text-anchor="middle" fill="#fff" style="font-family:Fraunces,Georgia,'Times New Roman',serif">StockSee</text>
      <text data-j="tag1" x="180" y="390" font-size="17" text-anchor="middle" fill="#e6dcff"></text>
      <text data-j="tag2" x="180" y="414" font-size="17" font-weight="700" text-anchor="middle" fill="#D4AF37"></text>
      <text data-j="end1" x="180" y="490" font-size="14.5" text-anchor="middle" fill="#cdbff0" opacity="0"></text>
      <text data-j="end2" x="180" y="510" font-size="14.5" text-anchor="middle" fill="#cdbff0" opacity="0"></text>
    </g>
    <rect data-j="flash" x="-1500" y="-800" width="3360" height="2240" fill="#ff3030" opacity="0"/>
    <text data-j="hint" x="180" y="630" font-size="12" text-anchor="middle" fill="#8f7fb8" opacity=".75"></text>
    <text data-j="foot" x="180" y="608" font-size="12" text-anchor="middle" fill="#9b8bc4"></text>
  </g>
</svg>`;
