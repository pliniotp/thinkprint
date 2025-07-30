import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Mount the React application onto the root element.  We use
// React.StrictMode to help catch potential issues during development.
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);