export function DistrictTooltip({ tooltip }) {
  if (!tooltip || !tooltip.visible) return null

  return (
    <div
      className="tn-map-tooltip"
      style={{
        position: 'absolute',
        left: tooltip.x + 14,
        top: tooltip.y - 75,
        pointerEvents: 'none',
        zIndex: 1000,
        background: 'rgba(24, 25, 26, 0.95)',
        backdropFilter: 'blur(8px)',
        border: '1px solid rgba(247, 98, 1, 0.45)',
        borderRadius: 10,
        padding: '10px 14px',
        minWidth: 170,
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.3)',
        color: '#ffffff',
      }}
    >
      <div className="tn-tooltip-district" style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 4 }}>
        📍 {tooltip.district}
      </div>

      <div className="tn-tooltip-count" style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
        <span className="tn-tooltip-num" style={{ fontSize: 20, fontWeight: 800, color: '#f76201' }}>
          {tooltip.count.toLocaleString()}
        </span>
        <span className="tn-tooltip-label" style={{ fontSize: 12, opacity: 0.75 }}> applications</span>
      </div>

      {tooltip.lat && tooltip.lng && (
        <div style={{ fontSize: 10.5, color: '#90caf9', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>
          <span>🌐</span>
          <span style={{ fontWeight: 600 }}>{tooltip.lat}° N, {tooltip.lng}° E</span>
        </div>
      )}

      {tooltip.count === 0 && (
        <div className="tn-tooltip-empty" style={{ fontSize: 10.5, opacity: 0.55, fontStyle: 'italic', marginTop: 2 }}>
          No applications yet
        </div>
      )}
    </div>
  )
}
