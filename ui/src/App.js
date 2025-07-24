// src/App.js
// This file contains the complete frontend code for the CRM & Ticketing System.
// UPDATED: Aurora background now uses a "street light" color in dark mode.
// ACCESSIBILITY FIX: Added aria-labels to icon-only buttons for screen reader compatibility.

import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

// --- Configuration ---
const API_BASE_URL = `https://${window.location.hostname}:3001/api`; 

// --- Theme Management ---
const ThemeContext = createContext();

const ThemeProvider = ({ children }) => {
    const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');
        root.classList.add(theme);
        localStorage.setItem('theme', theme);
    }, [theme]);

    const toggleTheme = () => {
        setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
    };

    return (
        <ThemeContext.Provider value={{ theme, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

// --- Aurora Background Component ---
const AuroraBackground = () => {
    useEffect(() => {
        const handleMouseMove = (e) => {
            document.documentElement.style.setProperty('--mouse-x', `${e.clientX}px`);
            document.documentElement.style.setProperty('--mouse-y', `${e.clientY}px`);
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);

    return (
        <div className="fixed inset-0 -z-10 h-full w-full transition-colors duration-300">
             <div className="fixed inset-0 -z-20 h-full w-full bg-white dark:bg-black bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
            
            {/* Light mode aurora */}
            <div 
                style={{
                    background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(29, 78, 216, 0.15), transparent 80%)`
                }}
                className="block dark:hidden fixed inset-0 -z-10 transition-opacity duration-300"
            />
            {/* Dark mode aurora */}
            <div 
                style={{
                    background: `radial-gradient(600px circle at var(--mouse-x) var(--mouse-y), rgba(255, 180, 60, 0.15), transparent 80%)`
                }}
                className="hidden dark:block fixed inset-0 -z-10 transition-opacity duration-300"
            />
        </div>
    );
};


// --- Main App Component ---
function App() {
    return (
        <ThemeProvider>
            <AppContent />
        </ThemeProvider>
    );
}

function AppContent() {
    const [user, setUser] = useState(null);
    const [view, setView] = useState('tickets'); // 'tickets', 'companies', 'admin'
    
    useEffect(() => {
        const token = localStorage.getItem('accessToken');
        const userData = localStorage.getItem('user');
        if (token && userData) {
            setUser(JSON.parse(userData));
        }
    }, []);

    const handleLogin = (userData, token) => {
        setUser(userData);
        localStorage.setItem('accessToken', token);
        localStorage.setItem('user', JSON.stringify(userData));
    };

    const handleLogout = () => {
        setUser(null);
        setView('tickets');
        localStorage.removeItem('accessToken');
        localStorage.removeItem('user');
    };
    
    return (
        // FIX: Removed solid background color to allow AuroraBackground to be visible.
        <div className="min-h-screen w-full font-sans text-gray-800 dark:text-gray-200 transition-colors duration-300">
            <AuroraBackground />
            
            {!user ? (
                <LoginScreen onLogin={handleLogin} />
            ) : (
                <div className="flex h-screen p-4">
                    <MainSidebar user={user} setView={setView} currentView={view} onLogout={handleLogout} />
                    <div className="flex-1 flex flex-col overflow-hidden ml-4">
                        <Header user={user} />
                        <main className="flex-1 overflow-x-hidden overflow-y-auto mt-4">
                            <div className="p-1">
                                {view === 'tickets' && <TicketsView user={user} />}
                                {view === 'companies' && <CompaniesView user={user} />}
                                {view === 'admin' && user.role === 'admin' && <AdminPanel />}
                            </div>
                        </main>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Reusable Modal Component ---
function Modal({ title, message, onConfirm, onCancel, confirmText = 'Confirm', cancelText = 'Cancel', type = 'confirm' }) {
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-md border border-white/20 dark:border-black/20">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">{title}</h3>
                <p className="text-gray-800 dark:text-gray-300 mb-6 whitespace-pre-wrap">{message}</p>
                <div className="flex justify-end space-x-4">
                    {type !== 'alert' && <button onClick={onCancel} className="px-4 py-2 bg-gray-200/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-colors">{cancelText}</button>}
                    <button onClick={onConfirm} className={`px-4 py-2 text-white rounded-lg transition-colors ${type === 'alert' ? 'bg-blue-500 hover:bg-blue-600' : 'bg-red-500 hover:bg-red-600'}`}>{confirmText}</button>
                </div>
            </div>
        </div>
    );
}

// --- Edit Asset Modal Component ---
function EditAssetModal({ asset, onSave, onCancel }) {
    const [formData, setFormData] = useState(asset);

    useEffect(() => {
        setFormData(asset);
    }, [asset]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        onSave(formData);
    };

    const inputStyles = "w-full p-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400";

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white/30 dark:bg-black/30 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-lg border border-white/20 dark:border-black/20">
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Edit Asset</h3>
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <input name="asset_name" value={formData.asset_name || ''} onChange={handleChange} placeholder="Device Name" required className={inputStyles} />
                        <input name="serial_number" value={formData.serial_number || ''} onChange={handleChange} placeholder="Serial Number" className={inputStyles} />
                        <input name="device_type" value={formData.device_type || ''} onChange={handleChange} placeholder="Device Type (e.g., Laptop)" className={inputStyles} />
                        <input name="owner_location" value={formData.owner_location || ''} onChange={handleChange} placeholder="Owner/Location" className={inputStyles} />
                        <input name="brand" value={formData.brand || ''} onChange={handleChange} placeholder="Brand (e.g., Dell)" className={inputStyles} />
                        <input name="model" value={formData.model || ''} onChange={handleChange} placeholder="Model (e.g., XPS 15)" className={inputStyles} />
                        <input name="operating_system" value={formData.operating_system || ''} onChange={handleChange} placeholder="Operating System" className={inputStyles} />
                        <select name="status" value={formData.status} onChange={handleChange} className={inputStyles}>
                            <option>In Use</option> <option>In Storage</option> <option>Under Repair</option> <option>Broken</option> <option>End of Life</option> <option>Disposed</option>
                        </select>
                    </div>
                    <textarea name="description" value={formData.description || ''} onChange={handleChange} rows="3" placeholder="Description..." className={`${inputStyles} w-full`}></textarea>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Save Changes</button>
                </div>
            </form>
        </div>
    );
}

// --- Login Screen Component ---
function LoginScreen({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            const response = await axios.post(`${API_BASE_URL}/login`, { username, password });
            onLogin(response.data.user, response.data.accessToken);
        } catch (err) {
            setError(err.response?.data?.message || 'Login failed. Please try again.');
        }
    };

    const inputStyles = "w-full px-3 py-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400";

    return (
        <div className="min-h-screen flex items-center justify-center p-4">
            <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl p-8 rounded-2xl shadow-2xl w-full max-w-sm border border-white/20 dark:border-black/20">
                <h1 className="text-2xl font-bold text-center mb-6 text-gray-900 dark:text-white">CRM & Ticketing Login</h1>
                {error && <p className="bg-red-500/20 text-red-700 dark:text-red-300 p-3 rounded-lg mb-4">{error}</p>}
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="block text-gray-800 dark:text-gray-300 mb-2" htmlFor="username">Username</label>
                        <input id="username" type="text" value={username} onChange={(e) => setUsername(e.target.value)} className={inputStyles} required />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-800 dark:text-gray-300 mb-2" htmlFor="password">Password</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputStyles} required />
                    </div>
                    <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Login</button>
                </form>
            </div>
        </div>
    );
}


// --- Main Application Components (after login) ---

function MainSidebar({ user, setView, currentView, onLogout }) {
    const navItems = [
        { name: 'Tickets', view: 'tickets', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 002 2h3m10-5a2 2 0 012 2v3a2 2 0 01-2 2h-3m-3-4h.01M12 16h.01" /></svg> },
        { name: 'Companies', view: 'companies', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg> },
    ];
    if (user.role === 'admin') {
        navItems.push({ name: 'Admin', view: 'admin', icon: <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg> });
    }

    return (
        <div className="flex flex-col w-64 bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20">
            <div className="flex items-center justify-center h-20 border-b border-white/20 dark:border-black/20">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white ml-2">Fast IT</h1>
            </div>
            <nav className="flex-grow px-4 py-4">
                {navItems.map(item => (
                    <button key={item.name} onClick={() => setView(item.view)} className={`flex items-center w-full px-4 py-2 mt-2 text-lg rounded-lg transition-all duration-200 ${currentView === item.view ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-black/20'}`}>
                        {item.icon}
                        <span className="ml-3">{item.name}</span>
                    </button>
                ))}
            </nav>
            <div className="px-4 py-4 border-t border-white/20 dark:border-black/20">
                <button onClick={onLogout} className="w-full flex items-center px-4 py-2 text-lg text-gray-700 dark:text-gray-300 rounded-lg hover:bg-red-500/20 dark:hover:bg-red-500/20 hover:text-red-700 dark:hover:text-red-400 transition-colors">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                    <span className="ml-3">Logout</span>
                </button>
            </div>
        </div>
    );
}

function Header({ user }) {
    const { theme, toggleTheme } = useContext(ThemeContext);
    return (
        <header className="flex items-center justify-end h-20 px-6 bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20">
             <button 
                onClick={toggleTheme} 
                className="p-2 rounded-full text-gray-700 dark:text-gray-300 hover:bg-white/20 dark:hover:bg-black/20 mr-4 transition-colors"
                aria-label={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}
            >
                {theme === 'light' ? 
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" /></svg> :
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
                }
             </button>
             <span className="text-gray-800 dark:text-gray-300">Welcome, {user.username} ({user.role})</span>
        </header>
    );
}

// --- Tickets View ---
function TicketsView({ user }) {
    const [allTickets, setAllTickets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showCreateTicket, setShowCreateTicket] = useState(false);
    const [selectedTicket, setSelectedTicket] = useState(null);
    const [statusFilter, setStatusFilter] = useState('All');

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    const fetchTickets = useCallback(async () => {
        setLoading(true);
        try {
            const response = await axios.get(`${API_BASE_URL}/tickets`, getAuthHeaders());
            setAllTickets(response.data);
        } catch (err) {
            setError('Could not fetch tickets.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchTickets();
    }, [fetchTickets]);

    const handleTicketCreated = (newTicket) => {
        setAllTickets([newTicket, ...allTickets]);
        setShowCreateTicket(false);
    };

    const handleTicketUpdated = (updatedTicket) => {
        setAllTickets(allTickets.map(t => t.id === updatedTicket.id ? {...t, ...updatedTicket} : t));
    };
    
    const handleTicketDeleted = (ticketId) => {
        setAllTickets(allTickets.filter(t => t.id !== ticketId));
        setSelectedTicket(null);
    };

    const filteredTickets = allTickets.filter(ticket => {
        if (statusFilter === 'All') return ticket.status !== 'Closed';
        if (statusFilter === 'Archived') return ticket.status === 'Closed';
        return ticket.status === statusFilter;
    });

    const getStatusClass = (status) => {
        switch (status) {
            case 'Open': return 'bg-green-500/20 text-green-800 dark:text-green-300';
            case 'In Progress': return 'bg-blue-500/20 text-blue-800 dark:text-blue-300';
            case 'Resolved': return 'bg-purple-500/20 text-purple-800 dark:text-purple-300';
            case 'Closed': return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
            default: return 'bg-gray-500/20';
        }
    };

    const getPriorityClass = (priority) => {
        switch (priority) {
            case 'Urgent': return 'bg-red-500/20 text-red-800 dark:text-red-300';
            case 'High': return 'bg-orange-500/20 text-orange-800 dark:text-orange-300';
            case 'Normal': return 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300';
            case 'Low': return 'bg-blue-500/20 text-blue-800 dark:text-blue-300';
            default: return 'bg-gray-500/20';
        }
    };

    if (selectedTicket) {
        return <TicketDetailView ticketId={selectedTicket.id} onBack={() => setSelectedTicket(null)} onTicketUpdated={handleTicketUpdated} onTicketDeleted={handleTicketDeleted} user={user} />;
    }

    return (
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20 p-8">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Tickets Dashboard</h1>
                <button onClick={() => setShowCreateTicket(true)} className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Create New Ticket</button>
            </div>
            {showCreateTicket && <CreateTicketModal onTicketCreated={handleTicketCreated} onCancel={() => setShowCreateTicket(false)} />}
            
            <div className="mb-4 flex space-x-2 border-b border-white/30 dark:border-black/30">
                {['All', 'Open', 'In Progress', 'Resolved', 'Archived'].map(status => (
                    <button key={status} onClick={() => setStatusFilter(status)} className={`px-4 py-2 text-sm font-medium transition-colors ${statusFilter === status ? 'border-b-2 border-blue-500 text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200'}`}>
                        {status}
                    </button>
                ))}
            </div>

            {loading && <p className="dark:text-white">Loading tickets...</p>}
            {error && <p className="text-red-500">{error}</p>}
            <div className="space-y-4">
                {filteredTickets.map(ticket => (
                    <div key={ticket.id} onClick={() => setSelectedTicket(ticket)} className="bg-white/20 dark:bg-black/20 p-4 rounded-xl shadow-md hover:shadow-lg hover:scale-[1.01] transition-all cursor-pointer border border-white/20 dark:border-black/20">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm text-gray-600 dark:text-gray-400">#{ticket.id} - {ticket.company_name}</p>
                                <h2 className="text-xl font-bold text-gray-900 dark:text-white">{ticket.title}</h2>
                                <p className="text-sm text-gray-700 dark:text-gray-400 mt-1">Assigned to: <span className="font-semibold">{ticket.assigned_user_name || 'Unassigned'}</span></p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-4">
                                <span className="text-sm text-gray-600 dark:text-gray-400">Last updated: {new Date(ticket.updated_at).toLocaleString()}</span>
                                <div className="flex items-center justify-end gap-2 mt-1">
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(ticket.status)}`}>{ticket.status}</span>
                                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${getPriorityClass(ticket.priority)}`}>{ticket.priority}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

function CreateTicketModal({ onTicketCreated, onCancel }) {
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [priority, setPriority] = useState('Normal');
    const [companyId, setCompanyId] = useState('');
    const [customerEmail, setCustomerEmail] = useState('');
    const [companies, setCompanies] = useState([]);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    useEffect(() => {
        axios.get(`${API_BASE_URL}/companies`, getAuthHeaders())
            .then(res => setCompanies(res.data))
            .catch(err => console.error(err));
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await axios.post(`${API_BASE_URL}/tickets`, {
                title, description, priority, company_id: companyId, customer_email: customerEmail
            }, getAuthHeaders());
            onTicketCreated(response.data);
        } catch (err) {
            alert('Failed to create ticket.');
        }
    };
    
    const inputStyles = "w-full p-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400";

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex justify-center items-center z-50 p-4">
            <form onSubmit={handleSubmit} className="bg-white/30 dark:bg-black/30 backdrop-blur-xl p-6 rounded-2xl shadow-2xl w-full max-w-2xl border border-white/20 dark:border-black/20">
                <h3 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">Create New Ticket</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="Ticket Title" value={title} onChange={e => setTitle(e.target.value)} required className={inputStyles} />
                    <textarea placeholder="Describe the issue..." value={description} onChange={e => setDescription(e.target.value)} required rows="5" className={inputStyles}></textarea>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <select value={companyId} onChange={e => setCompanyId(e.target.value)} required className={inputStyles}>
                            <option value="">Select a Company...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <input type="email" placeholder="Customer Email (for notifications)" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} className={inputStyles} />
                    </div>
                     <div className="grid grid-cols-1">
                        <label className="text-gray-800 dark:text-gray-300 mb-2">Priority</label>
                        <select value={priority} onChange={e => setPriority(e.target.value)} required className={inputStyles}>
                            <option>Low</option>
                            <option>Normal</option>
                            <option>High</option>
                            <option>Urgent</option>
                        </select>
                    </div>
                </div>
                <div className="flex justify-end space-x-4 mt-6">
                    <button type="button" onClick={onCancel} className="px-4 py-2 bg-gray-200/50 dark:bg-gray-700/50 text-gray-800 dark:text-gray-200 rounded-lg hover:bg-gray-300/70 dark:hover:bg-gray-600/70 transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors">Create Ticket</button>
                </div>
            </form>
        </div>
    );
}

function TicketDetailView({ ticketId, onBack, onTicketUpdated, onTicketDeleted, user }) {
    const [ticket, setTicket] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [newUpdate, setNewUpdate] = useState('');
    const [users, setUsers] = useState([]);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    const fetchTicketDetails = useCallback(async () => {
        setLoading(true);
        try {
            const [ticketRes, usersRes] = await Promise.all([
                axios.get(`${API_BASE_URL}/tickets/${ticketId}`, getAuthHeaders()),
                user.role === 'admin' ? axios.get(`${API_BASE_URL}/users`, getAuthHeaders()) : Promise.resolve({ data: [] })
            ]);
            setTicket(ticketRes.data);
            setUsers(usersRes.data);
        } catch (err) {
            setError('Could not fetch ticket details.');
        } finally {
            setLoading(false);
        }
    }, [ticketId, user.role]);

    useEffect(() => {
        fetchTicketDetails();
    }, [fetchTicketDetails]);

    const handleAddUpdate = async (e) => {
        e.preventDefault();
        if (!newUpdate.trim()) return;
        try {
            const response = await axios.post(`${API_BASE_URL}/tickets/${ticketId}/updates`, { update_text: newUpdate }, getAuthHeaders());
            setTicket(prevTicket => ({ 
                ...prevTicket, 
                updates: [...prevTicket.updates, response.data],
                status: 'In Progress' // Optimistically update status
            }));
            setNewUpdate('');
            onTicketUpdated({ id: ticketId, updated_at: new Date().toISOString(), status: 'In Progress' });
        } catch (err) {
            alert('Failed to add update.');
        }
    };

    const handleTicketAttributeChange = async (e) => {
        const { name, value } = e.target;
        const updatedData = {
            status: ticket.status,
            priority: ticket.priority,
            assigned_user_id: ticket.assigned_user_id,
            [name]: value
        };
        
        try {
            const response = await axios.put(`${API_BASE_URL}/tickets/${ticketId}`, updatedData, getAuthHeaders());
            setTicket(prevTicket => ({ ...prevTicket, ...response.data }));
            onTicketUpdated(response.data);
        } catch (err) {
            alert('Failed to update ticket.');
        }
    };
    
    const handleDelete = async () => {
        if (window.confirm('Are you sure you want to delete this ticket permanently?')) {
            try {
                await axios.delete(`${API_BASE_URL}/tickets/${ticketId}`, getAuthHeaders());
                onTicketDeleted(ticketId);
            } catch (err) {
                alert('Failed to delete ticket.');
            }
        }
    };

    const inputStyles = "p-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none";

    if (loading) return <p className="p-8 dark:text-white">Loading ticket...</p>;
    if (error) return <p className="p-8 text-red-500">{error}</p>;
    if (!ticket) return null;

    return (
        <div className="p-1">
            <button onClick={onBack} className="mb-6 text-blue-600 dark:text-blue-400 hover:underline">{'< Back to all tickets'}</button>
            <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl p-6 rounded-2xl shadow-2xl border border-white/20 dark:border-black/20">
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{ticket.title}</h1>
                        <p className="text-gray-700 dark:text-gray-400">For: {ticket.company_name} | Created by: {ticket.user_name}</p>
                        <p className="text-gray-700 dark:text-gray-400">Assigned to: <span className="font-semibold">{ticket.assigned_user_name || 'Unassigned'}</span></p>
                        {ticket.customer_email && (
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 flex items-center">
                                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path></svg>
                                Notifying: {ticket.customer_email}
                            </p>
                        )}
                    </div>
                    {user.role === 'admin' && (
                        <div className="flex flex-col sm:flex-row gap-2">
                            <select name="assigned_user_id" value={ticket.assigned_user_id || ''} onChange={handleTicketAttributeChange} className={inputStyles}>
                                <option value="">Assign to...</option>
                                {users.map(u => <option key={u.id} value={u.id}>{u.username}</option>)}
                            </select>
                            <select name="status" value={ticket.status} onChange={handleTicketAttributeChange} className={inputStyles}>
                                <option>Open</option>
                                <option>In Progress</option>
                                <option>Resolved</option>
                                <option>Closed</option>
                            </select>
                            <button onClick={handleDelete} className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition-colors">Delete</button>
                        </div>
                    )}
                </div>
                <div className="prose dark:prose-invert max-w-none mb-6 text-gray-800 dark:text-gray-300">
                    <p>{ticket.description}</p>
                </div>
                <hr className="my-6 border-white/20 dark:border-black/20" />
                <h3 className="text-xl font-bold mb-4 text-gray-900 dark:text-white">Updates</h3>
                <div className="space-y-4 mb-6">
                    {ticket.updates.map(update => (
                        <div key={update.id} className="bg-white/20 dark:bg-black/20 p-3 rounded-lg border border-white/20 dark:border-black/20">
                            <p className="font-semibold text-gray-900 dark:text-white">{update.user_name}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{new Date(update.created_at).toLocaleString()}</p>
                            <p className="mt-2 text-gray-800 dark:text-gray-300 whitespace-pre-wrap">{update.update_text}</p>
                        </div>
                    ))}
                </div>
                <form onSubmit={handleAddUpdate}>
                    <textarea value={newUpdate} onChange={e => setNewUpdate(e.target.value)} rows="4" placeholder="Add an update... The customer will be notified by email." className={`${inputStyles} w-full`}></textarea>
                    <button type="submit" className="mt-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">Add Update & Notify</button>
                </form>
            </div>
        </div>
    );
}

// --- Companies View (Contains the old Asset Register) ---
function CompaniesView({ user }) {
    const [companies, setCompanies] = useState([]);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [assets, setAssets] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [modal, setModal] = useState(null);
    const [editingAsset, setEditingAsset] = useState(null);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    const fetchCompanies = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/companies`, getAuthHeaders());
            setCompanies(response.data);
            if (!selectedCompany && response.data.length > 0) {
                 const fastIT = response.data.find(c => c.name === 'Fast IT');
                 setSelectedCompany(fastIT || response.data[0]);
            } else if (response.data.length === 0) {
                setSelectedCompany(null);
            }
        } catch (err) {
            setError('Could not fetch companies.');
        } finally {
            setLoading(false);
        }
    }, [selectedCompany]);

    const fetchAssetsForCurrentCompany = useCallback(async () => {
        if (selectedCompany) {
            setLoading(true);
            try {
                const response = await axios.get(`${API_BASE_URL}/companies/${selectedCompany.id}/assets`, getAuthHeaders());
                setAssets(response.data);
            } catch (err) {
                setError(`Could not fetch assets for ${selectedCompany.name}.`);
            } finally {
                setLoading(false);
            }
        }
    }, [selectedCompany]);

    useEffect(() => {
        fetchCompanies();
    }, []);

    useEffect(() => {
        fetchAssetsForCurrentCompany();
    }, [selectedCompany, fetchAssetsForCurrentCompany]);

    const handleAddCompany = async (companyName) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/companies`, { name: companyName }, getAuthHeaders());
            setCompanies([...companies, response.data]);
            setSelectedCompany(response.data);
        } catch (err) {
            setModal({type: 'alert', title: 'Error', message: err.response?.data?.message || 'Failed to add company.', onConfirm: () => setModal(null)});
        }
    };

    const handleDeleteCompany = (companyId) => {
        const companyToDelete = companies.find(c => c.id === companyId);
        setModal({
            type: 'confirm', title: 'Delete Company', message: `Are you sure you want to delete ${companyToDelete.name}? This will also delete all of its assets.`,
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE_URL}/companies/${companyId}`, getAuthHeaders());
                    const updatedCompanies = companies.filter(c => c.id !== companyId);
                    setCompanies(updatedCompanies);
                    if (selectedCompany?.id === companyId) {
                        setSelectedCompany(updatedCompanies.length > 0 ? updatedCompanies[0] : null);
                    }
                } catch (err) {
                    setModal({type: 'alert', title: 'Error', message: 'Failed to delete company.', onConfirm: () => setModal(null)});
                } finally {
                    setModal(null);
                }
            },
            onCancel: () => setModal(null)
        });
    };

    const handleAddAsset = async (assetData) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/assets`, { ...assetData, company_id: selectedCompany.id }, getAuthHeaders());
            setAssets([...assets, response.data]);
        } catch (err) {
            setModal({type: 'alert', title: 'Error', message: err.response?.data?.message || 'Failed to add asset.', onConfirm: () => setModal(null)});
        }
    };

    const handleUpdateAsset = async (updatedAssetData) => {
        try {
            const response = await axios.put(`${API_BASE_URL}/assets/${updatedAssetData.id}`, updatedAssetData, getAuthHeaders());
            setAssets(assets.map(asset => asset.id === updatedAssetData.id ? response.data : asset));
            setEditingAsset(null);
        } catch (err) {
             setModal({type: 'alert', title: 'Error', message: err.response?.data?.message || 'Failed to update asset.', onConfirm: () => { setModal(null); setEditingAsset(null); }});
        }
    };

    const handleDeleteAsset = (assetId) => {
        setModal({
            type: 'confirm', title: 'Delete Asset', message: 'Are you sure you want to delete this asset?',
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE_URL}/assets/${assetId}`, getAuthHeaders());
                    setAssets(assets.filter(asset => asset.id !== assetId));
                } catch (err) {
                    setModal({type: 'alert', title: 'Error', message: 'Failed to delete asset.', onConfirm: () => setModal(null)});
                } finally {
                    setModal(null);
                }
            },
            onCancel: () => setModal(null)
        });
    };

    return (
        <>
            {modal && <Modal {...modal} />}
            {editingAsset && <EditAssetModal asset={editingAsset} onSave={handleUpdateAsset} onCancel={() => setEditingAsset(null)} />}
            <div className="flex flex-col lg:flex-row gap-4">
                <div className="lg:w-96 lg:flex-shrink-0">
                    <CompanySidebar user={user} companies={companies} selectedCompany={selectedCompany} onSelectCompany={setSelectedCompany} onAddCompany={handleAddCompany} onDeleteCompany={handleDeleteCompany} />
                </div>
                <div className="flex-grow min-w-0">
                    <AssetRegister user={user} company={selectedCompany} assets={assets} onAddAsset={handleAddAsset} onDeleteAsset={handleDeleteAsset} onEditAsset={setEditingAsset} loading={loading} onImportSuccess={fetchAssetsForCurrentCompany} setModal={setModal} />
                </div>
            </div>
        </>
    );
}

// --- Admin Panel Component ---
function AdminPanel() {
    const [users, setUsers] = useState([]);
    const [newUser, setNewUser] = useState({ username: '', password: '', role: 'user' });
    const [error, setError] = useState('');
    const [modal, setModal] = useState(null);

    const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });

    const fetchUsers = useCallback(async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/users`, getAuthHeaders());
            setUsers(response.data);
        } catch (err) {
            setError('Failed to fetch users.');
        }
    }, []);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    const handleInputChange = (e) => {
        setNewUser({ ...newUser, [e.target.name]: e.target.value });
    };

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${API_BASE_URL}/users`, newUser, getAuthHeaders());
            setNewUser({ username: '', password: '', role: 'user' });
            fetchUsers();
        } catch (err) {
            setModal({type: 'alert', title: 'Error', message: err.response?.data?.message || 'Failed to add user.', onConfirm: () => setModal(null)});
        }
    };
    
    const handleDeleteUser = (userId) => {
        const userToDelete = users.find(u => u.id === userId);
        setModal({
            type: 'confirm',
            title: 'Delete User',
            message: `Are you sure you want to delete the user: ${userToDelete.username}?`,
            onConfirm: async () => {
                try {
                    await axios.delete(`${API_BASE_URL}/users/${userId}`, getAuthHeaders());
                    fetchUsers();
                } catch (err) {
                    setModal({type: 'alert', title: 'Error', message: err.response?.data?.message || 'Failed to delete user.', onConfirm: () => setModal(null)});
                } finally {
                    setModal(null);
                }
            },
            onCancel: () => setModal(null)
        });
    };

    const inputStyles = "p-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400";

    return (
        <>
            {modal && <Modal {...modal} />}
            <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20 p-8">
                 <h1 className="text-3xl font-bold mb-6 text-gray-900 dark:text-white">Admin Panel</h1>
                
                <h2 className="text-2xl font-bold mb-4 text-gray-900 dark:text-white">User Management</h2>
                {error && <p className="text-red-500">{error}</p>}

                {/* Add User Form */}
                <form onSubmit={handleAddUser} className="mb-8 p-4 bg-white/20 dark:bg-black/20 rounded-xl border border-white/20 dark:border-black/20">
                    <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Create New User</h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <input name="username" value={newUser.username} onChange={handleInputChange} placeholder="Username" required className={inputStyles} />
                        <input type="password" name="password" value={newUser.password} onChange={handleInputChange} placeholder="Password" required className={inputStyles} />
                        <select name="role" value={newUser.role} onChange={handleInputChange} className={inputStyles}>
                            <option value="user">User</option>
                            <option value="admin">Admin</option>
                        </select>
                    </div>
                    <button type="submit" className="mt-4 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Add User</button>
                </form>

                {/* Users Table */}
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Existing Users</h3>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead >
                            <tr>
                                <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">ID</th>
                                <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Username</th>
                                <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Role</th>
                                <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(user => (
                                <tr key={user.id} className="border-b border-white/20 dark:border-black/20">
                                    <td className="py-2 px-3">{user.id}</td>
                                    <td className="py-2 px-3">{user.username}</td>
                                    <td className="py-2 px-3">{user.role}</td>
                                    <td className="py-2 px-3">
                                        <button onClick={() => handleDeleteUser(user.id)} className="text-red-500 hover:text-red-700 transition-colors">Delete</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );
}

// --- Sub-components for CompaniesView ---

function CompanySidebar({ user, companies, selectedCompany, onSelectCompany, onAddCompany, onDeleteCompany }) {
    const [newCompanyName, setNewCompanyName] = useState('');
    const handleSubmit = (e) => { e.preventDefault(); if (newCompanyName.trim()) { onAddCompany(newCompanyName.trim()); setNewCompanyName(''); } };
    return (
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20 p-6 h-full">
            <h2 className="text-xl font-semibold mb-4 border-b border-white/20 dark:border-black/20 pb-2 text-gray-900 dark:text-white">Companies</h2>
            <ul className="space-y-2 mb-6">
                {companies.map(company => (
                    <li key={company.id} className="flex items-center justify-between group">
                        <button onClick={() => onSelectCompany(company)} className={`w-full text-left px-4 py-2 rounded-lg transition-all duration-200 ${selectedCompany?.id === company.id ? 'bg-blue-600 text-white shadow-lg' : 'bg-white/20 dark:bg-black/20 text-gray-800 dark:text-gray-300 hover:bg-white/70 dark:hover:bg-black/70'}`}>
                            {company.name}
                        </button>
                        {user.role === 'admin' && (
                            <button 
                                onClick={(e) => { e.stopPropagation(); onDeleteCompany(company.id); }} 
                                className="ml-2 p-1 text-gray-500 hover:text-red-600 hover:bg-red-500/20 rounded-full opacity-0 group-hover:opacity-100 transition-all" 
                                title={`Delete ${company.name}`}
                                aria-label={`Delete ${company.name}`}
                            >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                        )}
                    </li>
                ))}
            </ul>
            <form onSubmit={handleSubmit}>
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Add New Company</h3>
                <input type="text" value={newCompanyName} onChange={(e) => setNewCompanyName(e.target.value)} placeholder="e.g. Wreckless Studios" className="w-full px-3 py-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400" />
                <button type="submit" className="w-full mt-3 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors">Add Company</button>
            </form>
        </div>
    );
}

function AssetRegister({ user, company, assets, onAddAsset, onDeleteAsset, onEditAsset, loading, onImportSuccess, setModal }) {
    if (!company) {
        return (
            <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20 p-8 text-center">
                <h2 className="text-2xl font-semibold text-gray-600 dark:text-gray-400">Select a Company to view assets</h2>
            </div>
        );
    }
    return (
        <div className="bg-white/30 dark:bg-black/30 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 dark:border-black/20 p-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Asset Register for: <span className="text-blue-600 dark:text-blue-400">{company.name}</span></h2>
            <AssetForm onAddAsset={onAddAsset} />
            <ExcelImportExport assets={assets} companyId={company.id} onImportSuccess={onImportSuccess} setModal={setModal} />
            <div className="mt-6">
                 {loading ? <p>Loading assets...</p> : <AssetTable assets={assets} onDeleteAsset={onDeleteAsset} onEditAsset={onEditAsset} user={user} />}
            </div>
        </div>
    );
}

function AssetForm({ onAddAsset }) {
    const initialState = { asset_name: '', description: '', serial_number: '', status: 'In Use', device_type: '', owner_location: '', brand: '', model: '', operating_system: '' };
    const [formData, setFormData] = useState(initialState);
    const handleChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
    const handleSubmit = (e) => { e.preventDefault(); if (formData.asset_name.trim()) { onAddAsset(formData); setFormData(initialState); } };
    const inputStyles = "w-full p-2 border border-white/30 dark:border-black/30 rounded-lg bg-white/10 dark:bg-black/10 focus:ring-2 focus:ring-blue-400 focus:outline-none placeholder-gray-500 dark:placeholder-gray-400";

    return (
        <form onSubmit={handleSubmit} className="bg-white/20 dark:bg-black/20 p-4 rounded-xl border border-white/20 dark:border-black/20">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Add New Asset</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input required name="asset_name" value={formData.asset_name} onChange={handleChange} placeholder="Device Name" className={inputStyles} />
                <input name="serial_number" value={formData.serial_number} onChange={handleChange} placeholder="Serial Number" className={inputStyles} />
                <input name="device_type" value={formData.device_type} onChange={handleChange} placeholder="Device Type (e.g., Laptop)" className={inputStyles} />
                <input name="owner_location" value={formData.owner_location} onChange={handleChange} placeholder="Owner/Location" className={inputStyles} />
                <input name="brand" value={formData.brand} onChange={handleChange} placeholder="Brand (e.g., Dell)" className={inputStyles} />
                <input name="model" value={formData.model} onChange={handleChange} placeholder="Model (e.g., XPS 15)" className={inputStyles} />
                <input name="operating_system" value={formData.operating_system} onChange={handleChange} placeholder="Operating System" className={inputStyles} />
                 <select name="status" value={formData.status} onChange={handleChange} className={inputStyles}>
                    <option>In Use</option> <option>In Storage</option> <option>Under Repair</option> <option>Broken</option> <option>End of Life</option> <option>Disposed</option>
                </select>
                <textarea name="description" value={formData.description} onChange={handleChange} placeholder="Description..." className={`${inputStyles} md:col-span-2`} rows="3"></textarea>
            </div>
            <button type="submit" className="mt-4 w-full md:w-auto bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-6 rounded-lg transition-colors">Add Asset</button>
        </form>
    );
}

function ExcelImportExport({ assets, companyId, onImportSuccess, setModal }) {
    const [file, setFile] = useState(null);

    const handleExport = () => {
        if (typeof XLSX === 'undefined') {
            setModal({type: 'alert', title: 'Error', message: 'Excel library is not loaded yet. Please try again in a moment.', onConfirm: () => setModal(null)});
            return;
        }
        const assetsToExport = assets.map(({ asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system }) => ({
            asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system
        }));
        const worksheet = XLSX.utils.json_to_sheet(assetsToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Assets");
        XLSX.writeFile(workbook, "Asset_Export.xlsx");
    };

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile) {
            setFile(selectedFile);
        }
    };

    const handleImport = () => {
        if (!file) {
            setModal({type: 'alert', title: 'Import Error', message: 'Please select a file to import.', onConfirm: () => setModal(null)});
            return;
        }
        if (typeof XLSX === 'undefined') {
            setModal({type: 'alert', title: 'Error', message: 'Excel library is not loaded yet. Please try again in a moment.', onConfirm: () => setModal(null)});
            return;
        }

        const reader = new FileReader();
        reader.onload = async (e) => {
            try {
                const data = e.target.result;
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (jsonData.length === 0) {
                    setModal({type: 'alert', title: 'Import Error', message: 'The selected file is empty or not formatted correctly.', onConfirm: () => setModal(null)});
                    return;
                }
                
                const requiredFields = ['asset_name'];
                const firstRow = jsonData[0];
                const missingFields = requiredFields.filter(field => !firstRow.hasOwnProperty(field));

                if (missingFields.length > 0) {
                    setModal({type: 'alert', title: 'Import Error', message: `The imported file is missing required columns: ${missingFields.join(', ')}`, onConfirm: () => setModal(null)});
                    return;
                }

                const getAuthHeaders = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` } });
                await axios.post(`${API_BASE_URL}/assets/bulk`, { company_id: companyId, assets: jsonData }, getAuthHeaders());
                
                setModal({type: 'alert', title: 'Success', message: `${jsonData.length} assets imported successfully.`, confirmText: 'OK', onConfirm: () => { onImportSuccess(); setModal(null); }});

            } catch (err) {
                setModal({type: 'alert', title: 'Import Error', message: err.response?.data?.message || 'An error occurred during import.', onConfirm: () => setModal(null)});
            }
        };
        reader.readAsArrayBuffer(file);
    };

    return (
        <div className="mt-6 bg-white/20 dark:bg-black/20 p-4 rounded-xl border border-white/20 dark:border-black/20">
            <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Import / Export Assets</h3>
            <div className="flex flex-col sm:flex-row items-center gap-4">
                <button onClick={handleExport} className="w-full sm:w-auto bg-green-700 hover:bg-green-800 text-white font-bold py-2 px-4 rounded-lg transition-colors" disabled={assets.length === 0}>Export to Excel</button>
                <div className="flex-grow w-full">
                    <input type="file" accept=".xlsx, .xls" onChange={handleFileChange} className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-500/20 dark:file:bg-blue-500/20 file:text-blue-700 dark:file:text-blue-300 hover:file:bg-blue-500/30" />
                </div>
                <button onClick={handleImport} className="w-full sm:w-auto bg-blue-700 hover:bg-blue-800 text-white font-bold py-2 px-4 rounded-lg transition-colors" disabled={!file}>Import from Excel</button>
            </div>
        </div>
    );
}


