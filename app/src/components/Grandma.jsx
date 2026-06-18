// Grandma avatar — pure CSS/DOM (no raster), expression driven by tier 0..4
// (content → meltdown). A faithful-but-simplified take on the bundle's character;
// the full multi-layer div art can be ported screen-by-screen later.
export function Grandma({ tier = 0, accent = '#5fa552', scale = 1, shake = false }) {
  const browAngle = 9 + tier * 4.5;            // 9°..27° inward-down (README)
  const cheek = 0.18 + tier * 0.07;            // 0.18..0.46 alpha
  const smile = tier <= 1;                     // smile / flat / frown
  const flat = tier === 2;

  const S = (px) => px * scale;
  const wrap = { position: 'relative', width: S(120), height: S(140) };
  const head = {
    position: 'absolute', left: S(20), top: S(26), width: S(80), height: S(82),
    borderRadius: '50%', background: 'var(--skin)', border: `${S(2)}px solid var(--line)`,
  };
  const bun = {
    position: 'absolute', left: S(40), top: S(8), width: S(40), height: S(34),
    borderRadius: '50% 50% 45% 45%', background: 'var(--hair)', border: `${S(2)}px solid var(--line)`,
  };
  const hairSide = (left) => ({
    position: 'absolute', top: S(34), left: S(left), width: S(20), height: S(54),
    borderRadius: '50%', background: 'var(--hair)', border: `${S(2)}px solid var(--line)`, zIndex: 0,
  });
  const eye = (left) => ({
    position: 'absolute', top: S(58), left: S(left), width: S(9), height: S(9),
    borderRadius: '50%', background: '#3a2f28',
  });
  const glasses = (left) => ({
    position: 'absolute', top: S(52), left: S(left), width: S(22), height: S(20),
    borderRadius: '50%', border: `${S(2)}px solid #6b6b6b`, background: 'rgba(255,255,255,0.18)',
  });
  const brow = (left, dir) => ({
    position: 'absolute', top: S(46), left: S(left), width: S(20), height: S(4),
    borderRadius: S(3), background: 'var(--line)', transform: `rotate(${dir * browAngle}deg)`,
  });
  const nose = {
    position: 'absolute', top: S(66), left: S(55), width: S(10), height: S(12),
    borderRadius: '0 0 50% 50%', background: 'var(--skin-shade)',
  };
  const cheekDot = (left) => ({
    position: 'absolute', top: S(72), left: S(left), width: S(14), height: S(9),
    borderRadius: '50%', background: `rgba(206,74,56,${cheek})`,
  });
  const mouth = {
    position: 'absolute', top: S(86), left: S(48), width: S(24),
    border: `${S(2)}px solid var(--line)`,
    borderRadius: smile ? '0 0 60% 60%' : flat ? '4px' : '60% 60% 0 0',
    borderTopColor: smile ? 'transparent' : 'var(--line)',
    borderBottomColor: smile ? 'var(--line)' : flat ? 'var(--line)' : 'transparent',
    height: flat ? S(3) : S(12),
  };
  const body = {
    position: 'absolute', left: S(28), top: S(104), width: S(64), height: S(40),
    borderRadius: `${S(30)}px ${S(30)}px ${S(14)}px ${S(14)}px`,
    background: accent, border: `${S(2)}px solid var(--line)`, zIndex: -1,
  };

  return (
    <div className={shake ? '' : 'breathe'} style={wrap}>
      <div style={{ ...wrap, animation: shake ? 'pulse 0.5s linear infinite' : undefined }}>
        <div style={hairSide(18)} />
        <div style={hairSide(82)} />
        <div style={bun} />
        <div style={head} />
        <div style={glasses(34)} />
        <div style={glasses(64)} />
        <div style={eye(42)} />
        <div style={eye(70)} />
        <div style={brow(36, -1)} />
        <div style={brow(66, 1)} />
        <div style={cheekDot(34)} />
        <div style={cheekDot(74)} />
        <div style={nose} />
        <div style={mouth} />
        <div style={body} />
      </div>
    </div>
  );
}
