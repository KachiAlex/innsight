import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { api } from '../lib/api';
import { Button, Field, TextInput } from '../components/ui';
import styles from './AuthPage.module.css';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const setAuth = useAuthStore((state) => state.setAuth);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await api.post('/auth/login', { email, password });
      const { token, refreshToken, user } = response.data.data;
      setAuth(token, refreshToken, user);

      navigate(user.role === 'iitech_admin' ? '/superadmin-dashboard' : '/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandMark}>In</div>
          <h1 className={styles.brandName}>InnSight</h1>
          <p className={styles.brandSub}>Sign in to your property</p>
        </div>

        <form onSubmit={handleSubmit} className="stack" style={{ gap: 'var(--space-3)' }}>
          <Field label="Email" required>
            <TextInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </Field>
          <Field label="Password" required>
            <TextInput
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </Field>

          {error && <div className={styles.errorBox} role="alert">{error}</div>}

          <Button variant="primary" type="submit" loading={loading} block>
            Sign in
          </Button>
        </form>

        <p className={styles.footer}>Hotel staff sign in here · Guests use the property portal</p>
      </div>
    </div>
  );
}
