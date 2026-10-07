import { useStore } from './store'
import AdminDashboard from './AdminDashboard'
import UserWorkspace from './UserWorkspace'

export default function Workspace() {
  const { user } = useStore()
  return user?.role === 'Administrator' ? <AdminDashboard /> : <UserWorkspace />
}
