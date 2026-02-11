import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './SuppliesTab.css';

function SuppliesTab() {
    const [supplies, setSupplies] = useState({});
    const [loading, setLoading] = useState(true);
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadSupplies();
    }, []);

    const loadSupplies = async () => {
        try {
            const { data } = await api.get('/supplies');
            setSupplies(data.supplies);
        } catch (error) {
            console.error('Error loading supplies:', error);
            showMessage('error', 'Failed to load supplies');
        } finally {
            setLoading(false);
        }
    };

    const updateSupply = async (itemName, action, amount) => {
        if (!amount || isNaN(amount)) {
            showMessage('error', 'Please enter a valid number');
            return;
        }

        try {
            const endpoint = action === 'set' 
                ? `/supplies/${encodeURIComponent(itemName)}`
                : `/supplies/${encodeURIComponent(itemName)}/add`;
            
            const method = action === 'set' ? 'PUT' : 'PATCH';

            const { data } = await api({
                method,
                url: endpoint,
                data: { amount: parseFloat(amount) }
            });

            showMessage('success', data.message);
            await loadSupplies();
            
            // Clear the input
            document.getElementById(`amount-${itemName.replace(/\s+/g, '')}`).value = '';
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to update supply');
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    if (loading) return <div className="loading">Loading supplies...</div>;

    return (
        <div className="supplies-tab">
            <h3>Supply Management</h3>
            
            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            <div className="supply-list">
                {Object.entries(supplies).map(([itemName, amount]) => (
                    <SupplyItem
                        key={itemName}
                        itemName={itemName}
                        amount={amount}
                        onUpdate={updateSupply}
                    />
                ))}
            </div>
        </div>
    );
}

function SupplyItem({ itemName, amount, onUpdate }) {
    const inputId = `amount-${itemName.replace(/\s+/g, '')}`;

    const handleSet = () => {
        const input = document.getElementById(inputId);
        onUpdate(itemName, 'set', input.value);
    };

    const handleAdd = () => {
        const input = document.getElementById(inputId);
        onUpdate(itemName, 'add', input.value);
    };

    return (
        <div className="supply-item">
            <div className="supply-name">{itemName}</div>
            <div className="supply-controls">
                <span className="current-stock">
                    Current Stock: <strong>{formatNumber(amount)}</strong>
                </span>
                <div className="supply-actions">
                    <input
                        type="number"
                        id={inputId}
                        placeholder="Amount"
                        className="amount-input"
                    />
                    <button onClick={handleSet} className="btn-set">Set</button>
                    <button onClick={handleAdd} className="btn-add">Add</button>
                </div>
            </div>
        </div>
    );
}

function formatNumber(num) {
    return new Intl.NumberFormat().format(num);
}

export default SuppliesTab;