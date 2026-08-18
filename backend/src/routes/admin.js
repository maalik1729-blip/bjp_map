import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import { requireAdmin, requireRole } from '../middleware/adminAuth.js'
import multer from 'multer'
import {
  postLogin, getSession, postLogout,
  getDashboardStats, getReports, getApplications, getApplicationDetail,
  updateApplication, deleteApplication,
  updateApplicationPhoto, updateApplicationMembershipId,
  getDistrictAnalytics,
} from '../controllers/adminController.js'

const router = Router()
const upload = multer({ limits: { fileSize: 15 * 1024 * 1024 } })

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please try again later.' },
})

router.post('/login', loginLimiter, postLogin)
router.get('/session', requireAdmin, getSession)
router.post('/logout', postLogout)

router.get('/stats', requireAdmin, getDashboardStats)
router.get('/reports', requireAdmin, getReports)
router.get('/applications', requireAdmin, getApplications)
router.get('/applications/:id', requireAdmin, getApplicationDetail)

// ── Application Management Suite (Edit & Delete protected by RBAC) ──
router.put('/applications/:id', requireAdmin, requireRole(['super_admin', 'state_admin']), updateApplication)
router.delete('/applications/:id', requireAdmin, requireRole(['super_admin', 'state_admin']), deleteApplication)

router.post('/applications/:id/photo', requireAdmin, upload.single('file'), updateApplicationPhoto)
router.post('/applications/:id/membership', requireAdmin, updateApplicationMembershipId)
router.get('/district-analytics', requireAdmin, getDistrictAnalytics)

export default router
