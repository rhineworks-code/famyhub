'use strict';

const nodemailer = require('nodemailer');
const db = require('../db');
const config = require('../config');

/** SMTP settings of the family, falling back to the SMTP_* environment variables. */
const getTransportConfig = async (familyId) => {
    const fam = familyId ? await db.get('SELECT smtp_host, smtp_port, smtp_user, smtp_pass, smtp_from FROM families WHERE id = ?', [familyId]) : null;
    if (fam && fam.smtp_host) {
        return { host: fam.smtp_host, port: Number(fam.smtp_port) || 587, user: fam.smtp_user, pass: fam.smtp_pass, from: fam.smtp_from || fam.smtp_user };
    }
    if (config.smtp.host) return { ...config.smtp, from: config.smtp.from || config.smtp.user };
    return null;
};

const sendMail = async (familyId, { to, subject, text, html }) => {
    const cfg = await getTransportConfig(familyId);
    if (!cfg) throw new Error('Kein E-Mail-Server (SMTP) konfiguriert.');
    const transporter = nodemailer.createTransport({
        host: cfg.host,
        port: cfg.port,
        secure: cfg.port === 465,
        auth: cfg.user ? { user: cfg.user, pass: cfg.pass } : undefined,
    });
    await transporter.sendMail({ from: cfg.from, to, subject, text, html });
};

module.exports = { sendMail, getTransportConfig };
