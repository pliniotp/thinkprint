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

// Registration component.  Handles a multi‑step signup flow: first
// collect the phone number, then capture a selfie using the camera.
// Event details (name, phrase and logo) are fetched via the public
// endpoint so they can be displayed before the user registers.
function Register({ eventId }) {
  const [step, setStep] = useState('phone'); // 'phone', 'camera', 'done'
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [useFrontCamera, setUseFrontCamera] = useState(true);
  const videoRef = React.useRef(null);
  const streamRef = React.useRef(null);
  const [eventInfo, setEventInfo] = useState(null);
  const [loadingEvent, setLoadingEvent] = useState(true);
  const [eventError, setEventError] = useState('');

  // Fetch event info on mount
  useEffect(() => {
    async function fetchEvent() {
      try {
        const res = await fetch(`${API_BASE}/public/events/${eventId}`);
        const data = await res.json();
        if (res.ok) {
          setEventInfo(data);
        } else {
          setEventError(data.error || 'Evento não encontrado');
        }
      } catch (err) {
        console.error(err);
        setEventError('Erro de conexão ao carregar evento');
      } finally {
        setLoadingEvent(false);
      }
    }
    fetchEvent();
  }, [eventId]);

  // Start camera
  async function startCamera(front) {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    try {
      const constraints = {
        video: { facingMode: front ? 'user' : { exact: 'environment' } },
        audio: false,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (err) {
      console.error('Erro ao acessar câmera', err);
      setMessage('Não foi possível acessar a câmera. Verifique as permissões.');
    }
  }

  // Handle phone submission
  function handlePhoneSubmit(e) {
    e.preventDefault();
    if (!phone) return;
    setStep('camera');
    startCamera(useFrontCamera);
  }

  // Toggle front/back camera
  function handleToggleCamera() {
    const newFront = !useFrontCamera;
    setUseFrontCamera(newFront);
    startCamera(newFront);
  }

  // Capture selfie and submit
  async function handleCapture() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(async (blob) => {
      if (!blob) {
        setMessage('Erro ao capturar selfie');
        return;
      }
      setSubmitting(true);
      const formData = new FormData();
      formData.append('event_id', eventId);
      formData.append('phone', phone);
      const file = new File([blob], 'selfie.jpg', { type: 'image/jpeg' });
      formData.append('selfie', file);
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
        setStep('done');
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
          streamRef.current = null;
        }
      }
    }, 'image/jpeg');
  }

  // Render phone step
  if (step === 'phone') {
    return (
      <div style={styles.centered}>
        {loadingEvent ? (
          <p>Carregando evento...</p>
        ) : eventError ? (
          <p>{eventError}</p>
        ) : (
          <>
            {eventInfo?.logo_url ? (
              <img src={eventInfo.logo_url} alt="Logo" style={{ maxWidth: '60%', marginBottom: '1rem' }} />
            ) : (
              <img src="/logo_commemorative.png" alt="ThinkPrint" style={{ maxWidth: '60%', marginBottom: '1rem' }} />
            )}
            <h1>{eventInfo?.name || 'Cadastro'}</h1>
            {eventInfo?.phrase && <p style={{ marginBottom: '1rem' }}>{eventInfo.phrase}</p>}
          </>
        )}
        <form onSubmit={handlePhoneSubmit} style={styles.form}>
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
          <button type="submit" style={styles.button}>Continuar</button>
        </form>
      </div>
    );
  }
  // Camera step
  if (step === 'camera') {
    return (
      <div style={styles.centered}>
        <h1>Selfie</h1>
        <div style={{ position: 'relative' }}>
          <video
            ref={videoRef}
            autoPlay
            playsInline
            style={{ width: '100%', borderRadius: '8px' }}
          />
          <button
            type="button"
            onClick={handleToggleCamera}
            style={{ position: 'absolute', bottom: '8px', right: '8px', backgroundColor: '#fff', border: 'none', padding: '0.5rem', borderRadius: '50%', cursor: 'pointer' }}
          >
            🔄
          </button>
        </div>
        <button
          type="button"
          onClick={handleCapture}
          style={{ ...styles.button, marginTop: '1rem' }}
          disabled={submitting}
        >
          {submitting ? 'Enviando...' : 'Capturar e Enviar'}
        </button>
        {message && <p style={{ marginTop: '1rem' }}>{message}</p>}
      </div>
    );
  }
  // Done step
  return (
    <div style={styles.centered}>
      {message ? <p>{message}</p> : <p>Perfeito! Cadastro realizado. Você receberá em minutos seu vídeo ou foto por WhatsApp ou SMS.</p>}
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
      <img
        src="/logo_traditional.jpeg"
        alt="ThinkPrint"
        style={{ maxWidth: '60%', marginBottom: '1rem' }}
      />
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
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)',
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
    margin: '2rem auto',
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)',
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