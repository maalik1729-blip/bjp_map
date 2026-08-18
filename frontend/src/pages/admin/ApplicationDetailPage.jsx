import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { admin } from '../../api'
import EditApplicationModal from '../../components/EditApplicationModal'
import DeleteConfirmModal from '../../components/DeleteConfirmModal'
import '../../styles/admin.css'

function DetailRow({ icon, label, value }) {
  if (value === undefined || value === null || value === '') return null
  return (
    <div className="detail-row">
      <div className="detail-label-col">
        {icon && <i className={`bi bi-${icon} me-1.5 text-saffron`} />}
        <span>{label}</span>
      </div>
      <div className="detail-value-col">{value}</div>
    </div>
  )
}

function DetailSection({ title, icon, children }) {
  return (
    <div className="admin-card detail-card">
      <div className="admin-card-header">
        <h6 className="admin-card-title">
          <i className={`bi bi-${icon} text-saffron`} /> {title}
        </h6>
      </div>
      <div className="detail-card-body">{children}</div>
    </div>
  )
}

export default function ApplicationDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [app, setApp] = useState(null)
  const [userRole, setUserRole] = useState('district_admin')
  const [showEditModal, setShowEditModal] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)

  const reloadApp = () => {
    setLoading(true)
    admin
      .getApplication(id)
      .then((res) => setApp(res.application))
      .catch((err) => setError(err?.message || 'Failed to load application details.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    reloadApp()
    admin.getSession()
      .then((res) => {
        if (res.success) setUserRole(res.role || 'super_admin')
      })
      .catch(() => {})
  }, [id])

  const canEditOrDelete = userRole === 'super_admin' || userRole === 'state_admin'

  const handlePrint = () => {
    window.print()
  }

  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoError, setPhotoError] = useState('')

  const [isEditingMembership, setIsEditingMembership] = useState(false)
  const [membershipInput, setMembershipInput] = useState('')
  const [savingMembership, setSavingMembership] = useState(false)
  const [membershipMsg, setMembershipMsg] = useState('')

  const handleSaveMembership = async () => {
    if (!membershipInput.trim()) return
    setSavingMembership(true)
    setMembershipMsg('')
    try {
      const res = await admin.updateMembershipId(id, membershipInput.trim())
      if (res?.success && res?.membership_id) {
        setApp((prev) => ({ ...prev, membership_id: res.membership_id }))
        setIsEditingMembership(false)
        setMembershipMsg('✅ BJP Membership ID updated successfully.')
      } else {
        setMembershipMsg(`❌ ${res?.message || 'Failed to update Membership ID.'}`)
      }
    } catch (err) {
      setMembershipMsg(`❌ ${err?.message || 'Error updating Membership ID.'}`)
    } finally {
      setSavingMembership(false)
    }
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingPhoto(true)
    setPhotoError('')
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await admin.updatePhoto(id, formData)
      if (res?.success && res?.photo_url) {
        setApp((prev) => ({ ...prev, photo_url: res.photo_url }))
      } else {
        setPhotoError(res?.message || 'Failed to upload photo.')
      }
    } catch (err) {
      setPhotoError(err?.message || 'Error uploading photo.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
        <div className="spinner-border text-warning" role="status" style={{ width: '3rem', height: '3rem' }} />
      </div>
    )
  }

  if (error || !app) {
    return (
      <div className="admin-detail-view">
        <button
          type="button"
          className="btn-back"
          onClick={() => navigate('/admin/applications')}
        >
          <i className="bi bi-arrow-left" /> Back to Registry
        </button>
        <div className="empty-state">
          <i className="bi bi-exclamation-triangle-fill text-warning" />
          <p>{error || 'Application record not found.'}</p>
        </div>
      </div>
    )
  }

  const v = app.voter || {}
  const lb = app.local_body || {}
  const social = app.social_media || {}
  const prefs = app.position_preferences || []

  return (
    <div className="admin-detail-view">
      {/* Header Bar */}
      <div className="page-header detail-header-bar">
        <div>
          <button
            type="button"
            className="btn-back"
            onClick={() => navigate('/admin/applications')}
          >
            <i className="bi bi-arrow-left" /> Back to Applications Registry
          </button>
          <div className="detail-title-group">
            <h1 className="monospace-title">{app.application_id}</h1>
            <span className="submission-time-badge">
              <i className="bi bi-calendar3 me-1" />
              Submitted on{' '}
              {app.submitted_at
                ? new Date(app.submitted_at).toLocaleString('en-IN', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : '—'}
            </span>
          </div>
        </div>

        <div className="detail-actions d-flex align-items-center gap-2 flex-wrap">
          {canEditOrDelete && (
            <>
              <button
                type="button"
                className="btn btn-outline-primary fw-semibold px-3"
                style={{ borderRadius: 8, fontSize: 13 }}
                onClick={() => setShowEditModal(true)}
              >
                ✏️ Edit Details
              </button>
              <button
                type="button"
                className="btn btn-outline-danger fw-semibold px-3"
                style={{ borderRadius: 8, fontSize: 13 }}
                onClick={() => setShowDeleteModal(true)}
              >
                🗑️ Delete
              </button>
            </>
          )}
          <button type="button" className="btn-print-card" onClick={handlePrint}>
            <i className="bi bi-printer-fill" /> Print Record
          </button>
          <span className="status-verified-pill">
            <i className="bi bi-shield-check" /> Verified Candidate
          </span>
        </div>
      </div>

      {/* Hero Overview Card */}
      <div className="admin-card candidate-hero-card">
        <div className="candidate-hero-body">
          <div className="candidate-avatar-large">
            <img
              src={app.photo_url || app.photoUrl || '/bjp_logo.png'}
              alt="Candidate Avatar"
              style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 15%' }}
              onError={(e) => { e.target.onerror = null; e.target.src = '/bjp_logo.png' }}
            />
          </div>

          <div className="candidate-hero-info">
            <h2>{v.name || 'Candidate Application'}</h2>
            <div className="candidate-meta-pills">
              {v.district && <span className="meta-pill"><i className="bi bi-geo-alt-fill" /> {v.district} District</span>}
              {app.membership_id && <span className="meta-pill membership"><i className="bi bi-card-text" /> Membership #{app.membership_id}</span>}
              {app.mobile && <span className="meta-pill mobile"><i className="bi bi-telephone-fill" /> {app.mobile}</span>}
              <span className={`meta-pill body-type ${app.body_type}`}>
                {app.body_type === 'urban' ? '🏙️ Urban Body' : '🌾 Rural Panchayat'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid of Sections */}
      <div className="detail-cards-grid">
        {/* Personal & Voter Info */}
        <DetailSection title="Personal & Voter Details" icon="person-badge-fill">
          <DetailRow icon="person" label="Candidate Name" value={v.name} />
          <DetailRow icon="people" label="Relation Name" value={v.relation_name} />
          <DetailRow icon="gender-ambiguous" label="Age / Gender" value={[v.age, v.gender].filter(Boolean).join(' / ')} />
          <DetailRow icon="card-text" label="EPIC Number" value={app.epic_no || v.epic_no} />
          <DetailRow icon="building" label="Assembly Constituency" value={[v.assembly_name, v.assembly_no].filter(Boolean).join(' — ') || v.assembly_no} />
          <DetailRow icon="geo-alt" label="District" value={v.district} />
          <DetailRow icon="signpost-2" label="Part / Booth" value={[v.part_no, v.booth_name].filter(Boolean).join(' — ')} />
          <div className="detail-row" style={{ alignItems: 'flex-start' }}>
            <div className="detail-label-col">
              <i className="bi bi-shield-lock me-1.5 text-saffron" />
              <span>BJP Membership ID</span>
            </div>
            <div className="detail-value-col" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
              {isEditingMembership ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: '100%', marginTop: 4 }}>
                  <input
                    type="text"
                    value={membershipInput}
                    onChange={(e) => setMembershipInput(e.target.value)}
                    placeholder="Enter BJP Membership ID"
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      border: '1.5px solid #FF6600',
                      fontSize: 13,
                      fontWeight: 600,
                      outline: 'none',
                      minWidth: 200,
                      background: '#fff'
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleSaveMembership}
                    disabled={savingMembership || !membershipInput.trim()}
                    style={{
                      background: '#FF6600',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer'
                    }}
                  >
                    {savingMembership ? 'Saving...' : 'Save ID'}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setIsEditingMembership(false); setMembershipMsg('') }}
                    disabled={savingMembership}
                    style={{
                      background: '#f3f4f6',
                      color: '#4b5563',
                      border: '1px solid #d1d5db',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontWeight: 700, color: app.membership_id ? '#10B981' : '#F59E0B' }}>
                    {app.membership_id || 'Not Set'}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setMembershipInput(app.membership_id || '')
                      setIsEditingMembership(true)
                      setMembershipMsg('')
                    }}
                    style={{
                      background: 'rgba(255, 102, 0, 0.1)',
                      color: '#FF6600',
                      border: '1px solid rgba(255, 102, 0, 0.3)',
                      borderRadius: 6,
                      padding: '3px 10px',
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4
                    }}
                  >
                    <i className="bi bi-pencil-square" />
                    {app.membership_id ? 'Edit ID' : 'Add Membership ID'}
                  </button>
                </div>
              )}
              {membershipMsg && <div style={{ fontSize: 12, marginTop: 4 }}>{membershipMsg}</div>}
            </div>
          </div>
        </DetailSection>

        {/* Candidate Passport Photo */}
        <DetailSection title="Candidate Passport Photo" icon="person-bounding-box">
          <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
            <div style={{
              width: 120,
              height: 150,
              borderRadius: 12,
              overflow: 'hidden',
              border: '2.5px solid #FF6600',
              boxShadow: '0 6px 16px rgba(255,102,0,0.22)',
              background: '#f8fafc',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img
                src={app.photo_url || app.photoUrl || '/bjp_logo.png'}
                alt="Candidate Passport Photo"
                style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center 15%', display: 'block' }}
                onError={(e) => { e.target.onerror = null; e.target.src = '/bjp_logo.png' }}
              />
            </div>
            <div>
              {app.photo_url || app.photoUrl ? (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#10B981', marginBottom: 8 }}>
                  <i className="bi bi-check-circle-fill me-1" /> Passport Photo Uploaded
                </div>
              ) : (
                <div style={{ fontSize: 13, fontWeight: 700, color: '#F59E0B', marginBottom: 8 }}>
                  <i className="bi bi-exclamation-circle-fill me-1" /> Photo Pending
                </div>
              )}

              <label className="btn-print-card" style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <i className={`bi ${uploadingPhoto ? 'bi-hourglass-split' : 'bi-camera-fill'}`} />
                {uploadingPhoto ? 'Uploading Photo...' : (app.photo_url || app.photoUrl ? 'Change Candidate Photo' : 'Upload Candidate Photo')}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  disabled={uploadingPhoto}
                  style={{ display: 'none' }}
                />
              </label>

              {(app.photo_url || app.photoUrl) && (
                <div>
                  <a
                    href={app.photo_url || app.photoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-link"
                    style={{ fontSize: 13, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <i className="bi bi-box-arrow-up-right" /> View High-Res Image
                  </a>
                </div>
              )}
              {photoError && <div style={{ fontSize: 12, color: '#EF4444', marginTop: 4 }}>{photoError}</div>}
            </div>
          </div>
        </DetailSection>

        {/* Candidate Pitch Video */}
        {(app.video_url || app.videoUrl) && (
          <DetailSection title="Candidate Pitch Video (1 Min)" icon="camera-video-fill">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {((app.video_url || app.videoUrl).includes('res.cloudinary.com') || (app.video_url || app.videoUrl).match(/\.(mp4|webm|m4v|mov)$/i)) ? (
                <video
                  src={app.video_url || app.videoUrl}
                  controls
                  controlsList="nodownload"
                  style={{ width: '100%', maxHeight: 360, borderRadius: 10, background: '#000' }}
                />
              ) : (
                <div style={{ background: 'rgba(255,102,0,0.06)', border: '1.5px solid #FF6600', borderRadius: 10, padding: 14 }}>
                  <div style={{ fontWeight: 700, color: '#FF6600', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <i className="bi bi-play-circle-fill" style={{ fontSize: 20 }} /> Candidate External Pitch Video Link:
                  </div>
                  <a
                    href={app.video_url || app.videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-link"
                    style={{ fontSize: 14, fontWeight: 700, wordBreak: 'break-all' }}
                  >
                    {app.video_url || app.videoUrl} <i className="bi bi-box-arrow-up-right ms-1" />
                  </a>
                </div>
              )}
            </div>
          </DetailSection>
        )}

        {/* Local Body & Position Preferences */}
        <DetailSection title="Local Body & Position Preferences" icon="building-fill">
          <DetailRow icon="diagram-3" label="Body Type" value={app.body_type === 'urban' ? 'Urban (Corporation / Municipality)' : 'Rural (Panchayat Union / Village)'} />
          {app.body_type === 'urban' && (
            <>
              <DetailRow icon="building" label="Urban Body Type" value={lb.local_body_type} />
              <DetailRow icon="geo" label="Local Body Name" value={lb.local_body} />
              <DetailRow icon="hash" label="Ward / Division" value={lb.ward} />
            </>
          )}
          {app.body_type === 'rural' && (
            <>
              <DetailRow icon="signpost-split" label="Panchayat Union" value={lb.panchayat_union} />
              <DetailRow icon="tree" label="Village Panchayat" value={lb.village_panchayat} />
              <DetailRow icon="hash" label="Ward / Area" value={lb.ward} />
            </>
          )}
          {prefs.map((p, i) => (
            <DetailRow
              key={i}
              icon="trophy"
              label={`${['1st', '2nd', '3rd'][i] || `${i + 1}th`} Preferred Position`}
              value={p}
            />
          ))}
        </DetailSection>

        {/* Social Media Channels */}
        <DetailSection title="Official Social Media Handles" icon="share-fill">
          {['facebook', 'instagram', 'twitter', 'youtube'].map((k) =>
            social[k] ? (
              <div key={k} className="social-detail-item">
                <span className="social-label">
                  <i className={`bi bi-${k === 'twitter' ? 'twitter-x' : k} me-1.5`} />
                  {k.toUpperCase()}
                </span>
                <a
                  href={social[k]}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="social-link"
                >
                  {social[k]} <i className="bi bi-box-arrow-up-right ms-1" />
                </a>
              </div>
            ) : null
          )}
        </DetailSection>

        {/* Experience & Local Area Understanding */}
        <DetailSection title="Work & Experience" icon="briefcase-fill">
          <div className="text-content-box">{app.work_experience || 'No work experience specified.'}</div>
        </DetailSection>

        <DetailSection title="Local Area Understanding & Vision" icon="chat-left-text-fill">
          <div className="text-content-box">{app.local_area_understanding || 'No local area understanding specified.'}</div>
        </DetailSection>

        {app.development_priorities && (
          <DetailSection title="Key Ward Development Priorities" icon="list-stars">
            <div className="text-content-box">{app.development_priorities}</div>
          </DetailSection>
        )}

        {app.grievance_plan && (
          <DetailSection title="Constituent Grievance Redressal Plan" icon="chat-left-dots-fill">
            <div className="text-content-box">{app.grievance_plan}</div>
          </DetailSection>
        )}

        {app.document_url && (
          <DetailSection title="Supporting Candidate Document (PDF/DOCX)" icon="file-earmark-pdf-fill">
            <a href={app.document_url} target="_blank" rel="noopener noreferrer" className="social-link" style={{ fontSize: 14, fontWeight: 700 }}>
              <i className="bi bi-file-earmark-arrow-down-fill me-1" /> Open / Download Supporting Document <i className="bi bi-box-arrow-up-right ms-1" />
            </a>
          </DetailSection>
        )}

        {app.organiser_message?.text && (
          <DetailSection title="Organiser Reach Out Message (One-Time Candidate Query)" icon="chat-square-quote-fill">
            <div className="text-content-box" style={{ borderLeft: '4px solid #FF6600', background: 'rgba(255,102,0,0.06)' }}>
              <div style={{ fontWeight: 700, color: '#FF6600', marginBottom: 4 }}>
                <i className="bi bi-person-fill me-1" /> Message to Local BJP Organiser:
              </div>
              <div style={{ fontSize: 14, whiteSpace: 'pre-wrap' }}>{app.organiser_message.text}</div>
              <div style={{ fontSize: 11, color: '#6B7280', marginTop: 8 }}>
                <i className="bi bi-clock-history me-1" />
                Sent on: {app.organiser_message.sent_at ? new Date(app.organiser_message.sent_at).toLocaleString('en-IN') : '—'}
              </div>
            </div>
          </DetailSection>
        )}
      </div>

      {/* Edit Application Modal */}
      {showEditModal && (
        <EditApplicationModal
          application={app}
          onClose={() => setShowEditModal(false)}
          onUpdated={reloadApp}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <DeleteConfirmModal
          application={app}
          onClose={() => setShowDeleteModal(false)}
          onDeleted={() => navigate('/admin/applications')}
        />
      )}
    </div>
  )
}


