import { AppShell } from './components/AppShell'
import { AppProvider } from './context/AppProvider'
import { useApp } from './context/appContext'
import { Landing } from './pages/Landing'
import { Login } from './pages/Login'
import { Signup } from './pages/Signup'

function Screen() {
  const { auth, route } = useApp()
  if (auth.loggedIn) return <AppShell />
  if (route === 'login') return <Login />
  if (route === 'signup') return <Signup />
  return <Landing />
}

export default function App() {
  return (
    <AppProvider>
      <Screen />
    </AppProvider>
  )
}
