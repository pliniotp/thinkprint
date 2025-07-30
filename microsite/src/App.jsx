import React, { useState, useEffect } from 'react';

// Base URL for backend API.  When deploying to Vercel the API is
// typically served from the same domain; during local development
// override with VITE_API_BASE_URL.
const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

// Determine if the current page is a gallery or registration page
function getGalleryToken() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[0] === 'gallery' && parts[1]) {
    return parts[1];
  }
  return null;
}

function getRegisterEvent() {
  const params = new URLSearchParams(window.location.search);
  return params.get('event');
}

// Registration component.  Handles the participant signup flow and
// submits the data to the backend.  After successful submission a
// confirmation message is displayed.
function Register({ eventId }) {
  const [phone, setPhone] = useState('');
  const [selfie, setSelfie] = useState(null);
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selfie) {
      setMessage('Por favor, selecione uma selfie.');
      return;
    }
    setSubmitting(true);
    const formData = new FormData();
    formData.append('event_id', eventId);
    formData.append('phone', phone);
    formData.append('selfie', selfie);
    try {
      const res = await fetch(`${API_BASE}/register`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
      } else {
        setMessage(data.error || 'Erro ao realizar cadastro');
      }
    } catch (err) {
      console.error(err);
      setMessage('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.centered}>
      <h1>Cadastro</h1>
      <form onSubmit={handleSubmit} style={styles.form}>
        <label>
          Telefone (com DDD)
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            style={styles.input}
            required
          />
        </label>
        <label>
          Selfie
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setSelfie(e.target.files[0])}
            style={styles.input}
            required
          />
        </label>
        <button type="submit" style={styles.button} disabled={submitting}>
          {submitting ? 'Enviando...' : 'Enviar'}
        </button>
      </form>
      {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
    </div>
  );
}

// Gallery component.  Fetches media associated with a participant and
// displays them.  Provides buttons to download all files and share via
// WhatsApp.  The gallery is lightweight and uses native elements for
// images and video playback.
function Gallery({ token }) {
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMedia() {
      try {
        const res = await fetch(`${API_BASE}/gallery/${token}`);
        const data = await res.json();
        if (res.ok) {
          setMedia(data.media || []);
        } else {
          setError(data.error || 'Erro ao carregar galeria');
        }
      } catch (err) {
        console.error(err);
        setError('Erro de conexão');
      } finally {
        setLoading(false);
      }
    }
    fetchMedia();
  }, [token]);

  function handleDownloadAll() {
    // For demonstration this will simply open each media in a new tab.
    media.forEach((item) => {
      const link = document.createElement('a');
      link.href = `${API_BASE}${item.url}`;
      link.download = item.filename;
      link.click();
    });
  }

  function handleShareWhatsApp() {
    const link = `${window.location.origin}/gallery/${token}`;
    const text = `Confira minhas fotos e vídeos do evento: ${link}`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }

  if (loading) return <p style={styles.centered}>Carregando...</p>;
  if (error) return <p style={styles.centered}>{error}</p>;
  return (
    <div style={styles.galleryContainer}>
      <header style={styles.galleryHeader}>
        <h2>Sua Galeria</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleDownloadAll} style={styles.button}>Baixar tudo</button>
          <button onClick={handleShareWhatsApp} style={{ ...styles.button, backgroundColor: '#25D366' }}>Compartilhar via WhatsApp</button>
        </div>
      </header>
      <div style={styles.mediaGrid}>
        {media.map((item) => {
          const fileUrl = `${API_BASE}${item.url}`;
          const isVideo = /\.mp4$|\.mov$|\.webm$/i.test(item.filename);
          return (
            <div key={item.upload_id} style={styles.mediaItem}>
              {isVideo ? (
                <video src={fileUrl} controls style={styles.mediaElement} />
              ) : (
                <img src={fileUrl} alt="media" style={styles.mediaElement} />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Root component deciding which view to render based on URL
export default function App() {
  const galleryToken = getGalleryToken();
  const registerEvent = getRegisterEvent();
  if (galleryToken) {
    return <Gallery token={galleryToken} />;
  }
  if (registerEvent) {
    return <Register eventId={registerEvent} />;
  }
  return (
    <div style={styles.centered}>
      <h1>ThinkPrint Galeria Facial</h1>
      <p>Por favor, abra o link que você recebeu por SMS ou WhatsApp para ver sua galeria ou realizar o cadastro.</p>
    </div>
  );
}

// Inline styles.  Using JS objects keeps this example self‑contained.
const styles = {
  centered: {
    maxWidth: '480px',
    margin: '2rem auto',
    textAlign: 'center',
    padding: '1rem',
    backgroundColor: '#fff',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  input: {
    padding: '0.6rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '0.6rem',
    fontSize: '1rem',
    border: 'none',
    borderRadius: '4px',
    backgroundColor: '#007bff',
    color: '#fff',
    cursor: 'pointer',
  },
  galleryContainer: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '1rem',
  },
  galleryHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  mediaGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
    gap: '0.5rem',
  },
  mediaItem: {
    overflow: 'hidden',
    borderRadius: '6px',
    backgroundColor: '#fff',
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  },
  mediaElement: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
};