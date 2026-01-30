// src/utils/api.js
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

axios.post(`${API_BASE}/api/auth/login`, payload);
