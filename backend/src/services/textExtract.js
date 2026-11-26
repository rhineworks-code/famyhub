'use strict';

const fs = require('fs');

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

const extractImageText = async (filePath) => {
    const sharp = require('sharp');
    const Tesseract = require('tesseract.js');
    const processed = `${filePath}-ocr.png`;
    let worker;
    try {
        await sharp(filePath).rotate().resize({ width: 2200, fit: 'inside', withoutEnlargement: true }).grayscale().normalize().toFile(processed);
        worker = await Tesseract.createWorker(['deu', 'eng']);
        const { data } = await worker.recognize(processed);
        return (data?.text || '').trim();
    } catch (err) {
        console.warn('[ocr] Bild-OCR auf dem Server fehlgeschlagen (Browser-OCR wird verwendet):', err.message);
        return '';
    } finally {
        if (worker) await worker.terminate().catch(() => {});
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
