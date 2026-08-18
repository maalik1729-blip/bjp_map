export function DistrictTooltip({ tooltip }) {
  if (!tooltip || !tooltip.visible) return null

  return (
    <div
      className="tn-map-tooltip"
      style={{
        position: 'absolute',
        left: tooltip.x + 14,
        top: tooltip.y - 65,
        pointerEvents: 'none',
        zIndex: 1000,
      }}
    >
      <div className="tn-tooltip-district">📍 {tooltip.district}</div>
      <div className="tn-tooltip-count">
        <span className="tn-tooltip-num">{tooltip.count.toLocaleString()}</span>
        <span className="tn-tooltip-label"> applications</span>
      </div>
      {tooltip.count === 0 && (
        <div className="tn-tooltip-empty">No applications yet</div>
      )}
    </div>
  )
}
