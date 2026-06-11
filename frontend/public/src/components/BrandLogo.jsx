import logoImg from '../assets/logo.png'

const SIZES = {
  sm: { img: 28, name: 'text-sm',  sub: 'text-[9px]' },
  md: { img: 38, name: 'text-lg',  sub: 'text-[10px]' },
  lg: { img: 56, name: 'text-2xl', sub: 'text-xs' },
}

export default function BrandLogo({ size = 'md', showText = true, light = false }) {
  const s = SIZES[size] || SIZES.md
  const nameColor = light ? '#ffffff' : '#0F2557'
  const subColor  = light ? 'rgba(255,255,255,0.7)' : '#6b7280'
  return (
    <div className="inline-flex items-center" style={{ gap: 4 }}>
      <img
        src={logoImg}
        alt="BharatHealth logo"
        style={{ height: s.img, width: 'auto', flexShrink: 0 }}
      />
      {showText && (
        <div className="flex flex-col leading-none" style={{ gap: 1 }}>
          <span
            className={`font-extrabold ${s.name}`}
            style={{ color: nameColor, letterSpacing: '-0.02em' }}
          >
            <span style={{ color: '#CC1414' }}>BHarath</span>{' '}Health
          </span>
          <span
            className={`italic ${s.sub} text-right`}
            style={{ color: subColor, letterSpacing: '0.04em' }}
          >
            Systems
          </span>
        </div>
      )}
    </div>
  )
}
