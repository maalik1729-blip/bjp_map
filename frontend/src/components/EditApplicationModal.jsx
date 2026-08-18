import { useState } from 'react'
import { admin } from '../api'

export default function EditApplicationModal({ application, onClose, onUpdated }) {
  const [formData, setFormData] = useState({
    name: application.voter?.name || '',
    gender: application.voter?.gender || 'Male',
    age: application.voter?.age || '',
    mobile: application.mobile || '',
    epic_no: application.epic_no || '',
    membership_id: application.membership_id || '',
    district: application.voter?.district || application.local_body?.district || '',
    assembly_name: application.voter?.assembly_name || '',
    body_type: application.body_type || 'urban',
    local_body_type: application.local_body?.local_body_type || 'Municipality',
    local_body: application.local_body?.local_body || '',
    ward: application.local_body?.ward || '',
    positions: (application.position_preferences || []).join(', '),
    work_experience: application.work_experience || '',
    ward_strategy: application.ward_strategy || '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      mobile: formData.mobile,
      epic_no: formData.epic_no,
      membership_id: formData.membership_id,
      body_type: formData.body_type,
      voter: {
        name: formData.name,
        gender: formData.gender,
        age: Number(formData.age) || null,
        district: formData.district,
        assembly_name: formData.assembly_name,
      },
      local_body: {
        district: formData.district,
        local_body_type: formData.local_body_type,
        local_body: formData.local_body,
        ward: formData.ward,
      },
      position_preferences: formData.positions
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean),
      work_experience: formData.work_experience,
      ward_strategy: formData.ward_strategy,
    }

    try {
      await admin.updateApplication(application.application_id, payload)
      onUpdated && onUpdated()
      onClose && onClose()
    } catch (err) {
      setError(err.message || 'Failed to update application. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      className="modal show d-block"
      style={{ background: 'rgba(0, 0, 0, 0.65)', zIndex: 1060 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
        <div className="modal-content shadow-lg border-0" style={{ borderRadius: 16 }}>
          <div
            className="modal-header text-white"
            style={{ background: 'linear-gradient(135deg, #f76201, #e05500)', borderTopLeftRadius: 16, borderTopRightRadius: 16 }}
          >
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: 20 }}>✏️</span>
              <h5 className="modal-title mb-0 fw-bold">Edit Candidate Application</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body p-4">
              <div className="alert alert-light border mb-4 d-flex justify-content-between align-items-center">
                <div>
                  <div className="text-muted small">Application ID</div>
                  <strong className="text-primary">{application.application_id}</strong>
                </div>
                <div>
                  <div className="text-muted small">Current Status</div>
                  <span className="badge bg-success text-uppercase">{application.status || 'Submitted'}</span>
                </div>
              </div>

              {error && <div className="alert alert-danger py-2">{error}</div>}

              {/* ── Candidate Details ───────────────────────── */}
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">👤 Candidate & Voter Info</h6>
              <div className="row g-3 mb-4">
                <div className="col-md-6">
                  <label className="form-label small fw-semibold">Candidate Full Name *</label>
                  <input
                    type="text"
                    name="name"
                    className="form-control"
                    value={formData.name}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Gender</label>
                  <select name="gender" className="form-select" value={formData.gender} onChange={handleChange}>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Age</label>
                  <input
                    type="number"
                    name="age"
                    className="form-control"
                    value={formData.age}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Mobile Number *</label>
                  <input
                    type="tel"
                    name="mobile"
                    className="form-control"
                    value={formData.mobile}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">EPIC / Voter ID *</label>
                  <input
                    type="text"
                    name="epic_no"
                    className="form-control text-uppercase"
                    value={formData.epic_no}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">BJP Membership ID</label>
                  <input
                    type="text"
                    name="membership_id"
                    className="form-control text-uppercase"
                    value={formData.membership_id}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ── Location & Local Body ────────────────────── */}
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">📍 Local Body & Ward Assignment</h6>
              <div className="row g-3 mb-4">
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">District *</label>
                  <input
                    type="text"
                    name="district"
                    className="form-control"
                    value={formData.district}
                    onChange={handleChange}
                    required
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Assembly Constituency</label>
                  <input
                    type="text"
                    name="assembly_name"
                    className="form-control"
                    value={formData.assembly_name}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Body Category</label>
                  <select name="body_type" className="form-select" value={formData.body_type} onChange={handleChange}>
                    <option value="urban">Urban (நகர்ப்புறம்)</option>
                    <option value="rural">Rural (ஊரகப் பகுதி)</option>
                  </select>
                </div>
                <div className="col-md-4">
                  <label className="form-label small fw-semibold">Local Body Type</label>
                  <input
                    type="text"
                    name="local_body_type"
                    className="form-control"
                    placeholder="Corporation / Municipality / Panchayat Union"
                    value={formData.local_body_type}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-5">
                  <label className="form-label small fw-semibold">Local Body Name / Zone</label>
                  <input
                    type="text"
                    name="local_body"
                    className="form-control"
                    value={formData.local_body}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-md-3">
                  <label className="form-label small fw-semibold">Ward No.</label>
                  <input
                    type="text"
                    name="ward"
                    className="form-control"
                    value={formData.ward}
                    onChange={handleChange}
                  />
                </div>
              </div>

              {/* ── Position & Strategy ─────────────────────── */}
              <h6 className="fw-bold text-dark border-bottom pb-2 mb-3">🗳️ Contest Preferences & Notes</h6>
              <div className="row g-3">
                <div className="col-12">
                  <label className="form-label small fw-semibold">Position Preferences (comma separated)</label>
                  <input
                    type="text"
                    name="positions"
                    className="form-control"
                    placeholder="Ward Councillor, Municipal Chairman, Mayor"
                    value={formData.positions}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Work Experience / Track Record</label>
                  <textarea
                    name="work_experience"
                    className="form-control"
                    rows="2"
                    value={formData.work_experience}
                    onChange={handleChange}
                  />
                </div>
                <div className="col-12">
                  <label className="form-label small fw-semibold">Ward Campaign Strategy</label>
                  <textarea
                    name="ward_strategy"
                    className="form-control"
                    rows="2"
                    value={formData.ward_strategy}
                    onChange={handleChange}
                  />
                </div>
              </div>
            </div>

            <div className="modal-footer bg-light px-4 py-3">
              <button type="button" className="btn btn-secondary px-4" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button
                type="submit"
                className="btn btn-primary px-4 fw-bold"
                style={{ background: '#f76201', borderColor: '#f76201' }}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    Saving Changes…
                  </>
                ) : (
                  '💾 Save Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
