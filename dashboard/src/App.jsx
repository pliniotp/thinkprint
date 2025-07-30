import React, { useState, useEffect } from 'react';

// Dashboard component with login, event list and basic analytics.
// This version applies a translucent "iOS 26" inspired design.
// It uses the same backend API as the microsite and supports
// creating events, viewing a list of events and simple analytics for each event.

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

export default function App() {
  const [token, setToken] = useState(() => localStorage.getItem('tp_token'));
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);
  const [newEvent, setNewEvent] = useState({
    name: '',
    phrase: '',
    expiration_days: 30,
    logo_url: '',
  });
  // view can be 'events' or 'analytics'
  const [activeView, setActiveView] = useState('events');
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (token) {
      fetchEvents();
    }
  }, [token]);

  async function fetchEvents() {
    try {
      const res = await fetch(`${API_BASE}/events`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        throw new Error('Failed to fetch events');
      }
      const data = await res.json();
      setEvents(data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível obter os eventos');
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (res.ok) {
        localStorage.setItem('tp_token', data.token);
        setToken(data.token);
        setPassword('');
      } else {
        setError(data.error || 'Credenciais inválidas');
      }
    } catch (err) {
      console.error(err);
      setError('Erro de conexão');
    }
  }

  async function handleCreateEvent(e) {
    e.preventDefault();
    setError('');
    try {
      const res = await fetch(`${API_BASE}/events`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(newEvent),
      });
      const data = await res.json();
      if (res.ok) {
        setEvents((prev) => [...prev, data]);
        setNewEvent({ name: '', phrase: '', expiration_days: 30, logo_url: '' });
      } else {
        setError(data.error || 'Não foi possível criar o evento');
      }
    } catch (err) {
      console.error(err);
      setError('Erro ao criar evento');
    }
  }

  function logout() {
    localStorage.removeItem('tp_token');
    setToken(null);
    setEvents([]);
    setActiveView('events');
    setSelectedEvent(null);
    setAnalytics(null);
  }

  // Load basic analytics for an event (counts of uploads, photos, videos and participants)
  async function loadAnalytics(eventId) {
    setAnalytics(null);
    setSelectedEvent(eventId);
    setActiveView('analytics');
    try {
      const resEvt = await fetch(`${API_BASE}/events/${eventId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const evtData = await resEvt.json();
      const resUploads = await fetch(`${API_BASE}/events/${eventId}/uploads`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const uploadsData = await resUploads.json();
      const totalUploads = uploadsData.length || 0;
      let photos = 0;
      let videos = 0;
      uploadsData.forEach((u) => {
        if (/\.(mp4|mov|webm)$/i.test(u.filename)) {
          videos += 1;
        } else {
          photos += 1;
        }
      });
      const participantsCount = evtData.participants ? evtData.participants.length : 0;
      setAnalytics({
        event: evtData,
        totalUploads,
        photos,
        videos,
        participants: participantsCount,
      });
    } catch (err) {
      console.error(err);
      setAnalytics(null);
    }
  }

  // Login view
  if (!token) {
    return (
      <div style={styles.authContainer}>
        <img src="/logo_traditional.jpeg" alt="ThinkPrint" style={{ maxWidth: '50%', marginBottom: '1rem' }} />
        <h1>ThinkPrint Dashboard</h1>
        <form onSubmit={handleLogin} style={styles.authForm}>
          <label>
            Usuário
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              required
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <button type="submit" style={styles.button}>Entrar</button>
        </form>
      </div>
    );
  }

  // Event list view
  function EventList() {
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h2>Eventos</h2>
          <button onClick={logout} style={{ ...styles.button, backgroundColor: '#dc3545' }}>Sair</button>
        </header>
        {events.length === 0 ? (
          <p>Nenhum evento cadastrado.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Frase</th>
                <th>Expiração</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.id.slice(0, 8)}</td>
                  <td>{evt.name}</td>
                  <td>{evt.phrase}</td>
                  <td>{evt.expiration_days} dias</td>
                  <td>
                    <button onClick={() => loadAnalytics(evt.id)} style={{ ...styles.button, padding: '0.3rem 0.5rem', fontSize: '0.8rem' }}>
                      Ver
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <section style={{ marginTop: '2rem' }}>
          <h3>Criar novo evento</h3>
          <form onSubmit={handleCreateEvent} style={styles.formInline}>
            <input
              type="text"
              placeholder="Nome"
              value={newEvent.name}
              onChange={(e) => setNewEvent({ ...newEvent, name: e.target.value })}
              style={styles.input}
              required
            />
            <input
              type="text"
              placeholder="Frase"
              value={newEvent.phrase}
              onChange={(e) => setNewEvent({ ...newEvent, phrase: e.target.value })}
              style={styles.input}
            />
            <input
              type="number"
              placeholder="Expiração (dias)"
              value={newEvent.expiration_days}
              onChange={(e) => setNewEvent({ ...newEvent, expiration_days: parseInt(e.target.value) || 30 })}
              style={{ ...styles.input, width: '120px' }}
            />
            <input
              type="url"
              placeholder="Logo URL (opcional)"
              value={newEvent.logo_url}
              onChange={(e) => setNewEvent({ ...newEvent, logo_url: e.target.value })}
              style={styles.input}
            />
            <button type="submit" style={styles.button}>Criar</button>
          </form>
          {error && <p style={styles.error}>{error}</p>}
        </section>
      </div>
    );
  }

  // Analytics view
  function AnalyticsView() {
    if (!analytics) {
      return (
        <div style={styles.container}>
          <p>Carregando estatísticas...</p>
        </div>
      );
    }
    const evt = analytics.event;
    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <h2>{evt.name}</h2>
          <div>
            <button onClick={() => setActiveView('events')} style={{ ...styles.button, marginRight: '0.5rem' }}>
              Voltar
            </button>
            <button onClick={logout} style={{ ...styles.button, backgroundColor: '#dc3545' }}>Sair</button>
          </div>
        </header>
        <div style={styles.analyticsGrid}>
          <div style={styles.analyticsCard}>
            <h3>Total de Uploads</h3>
            <p>{analytics.totalUploads}</p>
          </div>
          <div style={styles.analyticsCard}>
            <h3>Fotos</h3>
            <p>{analytics.photos}</p>
          </div>
          <div style={styles.analyticsCard}>
            <h3>Vídeos</h3>
            <p>{analytics.videos}</p>
          </div>
          <div style={styles.analyticsCard}>
            <h3>Participantes</h3>
            <p>{analytics.participants}</p>
          </div>
        </div>
      </div>
    );
  }

  return activeView === 'events' ? <EventList /> : <AnalyticsView />;
}

// Styles for the dashboard.  Emulates a light, translucent "glass" UI.
const styles = {
  container: {
    maxWidth: '960px',
    margin: '2rem auto',
    padding: '2rem',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  authContainer: {
    maxWidth: '480px',
    margin: '2rem auto',
    textAlign: 'center',
    padding: '2rem',
    backgroundColor: 'rgba(255,255,255,0.35)',
    borderRadius: '16px',
    boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.3)',
  },
  authForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    alignItems: 'stretch',
  },
  formInline: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    alignItems: 'flex-end',
  },
  input: {
    padding: '0.5rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
  },
  button: {
    padding: '0.6rem 1rem',
    fontSize: '1rem',
    backgroundColor: '#007bff',
    color: '#fff',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  error: {
    color: '#dc3545',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  analyticsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '1rem',
    marginTop: '1rem',
  },
  analyticsCard: {
    padding: '1rem',
    backgroundColor: 'rgba(255,255,255,0.45)',
    borderRadius: '12px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.1)',
    textAlign: 'center',
  },
};