function AssetTable({ assets, onDeleteAsset, onEditAsset, user }) {
    if (assets.length === 0) return <p className="text-gray-600 dark:text-gray-400 mt-4">No assets found.</p>;
    const getStatusClass = (status) => {
        switch (status) {
            case 'In Use': return 'bg-green-500/20 text-green-800 dark:text-green-300';
            case 'In Storage': case 'Under Repair': return 'bg-yellow-500/20 text-yellow-800 dark:text-yellow-300';
            case 'Broken': return 'bg-red-500/20 text-red-800 dark:text-red-300';
            case 'End of Life': case 'Disposed': return 'bg-gray-500/20 text-gray-700 dark:text-gray-300';
            default: return 'bg-gray-500/20';
        }
    };

    return (
        <div className="overflow-x-auto">
            <table className="min-w-full">
                <thead>
                    <tr>
                        <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Device Name</th>
                        <th className="text-left py-2 px-3 hidden sm:table-cell text-gray-800 dark:text-gray-300">Serial #</th>
                        <th className="text-left py-2 px-3 hidden md:table-cell text-gray-800 dark:text-gray-300">Owner/Location</th>
                        <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Status</th>
                        {user.role === 'admin' && <th className="text-left py-2 px-3 text-gray-800 dark:text-gray-300">Actions</th>}
                    </tr>
                </thead>
                <tbody>
                    {assets.map(asset => (
                        <tr key={asset.id} className="border-b border-white/20 dark:border-black/20 hover:bg-white/20 dark:hover:bg-black/20">
                            <td className="py-2 px-3">{asset.asset_name}</td>
                            <td className="py-2 px-3 hidden sm:table-cell text-gray-700 dark:text-gray-400">{asset.serial_number}</td>
                            <td className="py-2 px-3 hidden md:table-cell text-gray-700 dark:text-gray-400">{asset.owner_location}</td>
                            <td className="py-2 px-3"><span className={`px-2 py-1 text-xs font-semibold rounded-full ${getStatusClass(asset.status)}`}>{asset.status}</span></td>
                            {user.role === 'admin' && (
                                <td className="py-2 px-3 flex items-center space-x-2">
                                    <button 
                                        onClick={() => onEditAsset(asset)} 
                                        className="text-blue-500 hover:text-blue-700" 
                                        title="Edit"
                                        aria-label="Edit asset"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                                    </button>
                                    <button 
                                        onClick={() => onDeleteAsset(asset.id)} 
                                        className="text-red-500 hover:text-red-700" 
                                        title="Delete"
                                        aria-label="Delete asset"
                                    >
                                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                    </button>
                                </td>
                            )}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export default App;
