import logoImg from '../assets/logo.png'

const SIZES = {
  sm: { img: 28, fontSize: 'text-base', gap: 1 },
  md: { img: 38, fontSize: 'text-xl',  gap: 2 },
  lg: { img: 56, fontSize: 'text-3xl', gap: 3 },
}

export default function BrandLogo({ size = 'md', showText = true, light = false }) {
  const s = SIZES[size] || SIZES.md
  return (
    <div className="inline-flex items-center" style={{ gap: s.gap }}>
      <img
        src={logoImg}
        alt="BHarath Health Systems logo"
        style={{ height: s.img, width: 'auto', flexShrink: 0 }}
      />
      {showText && (
        <span
          className={`font-extrabold leading-none ${s.fontSize}`}
          style={{ letterSpacing: '-0.02em' }}
        >
          <span style={{ color: '#CC1414' }}>BH</span>
          <span style={{ color: light ? '#ffffff' : '#0F2557' }}>arath Health Systems</span>
        </span>
      )}
    </div>
  )
}
