// server.js
// This is the backend API with HTTPS, authentication, CRM, and ticketing features.


const express = require('express');
const https = require('https');
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const multer = require('multer');
require('dotenv').config(); 

const app = express();
const PORT = 3001;

// --- Security Best Practice: Load secrets from environment variables ---
const JWT_SECRET = process.env.JWT_SECRET;
const DB_PASSWORD = process.env.DB_PASSWORD;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;

// Check if all required environment variables are set
if (!JWT_SECRET || !DB_PASSWORD || !SENDGRID_API_KEY) {
    console.error("FATAL ERROR: Missing required environment variables. Please check your .env file.");
    process.exit(1); // Exit the application if secrets are not configured
}

// --- Middleware ---
const corsOptions = {
  origin: 'https://fastit.co.za' // Replace with your actual domain
};
app.use(cors(corsOptions));
 // For production, restrict this to your frontend's domain
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
const upload = multer();

// --- Dynamic Path for Certificates ---
const basePath = process.pkg ? path.dirname(process.execPath) : __dirname;
const keyPath = path.join(basePath, 'key.pem');
const certPath = path.join(basePath, 'cert.pem');

// --- HTTPS Options ---
const httpsOptions = {
    key: fs.readFileSync(keyPath),
    cert: fs.readFileSync(certPath)
};

// --- Email Configuration ---
const mailTransporter = nodemailer.createTransport({
    host: "smtp.sendgrid.net",
    port: 465,
    secure: true,
    auth: {
        user: 'apikey',
        pass: SENDGRID_API_KEY
    }
});

// --- Database Configuration ---
const dbConfig = {
    host: 'localhost',
    user: 'root',
    password: DB_PASSWORD,
    database: 'fast_it_assets'
};

// Helper function to get a database connection
async function getConnection() {
    return await mysql.createConnection(dbConfig);
}

// --- Auth Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token == null) return res.sendStatus(401);
    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) return res.sendStatus(403);
        req.user = user;
        next();
    });
};

const isAdmin = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: 'Admin access required' });
    }
    next();
};

// === AUTH ROUTES ===
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ message: 'Username and password are required' });
    try {
        const connection = await getConnection();
        const [users] = await connection.execute('SELECT * FROM users WHERE username = ?', [username]);
        await connection.end();
        if (users.length === 0) return res.status(401).json({ message: 'Invalid credentials' });
        const user = users[0];
        const isPasswordCorrect = await bcrypt.compare(password, user.password);
        if (!isPasswordCorrect) return res.status(401).json({ message: 'Invalid credentials' });
        const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '1h' });
        res.json({ accessToken, user: { id: user.id, username: user.username, role: user.role } });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' });
    }
});

// === USER MANAGEMENT ROUTES (Admin only) ===
app.post('/api/users', authenticateToken, isAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    if (!username || !password || !role) return res.status(400).json({ message: 'Username, password, and role are required' });
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const connection = await getConnection();
        const [result] = await connection.execute('INSERT INTO users (username, password, role) VALUES (?, ?, ?)',[username, hashedPassword, role]);
        await connection.end();
        res.status(201).json({ id: result.insertId, username, role });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'Username already exists.' });
        res.status(500).json({ message: 'Failed to register user' });
    }
});

app.get('/api/users', authenticateToken, isAdmin, async (req, res) => {
     try {
        const connection = await getConnection();
        const [users] = await connection.execute('SELECT id, username, role FROM users');
        await connection.end();
        res.json(users);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch users' });
    }
});

app.delete('/api/users/:userId', authenticateToken, isAdmin, async (req, res) => {
    const { userId } = req.params;
    if (req.user.id == userId) return res.status(400).json({ message: "Cannot delete the currently logged-in user." });
    try {
        const connection = await getConnection();
        await connection.execute('DELETE FROM users WHERE id = ?', [userId]);
        await connection.end();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete user' });
    }
});

// === COMPANY (CRM) ROUTES ===
app.get('/api/companies', authenticateToken, async (req, res) => {
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM companies ORDER BY name ASC');
        await connection.end();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch companies' });
    }
});

app.post('/api/companies', authenticateToken, async (req, res) => {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Company name is required' });
    try {
        const connection = await getConnection();
        const [result] = await connection.execute('INSERT INTO companies (name) VALUES (?)', [name]);
        await connection.end();
        res.status(201).json({ id: result.insertId, name });
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'A company with this name already exists.' });
        res.status(500).json({ message: 'Failed to add company' });
    }
});

