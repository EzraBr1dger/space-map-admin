import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import './Login.css';

function Register() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);
    const navigate = useNavigate();
    const auth = getAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (password !== confirm) {
            return setError('Passwords do not match');
        }

        if (password.length < 6) {
            return setError('Password must be at least 6 characters');
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            setSuccess(true);
            setTimeout(() => navigate('/login'), 3000);
        } catch (error) {
            if (error.code === 'auth/email-already-in-use') {
                setError('An account with this email already exists');
            } else {
                setError('Registration failed, please try again');
            }
        }
    };

    if (success) {
        return (
            <div className="login-container">
                <div className="login-box">
                    <h2 style={{ color: '#64ffda', textAlign: 'center' }}>Registered!</h2>
                    <p style={{ color: '#ffffff', textAlign: 'center', marginTop: '10px' }}>
                        Your account has been created. You will need to be assigned a role before you can access the dashboard. Redirecting to login...
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="login-container">
            <div className="login-box">
                <h2>Register</h2>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>
                    <div className="form-group">
                        <label>Confirm Password</label>
                        <input
                            type="password"
                            value={confirm}
                            onChange={(e) => setConfirm(e.target.value)}
                            required
                        />
                    </div>
                    {error && <div className="error">{error}</div>}
                    <button type="submit">Register</button>
                    <button
                        type="button"
                        onClick={() => navigate('/login')}
                        style={{ marginTop: '10px', background: 'transparent', border: '1px solid #64ffda', color: '#64ffda' }}
                    >
                        Back to Login
                    </button>
                </form>
            </div>
        </div>
    );
}

export default Register;