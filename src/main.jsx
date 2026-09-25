import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { supabase } from './supabaseClient';

// Quick check to see if database is reachable
supabase.from('Roles').select('*').then(({ data, error }) => {
  if (error) console.error('Supabase Connection Error:', error.message);
  else console.log('Supabase Connected Successfully! Roles fetched:', data);
});
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