app.put('/api/companies/:companyId', authenticateToken, isAdmin, async (req, res) => {
    const { companyId } = req.params;
    const { name, contact_person, contact_email, contact_phone, address } = req.body;
    if (!name) return res.status(400).json({ message: 'Company name is required' });

    const query = `UPDATE companies SET name = ?, contact_person = ?, contact_email = ?, contact_phone = ?, address = ? WHERE id = ?`;
    const values = [name, contact_person, contact_email, contact_phone, address, companyId];
    try {
        const connection = await getConnection();
        await connection.execute(query, values);
        const [updatedCompany] = await connection.execute('SELECT * FROM companies WHERE id = ?', [companyId]);
        await connection.end();
        res.json(updatedCompany[0]);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update company' });
    }
});

app.delete('/api/companies/:companyId', authenticateToken, isAdmin, async (req, res) => {
    const { companyId } = req.params;
    try {
        const connection = await getConnection();
        await connection.execute('DELETE FROM companies WHERE id = ?', [companyId]);
        await connection.end();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete company' });
    }
});

// === ASSET ROUTES ===
app.get('/api/assets/:assetId', authenticateToken, async (req, res) => {
    const { assetId } = req.params;
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM assets WHERE id = ?', [assetId]);
        await connection.end();
        if (rows.length > 0) {
            res.json(rows[0]);
        } else {
            res.status(404).json({ message: 'Asset not found' });
        }
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch asset' });
    }
});
app.get('/api/companies/:companyId/assets', authenticateToken, async (req, res) => {
    const { companyId } = req.params;
    try {
        const connection = await getConnection();
        const [rows] = await connection.execute('SELECT * FROM assets WHERE company_id = ? ORDER BY asset_name ASC', [companyId]);
        await connection.end();
        res.json(rows);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch assets' });
    }
});
app.post('/api/assets', authenticateToken, async (req, res) => {
    const { company_id, asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system } = req.body;
    if (!company_id || !asset_name) return res.status(400).json({ message: 'Company ID and Device Name are required.' });
    const query = `INSERT INTO assets (company_id, asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const values = [company_id, asset_name, description, serial_number, status || 'In Use', device_type, owner_location, brand, model, operating_system];
    try {
        const connection = await getConnection();
        const [result] = await connection.execute(query, values);
        const [newAssetRows] = await connection.execute('SELECT * FROM assets WHERE id = ?', [result.insertId]);
        await connection.end();
        res.status(201).json(newAssetRows[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An asset with this serial number already exists.' });
        res.status(500).json({ message: 'Failed to add asset' });
    }
});
app.put('/api/assets/:assetId', authenticateToken, isAdmin, async (req, res) => {
    const { assetId } = req.params;
    const { asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system } = req.body;
    if (!asset_name) return res.status(400).json({ message: 'Device name is required.' });
    const query = `UPDATE assets SET asset_name = ?, description = ?, serial_number = ?, status = ?, device_type = ?, owner_location = ?, brand = ?, model = ?, operating_system = ? WHERE id = ?`;
    const values = [asset_name, description, serial_number, status, device_type, owner_location, brand, model, operating_system, assetId];
    try {
        const connection = await getConnection();
        await connection.execute(query, values);
        const [updatedAsset] = await connection.execute('SELECT * FROM assets WHERE id = ?', [assetId]);
        await connection.end();
        res.json(updatedAsset[0]);
    } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ message: 'An asset with this serial number already exists.' });
        res.status(500).json({ message: 'Failed to update asset.' });
    }
});
app.delete('/api/assets/:assetId', authenticateToken, isAdmin, async (req, res) => {
    const { assetId } = req.params;
    try {
        const connection = await getConnection();
        await connection.execute('DELETE FROM assets WHERE id = ?', [assetId]);
        await connection.end();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete asset' });
    }
});

// === TICKET ROUTES ===

// NEW: Email Webhook for creating/updating tickets
app.post('/api/tickets/email-webhook', upload.any(), async (req, res) => {
    console.log("Webhook received:", req.body);
    const from = req.body.from;
    const subject = req.body.subject;
    const text = req.body['text'] || req.body['plain'] || '';

    if (!from || !subject || !text) {
        console.error("Webhook received with missing data.", req.body);
        return res.status(400).json({ message: 'Webhook requires from, subject, and text fields.' });
    }

    const connection = await getConnection();
    try {
        const ticketIdMatch = subject.match(/\[Ticket #(\d+)\]/);
        
        if (ticketIdMatch && ticketIdMatch[1]) {
            const ticketId = ticketIdMatch[1];
            console.log(`Email is a reply to ticket #${ticketId}`);
            const [ticketRows] = await connection.execute('SELECT id, user_id FROM tickets WHERE id = ?', [ticketId]);
            if (ticketRows.length === 0) {
                console.log(`Ticket #${ticketId} not found for email reply.`);
                return res.status(404).send('Ticket not found.');
            }
            const userIdForUpdate = ticketRows[0].user_id;
            await connection.execute('INSERT INTO ticket_updates (ticket_id, user_id, update_text) VALUES (?, ?, ?)', [ticketId, userIdForUpdate, text]);
            await connection.execute('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?', [ticketId]);
            console.log(`Successfully added reply from ${from} to ticket #${ticketId}`);
        } else {
            console.log(`Email is a new ticket request from ${from}`);
            const [companies] = await connection.execute('SELECT id FROM companies WHERE contact_email = ?', [from]);
            const company_id = companies.length > 0 ? companies[0].id : 1; 
            const system_user_id = 2;
            const ticketQuery = `INSERT INTO tickets (company_id, user_id, title, description, priority, status, customer_email) VALUES (?, ?, ?, ?, ?, ?, ?)`;
            await connection.execute(ticketQuery, [company_id, system_user_id, subject, text, 'Normal', 'Open', from]);
            console.log(`Successfully created new ticket from email: ${from}`);
        }
        res.status(200).send('Email processed successfully.');
    } catch (error) {
        console.error('Failed to process email from webhook:', error);
        res.status(500).json({ message: 'Failed to process email.' });
    } finally {
        await connection.end();
    }
});


