import { useState } from 'react'
import { admin } from '../api'

export default function DeleteConfirmModal({ application, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')

  const handleDelete = async () => {
    setDeleting(true)
    setError('')
    try {
      await admin.deleteApplication(application.application_id)
      onDeleted && onDeleted()
      onClose && onClose()
    } catch (err) {
      setError(err.message || 'Failed to delete application. Please try again.')
      setDeleting(false)
    }
  }

  return (
    <div
      className="modal show d-block"
      style={{ background: 'rgba(0, 0, 0, 0.7)', zIndex: 1070 }}
      tabIndex="-1"
    >
      <div className="modal-dialog modal-dialog-centered" style={{ maxWidth: 460 }}>
        <div className="modal-content border-0 shadow-lg" style={{ borderRadius: 16 }}>
          <div className="modal-header bg-danger text-white" style={{ borderTopLeftRadius: 16, borderTopRightRadius: 16 }}>
            <div className="d-flex align-items-center gap-2">
              <span style={{ fontSize: 22 }}>⚠️</span>
              <h5 className="modal-title mb-0 fw-bold">Confirm Deletion</h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onClose}
              aria-label="Close"
            />
          </div>

          <div className="modal-body p-4 text-center">
            <div
              className="mx-auto mb-3 d-flex align-items-center justify-content-center bg-danger-subtle text-danger rounded-circle"
              style={{ width: 64, height: 64, fontSize: 28 }}
            >
              🗑️
            </div>

            <h5 className="fw-bold mb-2">Delete Candidate Application?</h5>
            <p className="text-muted small mb-3">
              This action is permanent and cannot be undone. All candidate information and files associated with this application will be removed.
            </p>

            <div className="alert alert-light border text-start p-3 mb-0">
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted small">Application ID:</span>
                <strong className="text-primary">{application.application_id}</strong>
              </div>
              <div className="d-flex justify-content-between mb-1">
                <span className="text-muted small">Candidate:</span>
                <strong>{application.voter?.name || 'N/A'}</strong>
              </div>
              <div className="d-flex justify-content-between">
                <span className="text-muted small">District:</span>
                <span>{application.voter?.district || application.local_body?.district || 'N/A'}</span>
              </div>
            </div>

            {error && <div className="alert alert-danger py-2 mt-3 mb-0 text-start">{error}</div>}
          </div>

          <div className="modal-footer bg-light px-4 py-3 justify-content-center gap-2">
            <button
              type="button"
              className="btn btn-secondary px-4 fw-semibold"
              onClick={onClose}
              disabled={deleting}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-danger px-4 fw-bold shadow-sm"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <span className="spinner-border spinner-border-sm me-2" role="status" />
                  Deleting…
                </>
              ) : (
                '🗑️ Yes, Delete'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
