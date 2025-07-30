import React, { useState, useEffect } from 'react';

// Dashboard application component.  Handles admin login and event
// management via the backend API.  This is a simplified version of
// what a full dashboard might provide but demonstrates fetching
// protected resources, posting new events and rendering lists.

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
  }

  if (!token) {
    return (
      <div style={styles.container}>
        <h1>ThinkPrint Dashboard</h1>
        <form onSubmit={handleLogin} style={styles.form}>
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

  return (
    <div style={styles.container}> 
      <header style={styles.header}>
        <h2>Eventos</h2>
        <button onClick={logout} style={{ ...styles.button, backgroundColor: '#dc3545' }}>Sair</button>
      </header>
      <section>
        {events.length === 0 ? (
          <p>Nenhum evento cadastrado.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th>ID</th>
                <th>Nome</th>
                <th>Frase</th>
                <th>Expiração (dias)</th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td>{evt.id.slice(0, 8)}</td>
                  <td>{evt.name}</td>
                  <td>{evt.phrase}</td>
                  <td>{evt.expiration_days}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
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
            placeholder="Frase de cadastro"
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

const styles = {
  container: {
    maxWidth: '960px',
    margin: '0 auto',
    padding: '2rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
    maxWidth: '320px',
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
};