app.get('/api/tickets', authenticateToken, async (req, res) => {
    try {
        const connection = await getConnection();
        const query = `
            SELECT t.*, c.name as company_name, u.username as user_name, au.username as assigned_user_name
            FROM tickets t
            JOIN companies c ON t.company_id = c.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users au ON t.assigned_user_id = au.id
            ORDER BY t.updated_at DESC
        `;
        const [tickets] = await connection.execute(query);
        await connection.end();
        res.json(tickets);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch tickets' });
    }
});

app.get('/api/tickets/:ticketId', authenticateToken, async (req, res) => {
    const { ticketId } = req.params;
    const connection = await getConnection();
    try {
        const ticketQuery = `
            SELECT t.*, c.name as company_name, u.username as user_name, au.username as assigned_user_name
            FROM tickets t
            JOIN companies c ON t.company_id = c.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users au ON t.assigned_user_id = au.id
            WHERE t.id = ?
        `;
        const [ticketRows] = await connection.execute(ticketQuery, [ticketId]);
        if (ticketRows.length === 0) return res.status(404).json({ message: 'Ticket not found' });

        const updatesQuery = `
            SELECT tu.*, u.username as user_name 
            FROM ticket_updates tu
            JOIN users u ON tu.user_id = u.id
            WHERE tu.ticket_id = ? ORDER BY tu.created_at ASC
        `;
        const [updates] = await connection.execute(updatesQuery, [ticketId]);

        const assetsQuery = `
            SELECT a.* FROM assets a
            JOIN ticket_assets ta ON a.id = ta.asset_id
            WHERE ta.ticket_id = ?
        `;
        const [assets] = await connection.execute(assetsQuery, [ticketId]);

        await connection.end();
        res.json({ ...ticketRows[0], updates, assets });

    } catch (error) {
        await connection.end();
        res.status(500).json({ message: 'Failed to fetch ticket details' });
    }
});

