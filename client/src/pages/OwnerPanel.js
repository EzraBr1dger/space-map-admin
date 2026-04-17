import React, { useState, useEffect } from 'react';
import api from '../services/api';

function OwnerPanel() {
    const [users, setUsers] = useState([]);
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [message, setMessage] = useState('');
    const [activeSection, setActiveSection] = useState('users');

    useEffect(() => {
        fetchUsers();
        fetchLogs();
    }, []);

    const fetchUsers = async () => {
        try {
            const { data } = await api.get('/auth/users');
            setUsers(data.users);
        } catch {
            setError('Failed to load users');
        } finally {
            setLoading(false);
        }
    };

    const fetchLogs = async () => {
        try {
            const { data } = await api.get('/auth/logs');
            setLogs(data.logs);
        } catch {
            console.error('Failed to load logs');
        }
    };

    const assignRole = async (uid, role) => {
        try {
            await api.post('/auth/assign-role', { uid, role });
            setMessage('Role updated successfully');
            fetchUsers();
            setTimeout(() => setMessage(''), 3000);
        } catch {
            setError('Failed to update role');
            setTimeout(() => setError(''), 3000);
        }
    };

    const getRoleColor = (role) => {
        if (role === 'owner') return '#ff9800';
        if (role === 'admin') return '#64ffda';
        if (role === 'admiral') return '#2196f3';
        return '#888';
    };

    const getLogColor = (type) => {
        if (type === 'fleet_rename') return '#2196f3';
        if (type === 'planet_rename') return '#64ffda';
        return '#888';
    };

    if (loading) return <div style={{ color: '#64ffda', padding: '20px' }}>Loading...</div>;

    const assigned = users.filter(u => u.role && u.role !== 'viewer');
    const awaiting = users.filter(u => !u.role || u.role === 'viewer');

    return (
        <div style={{ padding: '20px' }}>
            {message && <div style={{ background: 'rgba(100,255,218,0.1)', border: '1px solid #64ffda', color: '#64ffda', padding: '10px', borderRadius: '8px', marginBottom: '20px' }}>{message}</div>}
            {error && <div style={{ color: '#f44336', padding: '10px', background: 'rgba(244,67,54,0.1)', borderRadius: '8px', marginBottom: '20px' }}>{error}</div>}

            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                <button
                    onClick={() => setActiveSection('users')}
                    style={{ width: 'auto', padding: '8px 16px', opacity: activeSection === 'users' ? 1 : 0.5 }}
                >
                    Manage Users
                </button>
                <button
                    onClick={() => setActiveSection('logs')}
                    style={{ width: 'auto', padding: '8px 16px', opacity: activeSection === 'logs' ? 1 : 0.5 }}
                >
                    Activity Logs
                </button>
            </div>

            {activeSection === 'users' && (
                <>
                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)', marginBottom: '30px' }}>
                        <h2 style={{ color: '#f44336', padding: '20px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            Awaiting Assignment ({awaiting.length})
                        </h2>
                        {awaiting.length === 0 ? (
                            <p style={{ color: '#888', padding: '20px' }}>No users awaiting assignment</p>
                        ) : (
                            awaiting.map(u => (
                                <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <span style={{ color: '#ffffff' }}>{u.email}</span>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => assignRole(u.uid, 'admin')} style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}>Admin</button>
                                        <button onClick={() => assignRole(u.uid, 'admiral')} style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #2196f3, #1976d2)' }}>Admiral</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                        <h2 style={{ color: '#64ffda', padding: '20px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                            Assigned Users ({assigned.length})
                        </h2>
                        {assigned.length === 0 ? (
                            <p style={{ color: '#888', padding: '20px' }}>No assigned users</p>
                        ) : (
                            assigned.map(u => (
                                <div key={u.uid} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <div>
                                        <span style={{ color: '#ffffff' }}>{u.email}</span>
                                        <span style={{ marginLeft: '10px', color: getRoleColor(u.role), fontSize: '13px', textTransform: 'uppercase', fontWeight: 600 }}>{u.role}</span>
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <button onClick={() => assignRole(u.uid, 'admin')} style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', opacity: u.role === 'admin' ? 0.4 : 1 }} disabled={u.role === 'admin'}>Admin</button>
                                        <button onClick={() => assignRole(u.uid, 'admiral')} style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #2196f3, #1976d2)', opacity: u.role === 'admiral' ? 0.4 : 1 }} disabled={u.role === 'admiral'}>Admiral</button>
                                        <button onClick={() => assignRole(u.uid, 'viewer')} style={{ width: 'auto', padding: '6px 12px', fontSize: '13px', background: 'linear-gradient(135deg, #f44336, #d32f2f)' }}>Revoke</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}

            {activeSection === 'logs' && (
                <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <h2 style={{ color: '#64ffda', padding: '20px', margin: 0, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                        Activity Logs ({logs.length})
                    </h2>
                    {logs.length === 0 ? (
                        <p style={{ color: '#888', padding: '20px' }}>No logs yet</p>
                    ) : (
                        logs.map((log, i) => (
                            <div key={i} style={{ padding: '15px 20px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <span style={{ color: getLogColor(log.type), fontSize: '13px', textTransform: 'uppercase', fontWeight: 600 }}>
                                        {log.type === 'fleet_rename' ? 'Fleet Rename' : 'Planet Rename'}
                                    </span>
                                    <span style={{ color: '#888', fontSize: '12px' }}>{new Date(log.timestamp).toLocaleString()}</span>
                                </div>
                                <div style={{ marginTop: '5px', color: '#ffffff' }}>
                                    <span style={{ color: '#888' }}>{log.by}</span> renamed <span style={{ color: '#f44336' }}>{log.from}</span> → <span style={{ color: '#64ffda' }}>{log.to}</span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}

export default OwnerPanel;