import { useStore } from './services/store'
import AdminDashboard from './pages/AdminDashboard'
import UserWorkspace from './pages/UserWorkspace'

export default function Workspace() {
  const { user } = useStore()
  if (!user) return null
  return user.role === 'Administrator' ? <AdminDashboard /> : <UserWorkspace />
}