// MODIFIED: This route now sends an email upon successful ticket creation.
app.post('/api/tickets', authenticateToken, async (req, res) => {
    const { company_id, title, description, priority, asset_ids, customer_email } = req.body;
    const user_id = req.user.id;
    if (!company_id || !title || !description) return res.status(400).json({ message: 'Company, title, and description are required.' });

    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        const ticketQuery = 'INSERT INTO tickets (company_id, user_id, title, description, priority, customer_email) VALUES (?, ?, ?, ?, ?, ?)';
        const [ticketResult] = await connection.execute(ticketQuery, [company_id, user_id, title, description, priority || 'Normal', customer_email]);
        const newTicketId = ticketResult.insertId;

        if (asset_ids && asset_ids.length > 0) {
            const ticketAssetsQuery = 'INSERT INTO ticket_assets (ticket_id, asset_id) VALUES ?';
            const ticketAssetsValues = asset_ids.map(assetId => [newTicketId, assetId]);
            await connection.query(ticketAssetsQuery, [ticketAssetsValues]);
        }
        
        await connection.commit();

        // --- NEW: Send email notification for manually created tickets ---
        if (customer_email) {
            try {
                console.log(`Sending new ticket confirmation to ${customer_email}`);
                await mailTransporter.sendMail({
                    from: '"Fast IT Support" <ruan@fastit.co.za>',
                    to: customer_email,
                    subject: `[Ticket #${newTicketId}] Your support request has been received: ${title}`,
                    html: `
                        <p>Hello,</p>
                        <p>Thank you for contacting us. We have created a support ticket for you.</p>
                        <p>Your Ticket ID is: <b>#${newTicketId}</b></p>
                        <p><b>Subject:</b> ${title}</p>
                        <p><b>Priority:</b> ${priority}</p>
                        <hr>
                        <P>${description}</P>
                        <hr>
                        <p>Our team will review your request and get back to you shortly. You can reply directly to this email to add updates to your ticket.</p>
                    `
                });
                console.log("New ticket confirmation email sent successfully.");
            } catch (emailError) {
                // Log the email error but don't fail the entire request
                console.error("Failed to send new ticket confirmation email:", emailError);
            }
        }
        // --- END OF NEW EMAIL LOGIC ---

        const [newTicket] = await connection.execute(`
            SELECT t.*, c.name as company_name, u.username as user_name, au.username as assigned_user_name 
            FROM tickets t
            JOIN companies c ON t.company_id = c.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users au ON t.assigned_user_id = au.id
            WHERE t.id = ?
        `, [newTicketId]);
        
        res.status(201).json(newTicket[0]);
    } catch (error) {
        await connection.rollback();
        console.error("Error creating ticket:", error);
        res.status(500).json({ message: 'Failed to create ticket' });
    } finally {
        await connection.end();
    }
});


app.post('/api/tickets/:ticketId/updates', authenticateToken, async (req, res) => {
    const { ticketId } = req.params;
    const { update_text } = req.body;
    const user_id = req.user.id;
    if (!update_text) return res.status(400).json({ message: 'Update text cannot be empty.' });

    const connection = await getConnection();
    try {
        await connection.beginTransaction();
        const updateQuery = 'INSERT INTO ticket_updates (ticket_id, user_id, update_text) VALUES (?, ?, ?)';
        const [updateResult] = await connection.execute(updateQuery, [ticketId, user_id, update_text]);
        
        await connection.execute('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP, status = ? WHERE id = ?', ['In Progress', ticketId]);

        await connection.commit();

        const [newUpdate] = await connection.execute(`
            SELECT tu.*, u.username as user_name 
            FROM ticket_updates tu
            JOIN users u ON tu.user_id = u.id
            WHERE tu.id = ?
        `, [updateResult.insertId]);
        
        const [ticketRows] = await connection.execute('SELECT title, customer_email FROM tickets WHERE id = ?', [ticketId]);
        if (ticketRows.length > 0 && ticketRows[0].customer_email) {
            const ticket = ticketRows[0];
            console.log(`Sending update email to ${ticket.customer_email}`);

            await mailTransporter.sendMail({
                from: '"Fast IT Support" <ruan@fastit.co.za>',
                to: ticket.customer_email,
                subject: `Re: [Ticket #${ticketId}] ${ticket.title}`,
                html: `
                    <p>Hello,</p>
                    <p>A new reply has been posted to your support ticket by our team.</p>
                    <hr style="border:none; border-top: 1px solid #eee;">
                    <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px;">
                        <p><b>${newUpdate[0].user_name} wrote:</b></p>
                        <p style="white-space: pre-wrap;">${update_text}</p>
                    </div>
                    <hr style="border:none; border-top: 1px solid #eee;">
                    <p>You can reply directly to this email to add another update to the ticket.</p>
                    <p style="font-size: 12px; color: #888;">Please do not change the subject line to ensure your reply is tracked correctly.</p>
                `
            });
            console.log("Email sent successfully.");
        }

        res.status(201).json(newUpdate[0]);

    } catch (error) {
        await connection.rollback();
        console.error("Error in ticket update process:", error);
        res.status(500).json({ message: 'Failed to add update' });
    } finally {
        await connection.end();
    }
});

