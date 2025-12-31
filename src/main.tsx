import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Bytemd (Markdown editor) global styles
import 'bytemd/dist/index.css'
import 'github-markdown-css/github-markdown.css'
import 'katex/dist/katex.min.css'
import 'highlight.js/styles/github.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
