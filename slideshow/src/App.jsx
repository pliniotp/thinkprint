import React, { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function App() {
  const params = new URLSearchParams(window.location.search);
  const eventId = params.get('event');
  const [media, setMedia] = useState([]);
  const [current, setCurrent] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchMedia() {
      if (!eventId) {
        setError('Nenhum evento especificado');
        return;
      }
      try {
        const res = await fetch(`${API_BASE}/slideshow/${eventId}`);
        const data = await res.json();
        if (res.ok) {
          setMedia(data.media || []);
        } else {
          setError(data.error || 'Erro ao carregar mídia');
        }
      } catch (err) {
        console.error(err);
        setError('Erro de conexão');
      }
    }
    fetchMedia();
  }, [eventId]);

  useEffect(() => {
    if (media.length > 1) {
      const timer = setInterval(() => {
        setCurrent((prev) => (prev + 1) % media.length);
      }, 5000);
      return () => clearInterval(timer);
    }
  }, [media]);

  if (error) {
    return <div style={styles.center}><p style={{ color: '#fff' }}>{error}</p></div>;
  }
  if (!eventId) {
    return <div style={styles.center}><p style={{ color: '#fff' }}>Informe o parâmetro "event" na URL.</p></div>;
  }
  if (media.length === 0) {
    return <div style={styles.center}><p style={{ color: '#fff' }}>Nenhuma mídia encontrada para este evento.</p></div>;
  }
  const currentItem = media[current];
  const fileUrl = `${API_BASE}${currentItem.url}`;
  const isVideo = /\.mp4$|\.mov$|\.webm$/i.test(currentItem.filename);
  return (
    <div style={styles.container}>
      {isVideo ? (
        <video
          key={currentItem.upload_id}
          src={fileUrl}
          style={styles.media}
          autoPlay
          muted
          loop
        />
      ) : (
        <img key={currentItem.upload_id} src={fileUrl} alt="slide" style={styles.media} />
      )}
      <div style={styles.overlay}>{`${current + 1} / ${media.length}`}</div>
    </div>
  );
}

const styles = {
  container: {
    width: '100%',
    height: '100%',
    position: 'relative',
    overflow: 'hidden',
    backgroundColor: '#000',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  },
  media: {
    maxWidth: '100%',
    maxHeight: '100%',
    objectFit: 'contain',
  },
  overlay: {
    position: 'absolute',
    bottom: '1rem',
    right: '1rem',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    padding: '0.3rem 0.6rem',
    borderRadius: '4px',
    fontSize: '0.9rem',
  },
  center: {
    width: '100%',
    height: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
};