// MODIFIED: This route now sends emails for status, priority and assignment changes.
app.put('/api/tickets/:ticketId', authenticateToken, isAdmin, async (req, res) => {
    const { ticketId } = req.params;
    const { status, priority, assigned_user_id } = req.body;
    
    const connection = await getConnection();
    try {
        // 1. Get the current state of the ticket BEFORE updating
        const [beforeUpdateRows] = await connection.execute('SELECT * FROM tickets WHERE id = ?', [ticketId]);
        if (beforeUpdateRows.length === 0) {
            return res.status(404).json({ message: 'Ticket not found' });
        }
        const oldTicket = beforeUpdateRows[0];

        // 2. Update the ticket in the database
        await connection.execute(
            'UPDATE tickets SET status = ?, priority = ?, assigned_user_id = ? WHERE id = ?', 
            [status, priority, assigned_user_id || null, ticketId]
        );

        // 3. Get the fully updated ticket details (with new assignee name if changed)
        const [updatedTicketRows] = await connection.execute(`
            SELECT t.*, c.name as company_name, u.username as user_name, au.username as assigned_user_name
            FROM tickets t
            JOIN companies c ON t.company_id = c.id
            JOIN users u ON t.user_id = u.id
            LEFT JOIN users au ON t.assigned_user_id = au.id
            WHERE t.id = ?
        `, [ticketId]);
        const updatedTicket = updatedTicketRows[0];
        
        // 4. Check for changes and send emails if necessary
        if (updatedTicket.customer_email) {
            // Check for status change
            if (oldTicket.status !== updatedTicket.status) {
                console.log(`Status changed from ${oldTicket.status} to ${updatedTicket.status}. Sending email.`);
                await mailTransporter.sendMail({
                    from: '"Fast IT Support" <ruan@fastit.co.za>',
                    to: updatedTicket.customer_email,
                    subject: `Re: [Ticket #${ticketId}] Status Updated: ${updatedTicket.title}`,
                    html: `<p>Hello,</p><p>The status of your support ticket has been updated from <b>${oldTicket.status}</b> to <b>${updatedTicket.status}</b>.</p>`
                });
            }

            // Check for priority change
            if (oldTicket.priority !== updatedTicket.priority) {
                console.log(`Priority changed from ${oldTicket.priority} to ${updatedTicket.priority}. Sending email.`);
                await mailTransporter.sendMail({
                    from: '"Fast IT Support" <ruan@fastit.co.za>',
                    to: updatedTicket.customer_email,
                    subject: `Re: [Ticket #${ticketId}] Priority Updated: ${updatedTicket.title}`,
                    html: `<p>Hello,</p><p>The priority of your support ticket has been updated from <b>${oldTicket.priority}</b> to <b>${updatedTicket.priority}</b>.</p>`
                });
            }

            // Check for assignment change
            if (oldTicket.assigned_user_id !== updatedTicket.assigned_user_id) {
                const assigneeName = updatedTicket.assigned_user_name || 'our team';
                console.log(`Ticket assigned to ${assigneeName}. Sending email.`);
                await mailTransporter.sendMail({
                    from: '"Fast IT Support" <ruan@fastit.co.za>',
                    to: updatedTicket.customer_email,
                    subject: `Re: [Ticket #${ticketId}] Your Ticket Has Been Assigned: ${updatedTicket.title}`,
                    html: `<p>Hello,</p><p>Your support ticket has been assigned to <b>${assigneeName}</b>. They will be in touch with you shortly.</p>`
                });
            }
        }
        
        res.json(updatedTicket);
    } catch (error) {
        console.error("Error updating ticket:", error);
        res.status(500).json({ message: 'Failed to update ticket' });
    } finally {
        await connection.end();
    }
});

app.delete('/api/tickets/:ticketId', authenticateToken, isAdmin, async (req, res) => {
    const { ticketId } = req.params;
    try {
        const connection = await getConnection();
        await connection.execute('DELETE FROM tickets WHERE id = ?', [ticketId]);
        await connection.end();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Failed to delete ticket' });
    }
});


// --- Start the Server ---
https.createServer(httpsOptions, app).listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on https://localhost:${PORT}`);
});
