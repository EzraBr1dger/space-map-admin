import React, { useState, useEffect } from 'react';
import api from '../services/api';
import './AnnouncementsTab.css';

function AnnouncementsTab() {
    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        robloxImageId: '',
        announcementType: '',
        announcementText: ''
    });
    const [message, setMessage] = useState({ type: '', text: '' });

    useEffect(() => {
        loadAnnouncements();
    }, []);

    const loadAnnouncements = async () => {
        try {
            const { data } = await api.get('/announcements');
            setAnnouncements(data.announcements || []);
        } catch (error) {
            console.error('Error loading announcements:', error);
            showMessage('error', 'Failed to load announcements');
        } finally {
            setLoading(false);
        }
    };

    const showMessage = (type, text) => {
        setMessage({ type, text });
        setTimeout(() => setMessage({ type: '', text: '' }), 5000);
    };

    const showCreateForm = () => {
        setShowForm(true);
        setEditingId(null);
        setFormData({
            robloxImageId: '',
            announcementType: '',
            announcementText: ''
        });
    };

    const hideForm = () => {
        setShowForm(false);
        setEditingId(null);
        setFormData({
            robloxImageId: '',
            announcementType: '',
            announcementText: ''
        });
    };

    const handleEdit = async (announcementId) => {
        try {
            const { data } = await api.get(`/announcements/${announcementId}`);
            const announcement = data.announcement;
            
            setFormData({
                robloxImageId: announcement.robloxImageId,
                announcementType: announcement.announcementType,
                announcementText: announcement.announcementText
            });
            setEditingId(announcementId);
            setShowForm(true);
        } catch (error) {
            showMessage('error', 'Failed to load announcement for editing');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validate Roblox Image ID
        if (!isValidRobloxImageId(formData.robloxImageId) && !formData.robloxImageId.startsWith('rbxasset://')) {
            showMessage('error', 'Invalid Roblox Image ID. Please enter numbers only or a valid rbxasset:// URL.');
            return;
        }

        try {
            if (editingId) {
                // Update existing announcement
                const { data } = await api.put(`/announcements/${editingId}`, formData);
                showMessage('success', data.message);
            } else {
                // Create new announcement
                const { data } = await api.post('/announcements', formData);
                showMessage('success', data.message);
            }

            hideForm();
            await loadAnnouncements();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to save announcement');
        }
    };

    const handleDelete = async (announcementId) => {
        if (!window.confirm('Are you sure you want to delete this announcement? This action cannot be undone.')) {
            return;
        }

        try {
            const { data } = await api.delete(`/announcements/${announcementId}`);
            showMessage('success', data.message);
            await loadAnnouncements();
        } catch (error) {
            showMessage('error', error.response?.data?.error || 'Failed to delete announcement');
        }
    };

    const handlePreview = (announcement) => {
        const previewText = `Preview:\n\nType: ${announcement.announcementType}\nImage ID: ${announcement.robloxImageId}\n\nContent:\n${announcement.announcementText}`;
        alert(previewText);
    };

    if (loading) return <div className="loading">Loading announcements...</div>;

    return (
        <div className="announcements-tab">
            <h3>Announcements Management</h3>

            <div className="announcements-controls">
                <button onClick={showCreateForm} className="btn-create">
                    Create New Announcement
                </button>
            </div>

            {message.text && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {showForm && (
                <div className="announcement-form">
                    <h4>{editingId ? 'Edit Announcement' : 'Create New Announcement'}</h4>
                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label>Roblox Image ID</label>
                            <input
                                type="text"
                                value={formData.robloxImageId}
                                onChange={(e) => setFormData({ ...formData, robloxImageId: e.target.value })}
                                placeholder="e.g., rbxasset://textures/ui/GuiImagePlaceholder.png or 123456789"
                                required
                            />
                            <small>Enter either a Roblox asset ID (numbers only) or full rbxasset:// URL</small>
                        </div>

                        <div className="form-group">
                            <label>Announcement Type</label>
                            <select
                                value={formData.announcementType}
                                onChange={(e) => setFormData({ ...formData, announcementType: e.target.value })}
                                required
                            >
                                <option value="">Select Type</option>
                                <option value="Success">Success</option>
                                <option value="News">News</option>
                                <option value="Failure">Failure</option>
                            </select>
                        </div>

                        <div className="form-group">
                            <label>Announcement Text</label>
                            <textarea
                                value={formData.announcementText}
                                onChange={(e) => setFormData({ ...formData, announcementText: e.target.value })}
                                rows="4"
                                placeholder="Enter your announcement text here..."
                                required
                            />
                        </div>

                        <div className="form-actions">
                            <button type="submit" className="btn-save">
                                {editingId ? 'Update Announcement' : 'Create Announcement'}
                            </button>
                            <button type="button" onClick={hideForm} className="btn-cancel">
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="announcements-list">
                {announcements.length === 0 ? (
                    <div className="no-announcements">
                        No announcements found. Create your first announcement!
                    </div>
                ) : (
                    announcements.map((announcement) => (
                        <AnnouncementCard
                            key={announcement.id}
                            announcement={announcement}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onPreview={handlePreview}
                        />
                    ))
                )}
            </div>
        </div>
    );
}

function AnnouncementCard({ announcement, onEdit, onDelete, onPreview }) {
    return (
        <div className="announcement-card">
            <div className="announcement-header">
                <span className={`announcement-type type-${announcement.announcementType.toLowerCase()}`}>
                    {announcement.announcementType}
                </span>
                <div className="announcement-date">
                    {new Date(announcement.timestamp).toLocaleString()}
                    {announcement.lastModified && (
                        <div className="last-modified">
                            Modified: {new Date(announcement.lastModified).toLocaleString()}
                        </div>
                    )}
                </div>
            </div>

            <div className="announcement-content">
                <div className="announcement-text">
                    {announcement.announcementText}
                </div>

                <div className="announcement-image">
                    <span>🖼️ Image ID: {announcement.robloxImageId}</span>
                    {isValidRobloxImageId(announcement.robloxImageId) && (
                        <a
                            href={`https://www.roblox.com/library/${announcement.robloxImageId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="view-link"
                        >
                            View on Roblox
                        </a>
                    )}
                </div>
            </div>

            <div className="announcement-actions">
                <button onClick={() => onEdit(announcement.id)} className="btn-edit">
                    Edit
                </button>
                <button onClick={() => onDelete(announcement.id)} className="btn-delete">
                    Delete
                </button>
                <button onClick={() => onPreview(announcement)} className="btn-preview">
                    Preview
                </button>
            </div>
        </div>
    );
}

function isValidRobloxImageId(imageId) {
    return /^\d+$/.test(imageId);
}

export default AnnouncementsTab;