import { useEffect, useState } from 'react'
import { StoreProvider, useStore } from './services/store'
import Auth from './pages/Auth'
import Public from './pages/Public'
import Workspace from './Workspace'

function Router() {
  const { user } = useStore()
  const [hash, setHash] = useState(location.hash)
  useEffect(() => {
    const h = () => setHash(location.hash)
    window.addEventListener('hashchange', h)
    return () => window.removeEventListener('hashchange', h)
  }, [])
  const m = hash.match(/^#\/p\/([^/]+)/)
  if (m) return <Public slug={m[1]} />
  return user ? <Workspace /> : <Auth />
}

export default function App() {
  return (
    <StoreProvider>
      <Router />
    </StoreProvider>
  )
}
