'use strict';

const fs = require('fs');
const path = require('path');
const config = require('../config');

const OCR_TIMEOUT_MS = Number(process.env.OCR_TIMEOUT_MS) || 90_000;
const withTimeout = (promise, ms, label) => Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label}: Zeitüberschreitung`)), ms)),
]);

/**
 * Text extraction for uploaded documents.
 *
 * Bug in the old version: pdf-parse v2 no longer exports a function, the old
 * call `require('pdf-parse')(buffer)` always threw and silently fell back to a
 * crude regex scan – PDF search basically never worked.
 */
const extractPdfText = async (buffer) => {
    try {
        const { PDFParse } = require('pdf-parse');
        const parser = new PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            const text = (result?.text || '').replace(/^-- \d+ of \d+ --$/gm, '').replace(/\n{3,}/g, '\n\n').trim();
            if (text.length > 5) return text;
        } finally {
            await parser.destroy().catch(() => {});
        }
    } catch (err) {
        console.warn('[ocr] pdf-parse fehlgeschlagen:', err.message);
    }
    return '';
};

/**
 * One shared OCR worker for the whole process (starting one per image is slow and,
 * when the language data cannot be downloaded, every attempt left a hanging thread).
 * After a failed start we wait 10 minutes before trying again.
 */
let workerPromise = null;
let workerFailedAt = 0;
const RETRY_AFTER_MS = 10 * 60 * 1000;

const getWorker = () => {
    if (workerPromise) return workerPromise;
    if (workerFailedAt && Date.now() - workerFailedAt < RETRY_AFTER_MS) return Promise.reject(new Error('OCR ist vorübergehend nicht verfügbar'));
    const Tesseract = require('tesseract.js');
    // errorHandler is essential: without it tesseract.js throws worker errors (e.g. when the
    // language data cannot be downloaded) asynchronously and the whole server process crashes.
    workerPromise = withTimeout(Tesseract.createWorker(['deu', 'eng'], 1, {
        cachePath: path.join(config.dataDir, 'tessdata'),
        errorHandler: (err) => console.warn('[ocr] Worker-Fehler:', err?.message || err),
    }), OCR_TIMEOUT_MS, 'OCR-Start').catch((err) => {
        workerPromise = null;
        workerFailedAt = Date.now();
        throw err;
    });
    return workerPromise;
};

const extractImageText = async (filePath) => {
    const sharp = require('sharp');
    const processed = `${filePath}-ocr.png`;
    try {
        await sharp(filePath).rotate().resize({ width: 2200, fit: 'inside', withoutEnlargement: true }).grayscale().normalize().toFile(processed);
        const worker = await getWorker();
        const { data } = await withTimeout(worker.recognize(processed), OCR_TIMEOUT_MS, 'OCR');
        return (data?.text || '').trim();
    } catch (err) {
        console.warn('[ocr] Bild-OCR fehlgeschlagen:', err.message);
        return '';
    } finally {
        fs.promises.unlink(processed).catch(() => {});
    }
};

const extractText = async (filePath, mimetype = '') => {
    try {
        if (mimetype === 'application/pdf' || filePath.toLowerCase().endsWith('.pdf')) {
            return await extractPdfText(await fs.promises.readFile(filePath));
        }
        if (mimetype === 'text/plain') return (await fs.promises.readFile(filePath, 'utf8')).slice(0, 500_000);
        if (mimetype.startsWith('image/')) return await extractImageText(filePath);
    } catch (err) {
        console.warn('[ocr] Fehler:', err.message);
    }
    return '';
};

module.exports = { extractText, extractPdfText };
