import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { UserProvider } from './context/UserContext'
import { WatchlistProvider } from './context/WatchlistContext'
import './index.css'
import './styles/features.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <UserProvider>
      <WatchlistProvider>
        <App />
      </WatchlistProvider>
    </UserProvider>
  </React.StrictMode>,
)
