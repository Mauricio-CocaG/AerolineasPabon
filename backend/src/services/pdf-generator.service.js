/**
 * BOARDING PASS PDF GENERATOR — AEROLÍNEAS PABÓN
 * Premium e-boarding pass with gradient header, perforated edges, QR & barcode
 */

const PDFDocument = require('pdfkit');
const fs          = require('fs');
const path        = require('path');
const QRCode      = require('qrcode');

// ── City name lookup (IATA → readable) ─────────────────────────────────────
const CITIES = {
    ATL: 'Atlanta, USA',       DFW: 'Dallas, USA',
    LON: 'London, UK',         LHR: 'London, UK',
    PEK: 'Beijing, China',     DXB: 'Dubai, UAE',
    TYO: 'Tokyo, Japan',       NRT: 'Tokyo, Japan',
    PAR: 'Paris, France',      CDG: 'Paris, France',
    LAX: 'Los Angeles, USA',   JFK: 'New York, USA',
    FRA: 'Frankfurt, Germany', IST: 'Istanbul, Turkey',
    SIN: 'Singapore',          MAD: 'Madrid, Spain',
    AMS: 'Amsterdam, NL',      CAN: 'Guangzhou, China',
    SAO: 'Sao Paulo, Brazil',  SYD: 'Sydney, Australia',
    BOG: 'Bogota, Colombia',   MIA: 'Miami, USA',
    ORD: 'Chicago, USA',       BKK: 'Bangkok, Thailand',
    ICN: 'Seoul, South Korea', DEL: 'New Delhi, India',
    GRU: 'Sao Paulo, Brazil',  MEX: 'Mexico City, Mexico',
    SCL: 'Santiago, Chile',    LIM: 'Lima, Peru',
};

class PDFGeneratorService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../output');
        if (!fs.existsSync(this.outputDir))
            fs.mkdirSync(this.outputDir, { recursive: true });
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    _fmtDate(d) {
        try {
            const s = typeof d === 'string' ? d.split('T')[0] : d.toISOString().split('T')[0];
            const dt = new Date(s + 'T12:00:00Z');
            return dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        } catch { return String(d || ''); }
    }

    _fmtDuration(hours) {
        if (!hours) return null;
        const h = Math.floor(Number(hours));
        const m = Math.round((Number(hours) - h) * 60);
        return m > 0 ? `${h}h ${String(m).padStart(2,'0')}m` : `${h}h`;
    }

    // Draw a perforated tear-line at Y with semicircle notches on each side
    _perfEdge(doc, y, W, pageBg) {
        const R = 13;
        doc.save()
            .circle(-R + 1, y, R).fill(pageBg)
            .circle(W + R - 1, y, R).fill(pageBg);
        // dashed line between notches
        doc.save().opacity(0.18).strokeColor('#7B8DBB').lineWidth(1.5);
        for (let x = R * 2 + 6; x < W - R * 2 - 6; x += 10)
            doc.moveTo(x, y).lineTo(x + 5, y).stroke();
        doc.restore().restore();
    }

    // Small label in muted uppercase
    _lbl(doc, text, x, y, w, align = 'left') {
        doc.save()
            .fillColor('#9AAAC2').fontSize(6).font('Helvetica')
            .text(text, x, y, { width: w, align, characterSpacing: 1.3, lineBreak: false })
            .restore();
    }

    // Bold value
    _val(doc, text, x, y, w, align = 'left', size = 12, color = '#142258') {
        doc.save()
            .fillColor(color).fontSize(size).font('Helvetica-Bold')
            .text(String(text), x, y, { width: w, align, lineBreak: false })
            .restore();
    }

    // ── MAIN: generateBoardingPass ────────────────────────────────────────────

    async generateBoardingPass(bookingData) {
        const {
            ticketNumber, passengerName, passportNumber,
            flightNumber, origin, destination,
            departureDate, departureTime,
            seatNumber, classType, gate, price,
            durationHours, bookingReference,
        } = bookingData;

        const fmtDate     = this._fmtDate(departureDate);
        const fmtTime     = (departureTime || '').substring(0, 5);
        const duration    = this._fmtDuration(durationHours);
        const originCity  = CITIES[origin]      || '';
        const destCity    = CITIES[destination] || '';
        const isFirst     = classType === 'FIRST';
        const accent      = isFirst ? '#D97706' : '#3960FB';
        const accentLight = isFirst ? '#FEF3C7' : '#EEF2FF';
        const classLabel  = isFirst ? 'Business Class' : 'Economy Class';

        // ── QR CODE ──────────────────────────────────────────────────────────
        const qrPayload = JSON.stringify({
            ticket:    ticketNumber,
            passenger: passengerName,
            flight:    flightNumber,
            seat:      seatNumber,
            from:      origin,
            to:        destination,
            date:      fmtDate,
            time:      fmtTime,
            gate:      gate,
            class:     classType,
            ref:       bookingReference,
        });
        const qrBuffer = await QRCode.toBuffer(qrPayload, {
            errorCorrectionLevel: 'M',
            margin: 2,
            width: 120,
            color: { dark: '#142258', light: '#ffffff' },
        });

        // ── DOCUMENT SETUP ────────────────────────────────────────────────────
        const W         = 400;
        const H         = 672;
        const HEADER_H  = 222;   // gradient blue area
        const PERF_Y    = HEADER_H;
        const BODY_Y    = PERF_Y + 14;   // 236
        const STUB_Y    = 453;   // second tear line
        const M         = 22;    // horizontal margin
        const PAGE_BG   = '#E8EDFF';  // lavender page background

        const filename = `boarding_pass_${ticketNumber}_${Date.now()}.pdf`;
        const filePath = path.join(this.outputDir, filename);
        const doc = new PDFDocument({ size: [W, H], margin: 0 });
        const ws  = fs.createWriteStream(filePath);
        doc.pipe(ws);

        // ──────────────────────────────────────────────────────────────────────
        // 1. PAGE BACKGROUND
        // ──────────────────────────────────────────────────────────────────────
        doc.rect(0, 0, W, H).fill(PAGE_BG);

        // ──────────────────────────────────────────────────────────────────────
        // 2. GRADIENT HEADER  (#3960FB → #0D1D5A)
        // ──────────────────────────────────────────────────────────────────────
        const grad = doc.linearGradient(0, 0, 0, HEADER_H);
        grad.stop(0, '#3960FB');
        grad.stop(1, '#0D1D5A');
        doc.rect(0, 0, W, HEADER_H).fill(grad);

        // "E-BOARDING PASS" — top left label
        doc.save()
            .fillColor('white').opacity(0.50).fontSize(7).font('Helvetica')
            .text('E-BOARDING PASS', M, 17, { characterSpacing: 2.5, lineBreak: false })
            .restore();

        // Flight number — top right
        doc.save()
            .fillColor('white').opacity(1).fontSize(9).font('Helvetica-Bold')
            .text(flightNumber, M, 17, { width: W - M * 2, align: 'right', lineBreak: false })
            .restore();

        // Airline name
        doc.save()
            .fillColor('white').opacity(0.92).fontSize(10).font('Helvetica-Bold')
            .text('AEROLINEAS PABON', M, 34, { characterSpacing: 0.6, lineBreak: false })
            .restore();

        // Subtle horizontal rule below airline name
        doc.save()
            .opacity(0.20).strokeColor('white').lineWidth(0.5)
            .moveTo(M, 50).lineTo(W - M, 50).stroke()
            .restore();

        // ── ORIGIN / DESTINATION CODES ────────────────────────────────────────
        const codeY = 60;
        doc.save()
            .fillColor('white').opacity(1).fontSize(48).font('Helvetica-Bold')
            .text(origin, M, codeY, { lineBreak: false })
            .restore();
        doc.save()
            .fillColor('white').opacity(1).fontSize(48).font('Helvetica-Bold')
            .text(destination, M, codeY, { width: W - M * 2, align: 'right', lineBreak: false })
            .restore();

        // City names
        if (originCity) {
            doc.save()
                .fillColor('white').opacity(0.50).fontSize(7.5).font('Helvetica')
                .text(originCity, M, codeY + 52, { lineBreak: false })
                .restore();
        }
        if (destCity) {
            doc.save()
                .fillColor('white').opacity(0.50).fontSize(7.5).font('Helvetica')
                .text(destCity, M, codeY + 52, { width: W - M * 2, align: 'right', lineBreak: false })
                .restore();
        }

        // ── ROUTE LINE with plane ──────────────────────────────────────────────
        const arrowY = codeY + 30;
        const lx1    = M + 80;       // left anchor dot
        const lx2    = W - M - 80;   // right anchor dot
        const midX   = W / 2;

        // Dots at each end
        doc.save().opacity(0.65).circle(lx1, arrowY, 3).fill('white').restore();
        doc.save().opacity(0.65).circle(lx2, arrowY, 3).fill('white').restore();

        // Dashed lines left of plane
        doc.save().opacity(0.30).strokeColor('white').lineWidth(1);
        for (let dx = lx1 + 7; dx < midX - 16; dx += 9)
            doc.moveTo(dx, arrowY).lineTo(Math.min(dx + 5, midX - 16), arrowY).stroke();
        // Dashed lines right of plane
        for (let dx = midX + 16; dx < lx2 - 6; dx += 9)
            doc.moveTo(dx, arrowY).lineTo(Math.min(dx + 5, lx2 - 6), arrowY).stroke();
        doc.restore();

        // Plane shape (pointing right) drawn with PDF paths
        {
            const px = midX - 11, py = arrowY - 9;
            doc.save().fillColor('white').opacity(1);
            // Fuselage
            doc.moveTo(px,      py + 9)
               .lineTo(px + 20, py + 5)
               .lineTo(px + 20, py + 8)
               .lineTo(px,      py + 12)
               .closePath().fill('white');
            // Wing
            doc.moveTo(px + 6,  py + 9)
               .lineTo(px + 14, py + 2)
               .lineTo(px + 16, py + 4)
               .lineTo(px + 9,  py + 9)
               .closePath().fill('white');
            // Tail fin
            doc.moveTo(px + 2,  py + 10)
               .lineTo(px,      py + 7)
               .lineTo(px + 5,  py + 9)
               .closePath().fill('white');
            doc.restore();
        }

        // Duration pill (e.g. "10h 30m")
        if (duration) {
            const dW = 70, dH = 17;
            const dX = midX - dW / 2;
            const dY = arrowY + 9;
            doc.save()
                .opacity(0.20).roundedRect(dX, dY, dW, dH, 8).fill('white')
                .restore();
            doc.save()
                .fillColor('white').opacity(1).fontSize(8).font('Helvetica-Bold')
                .text(duration, dX, dY + 4, { width: dW, align: 'center', lineBreak: false })
                .restore();
        }

        // ── DEPARTURE + GATE info at the bottom of the header ─────────────────
        const dinfoY = HEADER_H - 58;

        doc.save()
            .fillColor('white').opacity(0.45).fontSize(6).font('Helvetica')
            .text('DEPARTURE', M, dinfoY, { characterSpacing: 1.5, lineBreak: false })
            .restore();
        doc.save()
            .fillColor('white').opacity(1).fontSize(10.5).font('Helvetica-Bold')
            .text(fmtDate, M, dinfoY + 11, { lineBreak: false })
            .restore();
        doc.save()
            .fillColor('white').opacity(0.85).fontSize(9).font('Helvetica')
            .text(fmtTime, M, dinfoY + 25, { lineBreak: false })
            .restore();

        doc.save()
            .fillColor('white').opacity(0.45).fontSize(6).font('Helvetica')
            .text('GATE', M, dinfoY, { width: W - M * 2, align: 'right', characterSpacing: 1.5, lineBreak: false })
            .restore();
        doc.save()
            .fillColor('white').opacity(1).fontSize(26).font('Helvetica-Bold')
            .text(gate || 'TBD', M, dinfoY + 8, { width: W - M * 2, align: 'right', lineBreak: false })
            .restore();

        // ──────────────────────────────────────────────────────────────────────
        // 3. PERFORATED EDGE #1  (header → body)
        // ──────────────────────────────────────────────────────────────────────
        this._perfEdge(doc, PERF_Y, W, PAGE_BG);

        // ──────────────────────────────────────────────────────────────────────
        // 4. WHITE BODY
        // ──────────────────────────────────────────────────────────────────────
        doc.save()
            .rect(M, BODY_Y, W - M * 2, STUB_Y - BODY_Y - 4)
            .fill('white')
            .restore();

        // Inner content margins
        const bX = M + 16;
        const bW = W - M * 2 - 32;
        let   cY = BODY_Y + 18;

        // ── INFO GRID: Seat Class | Time | Seat ──────────────────────────────
        const COL = bW / 3;
        this._lbl(doc, 'SEAT CLASS', bX,            cY, COL - 4);
        this._lbl(doc, 'DEPARTURE',  bX + COL,      cY, COL - 4, 'center');
        this._lbl(doc, 'SEAT',       bX + COL * 2,  cY, COL,     'right');

        cY += 10;
        this._val(doc, classLabel,  bX,           cY, COL - 4, 'left',   10);
        this._val(doc, fmtTime,     bX + COL,     cY, COL - 4, 'center', 13);
        this._val(doc, seatNumber,  bX + COL * 2, cY, COL,     'right',  13, accent);

        cY += 30;
        // Divider
        doc.save().opacity(0.09).rect(bX, cY, bW, 0.5).fill('#142258').restore();
        cY += 14;

        // ── CLASS BADGE ───────────────────────────────────────────────────────
        const bBadgeW = 92, bBadgeH = 19;
        doc.save()
            .roundedRect(bX, cY, bBadgeW, bBadgeH, 9)
            .fill(accentLight)
            .restore();
        doc.save()
            .fillColor(accent).fontSize(7.5).font('Helvetica-Bold')
            .text(classLabel, bX, cY + 6, { width: bBadgeW, align: 'center', lineBreak: false })
            .restore();

        // Booking reference on the right of the badge
        if (bookingReference) {
            const refX = bX + bBadgeW + 10;
            const refW = bW - bBadgeW - 10;
            this._lbl(doc, 'BOOKING REF', refX, cY + 2, refW, 'right');
            this._val(doc, bookingReference, refX, cY + 12, refW, 'right', 8);
        }

        cY += bBadgeH + 16;
        doc.save().opacity(0.08).rect(bX, cY, bW, 0.5).fill('#142258').restore();
        cY += 13;

        // ── PASSENGER SECTION ─────────────────────────────────────────────────
        this._lbl(doc, 'PASSENGER', bX, cY, bW);
        cY += 11;

        // Avatar circle with initials
        const aR       = 21;
        const initials = (passengerName || '  ')
            .trim().split(/\s+/).filter(Boolean)
            .map(n => n[0].toUpperCase()).slice(0, 2).join('');
        const avX = bX, avY = cY;

        doc.save().circle(avX + aR, avY + aR, aR).fill(accentLight).restore();
        doc.save()
            .fillColor(accent).fontSize(10.5).font('Helvetica-Bold')
            .text(initials, avX + 1, avY + aR - 7, { width: aR * 2, align: 'center', lineBreak: false })
            .restore();

        // Name + passport
        const nX = avX + aR * 2 + 12;
        const nW = bW - aR * 2 - 12 - 44;
        doc.save()
            .fillColor('#142258').fontSize(11).font('Helvetica-Bold')
            .text(passengerName || '', nX, avY + 4, { width: nW, lineBreak: false })
            .restore();
        doc.save()
            .fillColor('#9AAAC2').fontSize(7.5).font('Helvetica')
            .text('ID: ' + (passportNumber || ''), nX, avY + 21, { width: nW, lineBreak: false })
            .restore();

        // Seat badge on far right
        this._lbl(doc, 'SEAT', bX + bW - 40, avY + 2,  40, 'right');
        this._val(doc, seatNumber, bX + bW - 40, avY + 13, 40, 'right', 15, accent);

        cY += aR * 2 + 14;
        doc.save().opacity(0.08).rect(bX, cY, bW, 0.5).fill('#142258').restore();
        cY += 12;

        // ── PRICE + TICKET ROW ────────────────────────────────────────────────
        const halfW = bW / 2;
        this._lbl(doc, 'TOTAL PAID', bX,          cY, halfW);
        this._lbl(doc, 'TICKET NO.', bX + halfW,  cY, halfW, 'right');
        cY += 10;
        this._val(doc, '$' + parseFloat(price || 0).toLocaleString(), bX, cY, halfW, 'left', 14, accent);
        this._val(doc, ticketNumber, bX + halfW, cY + 2, halfW, 'right', 8.5);

        // ──────────────────────────────────────────────────────────────────────
        // 5. PERFORATED EDGE #2  (body → stub)
        // ──────────────────────────────────────────────────────────────────────
        this._perfEdge(doc, STUB_Y, W, PAGE_BG);

        // ──────────────────────────────────────────────────────────────────────
        // 6. STUB AREA  (QR code + barcode)
        // ──────────────────────────────────────────────────────────────────────
        const stubBodyY = STUB_Y + 12;
        doc.save()
            .rect(M, stubBodyY, W - M * 2, H - stubBodyY - M)
            .fill('white')
            .restore();

        // QR code — centered
        const qrSz = 108;
        const qrX  = (W - qrSz) / 2;
        const qrY  = stubBodyY + 12;

        // Tiny white border around QR
        doc.save().roundedRect(qrX - 5, qrY - 5, qrSz + 10, qrSz + 10, 4).fill('white').restore();
        doc.image(qrBuffer, qrX, qrY, { width: qrSz, height: qrSz });

        // Barcode (visual pattern derived from ticket number)
        const bcY = qrY + qrSz + 12;
        const bcH = 36;
        const bcX = bX;
        const bcW = bW;

        // Generate bar widths from ticket number characters for visual authenticity
        const seed = (ticketNumber || 'TK000000').replace(/[^A-Z0-9]/g, '');
        const bars = [];
        for (let i = 0; i < seed.length; i++) {
            const code = seed.charCodeAt(i);
            bars.push(((code % 3) + 1));        // narrow, medium, or wide bar
            bars.push(((code >> 2) % 2) + 1);   // narrow or medium space
        }
        // Pad to fill width
        while (bars.length < 32) bars.push(1, 1);
        const totalBarW = bars.reduce((a, b) => a + b, 0);

        let barX = bcX;
        bars.forEach((w, i) => {
            const bw = (w / totalBarW) * bcW;
            if (i % 2 === 0) {
                // Bar (dark)
                doc.save().rect(barX, bcY, Math.max(bw - 0.5, 0.5), bcH).fill('#142258').restore();
            }
            barX += bw;
        });

        // Ticket number centered below barcode
        doc.save()
            .fillColor('#9AAAC2').fontSize(7).font('Helvetica')
            .text(ticketNumber, bX, bcY + bcH + 6, { width: bW, align: 'center', characterSpacing: 2.5, lineBreak: false })
            .restore();

        // Footer note
        doc.save()
            .fillColor('#B8C6E8').fontSize(5.8).font('Helvetica')
            .text(
                'Arrive at gate 30 min before departure  *  Aerolineas Pabon  *  Sistemas Distribuidos  *  2026',
                bX, H - M + 3, { width: bW, align: 'center', lineBreak: false }
            ).restore();

        // ── Tiny accent line at top of stub for visual polish ─────────────────
        const gradStub = doc.linearGradient(M, stubBodyY, W - M, stubBodyY);
        gradStub.stop(0, '#3960FB').stop(0.5, accent).stop(1, '#3960FB');
        doc.save().rect(M, stubBodyY, W - M * 2, 2).fill(gradStub).restore();

        // ──────────────────────────────────────────────────────────────────────
        doc.end();
        await new Promise(r => ws.on('finish', r));
        return { success: true, filePath, filename, message: 'Boarding pass generated' };
    }

    // ── getBoardingPassBase64 ─────────────────────────────────────────────────

    async getBoardingPassBase64(bookingData) {
        const result = await this.generateBoardingPass(bookingData);
        if (result.success) {
            const buf = fs.readFileSync(result.filePath);
            return { success: true, base64: buf.toString('base64'), filename: result.filename };
        }
        return result;
    }

    // ── generateWalletPass ────────────────────────────────────────────────────

    async generateWalletPass(bookingData) {
        const {
            ticketNumber, passengerName, flightNumber,
            origin, destination, departureDate, departureTime,
            seatNumber, gate, classType,
        } = bookingData;

        let fmtDate = departureDate;
        try {
            fmtDate = typeof departureDate === 'string'
                ? departureDate.split('T')[0]
                : departureDate.toISOString().split('T')[0];
        } catch { /* keep original */ }

        const walletData = {
            format:             'PASS',
            version:            '1.0',
            passTypeIdentifier: 'pass.com.aerolineaspabon.boardingpass',
            serialNumber:       ticketNumber,
            description:        'Aerolineas Pabon Boarding Pass',
            organizationName:   'Aerolineas Pabon',
            logoText:           'Aerolineas Pabon',
            backgroundColor:    '#3960FB',
            foregroundColor:    '#FFFFFF',
            labelColor:         '#C2CEFE',
            relevantDate:       fmtDate + 'T' + (departureTime || '00:00') + ':00',
            boardingPass: {
                transitType: 'PKTransitTypeAir',
                headerFields: [
                    { key: 'origin',      label: 'FROM', value: origin },
                    { key: 'destination', label: 'TO',   value: destination },
                ],
                primaryFields: [
                    { key: 'passenger', label: 'PASSENGER', value: passengerName },
                    { key: 'flight',    label: 'FLIGHT',    value: flightNumber },
                ],
                secondaryFields: [
                    { key: 'seat',  label: 'SEAT',  value: seatNumber },
                    { key: 'gate',  label: 'GATE',  value: gate || 'TBD' },
                    { key: 'date',  label: 'DATE',  value: fmtDate },
                    { key: 'time',  label: 'TIME',  value: departureTime },
                    { key: 'class', label: 'CLASS', value: classType === 'FIRST' ? 'Business' : 'Economy' },
                ],
                auxiliaryFields: [
                    { key: 'ticket', label: 'TICKET', value: ticketNumber },
                ],
            },
        };

        const qrBuffer = await QRCode.toBuffer(JSON.stringify(walletData), {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 280,
            color: { dark: '#142258', light: '#ffffff' },
        });
        const qrBase64 = `data:image/png;base64,${qrBuffer.toString('base64')}`;

        return {
            success: true,
            qrCode:  qrBase64,
            passData: {
                ...walletData,
                qrCode:       qrBase64,
                instructions: 'Scan this QR code to add to Apple Wallet or Google Pay',
                compatibleWith: ['Apple Wallet', 'Google Pay', 'Samsung Wallet'],
            },
            message: 'Wallet pass generated successfully',
        };
    }

    // ── generateViewHtml: Liquid Glass mobile boarding pass page ─────────────

    generateViewHtml(d, qrDataUrl) {
        const esc = s => String(s || '')
            .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;').replace(/'/g,'&#39;');

        const isFirst    = d.classType === 'FIRST';
        const accent     = isFirst ? '#D97706'  : '#3D6FFF';
        const accentBg   = isFirst ? '#FEF3C7'  : '#EEF2FF';
        const accentGrad = isFirst
            ? 'linear-gradient(160deg,#FBBF24 0%,#D97706 38%,#92400E 72%,#7C2D12 100%)'
            : 'linear-gradient(160deg,#6B8FFF 0%,#3960FB 38%,#1A2EB5 72%,#0D1D5A 100%)';
        const classLabel = isFirst ? 'Business Class' : 'Economy';
        const initials   = d.passengerName.trim().split(/\s+/)
            .filter(Boolean).map(n => n[0].toUpperCase()).slice(0,2).join('');

        return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
<meta name="apple-mobile-web-app-title" content="${esc(d.flightNumber)}">
<meta name="theme-color" content="#060818">
<link rel="apple-touch-startup-image" href="">
<title>${esc(d.origin)} &#8594; ${esc(d.destination)} · ${esc(d.flightNumber)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --accent:${accent};
  --accent-bg:${accentBg};
  --page:#060818;
}
html,body{
  min-height:100%;min-height:100dvh;
  font-family:-apple-system,'SF Pro Display','SF Pro Text','Helvetica Neue',system-ui,sans-serif;
  background:var(--page);color:#fff;
  display:flex;flex-direction:column;align-items:center;
  padding:env(safe-area-inset-top,20px) 0 env(safe-area-inset-bottom,32px);
  overflow-x:hidden;
}

/* ── Animated background ── */
.bg{position:fixed;inset:0;z-index:0;overflow:hidden;}
.blob{position:absolute;border-radius:50%;pointer-events:none;filter:blur(72px);}
.b1{width:420px;height:420px;top:-100px;left:-100px;
    background:radial-gradient(circle,rgba(57,96,251,.55) 0%,transparent 70%);
    animation:f1 9s ease-in-out infinite;}
.b2{width:340px;height:340px;bottom:-40px;right:-80px;
    background:radial-gradient(circle,rgba(124,58,237,.45) 0%,transparent 70%);
    animation:f2 12s ease-in-out infinite;}
.b3{width:260px;height:260px;top:45%;left:50%;transform:translate(-50%,-50%);
    background:radial-gradient(circle,rgba(20,34,88,.7) 0%,transparent 70%);}
@keyframes f1{0%,100%{transform:translate(0,0) scale(1)}40%{transform:translate(28px,22px) scale(1.06)}70%{transform:translate(-16px,34px) scale(.94)}}
@keyframes f2{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-32px,-24px) scale(1.09)}}

/* ── Wrapper ── */
.wrap{position:relative;z-index:1;width:100%;max-width:400px;padding:0 16px;display:flex;flex-direction:column;gap:14px;padding-top:20px;}

/* ── Main card ── */
.card{
  width:100%;border-radius:28px;
  box-shadow:0 24px 64px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.18);
}

/* ── Header ── */
.hdr{
  background:${accentGrad};
  border-radius:28px 28px 0 0;
  padding:22px 22px 18px;position:relative;overflow:hidden;
}
/* Large glow top-right */
.hdr::before{
  content:'';position:absolute;top:-70px;right:-60px;
  width:280px;height:280px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.18) 0%,transparent 60%);
  pointer-events:none;
}
/* Soft glow bottom-left */
.hdr::after{
  content:'';position:absolute;bottom:-60px;left:-40px;
  width:220px;height:220px;border-radius:50%;
  background:radial-gradient(circle,rgba(255,255,255,.09) 0%,transparent 65%);
  pointer-events:none;
}
/* Extra shimmer stripe across the top */
.hdr-shine{
  position:absolute;top:0;left:0;right:0;height:1px;
  background:linear-gradient(90deg,transparent 0%,rgba(255,255,255,.35) 40%,rgba(255,255,255,.35) 60%,transparent 100%);
  z-index:1;
}
.hdr-top{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;position:relative;z-index:1;}
.airline-pill{
  background:rgba(255,255,255,.16);
  backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);
  border:1px solid rgba(255,255,255,.25);border-radius:20px;
  padding:5px 13px;font-size:10px;font-weight:700;letter-spacing:.6px;
  color:rgba(255,255,255,.92);
}
.flight-pill{
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);
  border-radius:10px;padding:4px 10px;font-size:11px;font-weight:700;
  color:rgba(255,255,255,.85);
}

/* Route row */
.route{display:flex;align-items:flex-end;justify-content:space-between;position:relative;z-index:1;margin-bottom:14px;}
.code{font-size:52px;font-weight:800;letter-spacing:-2px;color:#fff;line-height:1;}
.city{font-size:9.5px;color:rgba(255,255,255,.5);margin-top:3px;font-weight:400;letter-spacing:.2px;}
.route-mid{flex:1;display:flex;flex-direction:column;align-items:center;gap:5px;padding:0 10px;padding-bottom:8px;}
.route-line{width:100%;display:flex;align-items:center;gap:4px;}
.rdot{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.55);flex-shrink:0;}
.rdash{flex:1;height:1px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.4) 0,rgba(255,255,255,.4) 4px,transparent 4px,transparent 8px);}
.rplane{font-size:14px;color:#fff;opacity:.9;flex-shrink:0;}
.dur-pill{
  background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);
  border-radius:20px;padding:3px 11px;font-size:10px;font-weight:600;
  color:rgba(255,255,255,.85);
}

/* Departure info */
.dep-row{
  display:flex;justify-content:space-between;align-items:flex-end;
  padding-top:14px;border-top:1px solid rgba(255,255,255,.12);
  position:relative;z-index:1;
}
.info-lbl{display:block;font-size:8.5px;font-weight:600;letter-spacing:1.4px;color:rgba(255,255,255,.42);text-transform:uppercase;margin-bottom:3px;}
.info-val{font-size:13px;font-weight:700;color:#fff;}
.gate-big{font-size:28px;font-weight:800;color:#fff;letter-spacing:-1px;line-height:1;}

/* ── Perforated edge ── */
.perf{
  position:relative;height:20px;overflow:visible;
  background:rgba(255,255,255,.93);
  display:flex;align-items:center;z-index:1;
}
.perf.dark{background:${isFirst ? 'rgba(146,64,14,.15)' : 'rgba(13,29,90,.2)'};}
.perf::before,.perf::after{
  content:'';position:absolute;top:50%;transform:translateY(-50%);
  width:24px;height:24px;border-radius:50%;background:var(--page);z-index:2;
}
.perf::before{left:-12px;} .perf::after{right:-12px;}
.perf-dash{flex:1;margin:0 15px;height:1.5px;background:repeating-linear-gradient(90deg,rgba(0,0,0,.12) 0,rgba(0,0,0,.12) 6px,transparent 6px,transparent 12px);}
.perf.dark .perf-dash{background:repeating-linear-gradient(90deg,rgba(255,255,255,.2) 0,rgba(255,255,255,.2) 6px,transparent 6px,transparent 12px);}

/* ── White body ── */
.body{
  background:rgba(255,255,255,.94);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  padding:16px 20px;
}
.field-grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px 6px;margin-bottom:14px;}
.f-lbl{font-size:7.5px;font-weight:700;color:#8A9AB8;text-transform:uppercase;letter-spacing:1.2px;margin-bottom:3px;}
.f-val{font-size:13px;font-weight:800;color:#0D1B4B;}
.f-accent{color:var(--accent) !important;}

.class-badge{
  display:inline-flex;align-items:center;gap:6px;
  background:${accentBg};border-radius:20px;
  padding:5px 13px;font-size:11px;font-weight:700;color:var(--accent);
  margin-bottom:12px;
}
.class-badge-dot{width:6px;height:6px;border-radius:50%;background:var(--accent);flex-shrink:0;}

.pax-row{
  display:flex;align-items:center;gap:11px;
  padding:11px 0;border-top:1px solid #EAEFFF;border-bottom:1px solid #EAEFFF;
  margin-bottom:13px;
}
.avatar{
  width:44px;height:44px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  font-size:16px;font-weight:800;flex-shrink:0;
  background:${accentBg};color:var(--accent);
}
.pax-name{font-size:13.5px;font-weight:800;color:#0D1B4B;}
.pax-id{font-size:9.5px;color:#8A9AB8;margin-top:2px;}
.seat-badge{margin-left:auto;text-align:right;flex-shrink:0;}
.seat-lbl{font-size:7.5px;font-weight:700;color:#8A9AB8;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px;}
.seat-num{font-size:22px;font-weight:800;color:var(--accent);line-height:1;}

.price-row{display:flex;justify-content:space-between;align-items:center;}
.price-big{font-size:22px;font-weight:800;color:var(--accent);}
.tk-lbl{font-size:7.5px;font-weight:700;color:#8A9AB8;letter-spacing:1.2px;text-transform:uppercase;margin-bottom:2px;}
.tk-val{font-size:9px;font-weight:700;color:#0D1B4B;letter-spacing:.5px;}

/* ── Stub ── */
.stub{
  background:rgba(248,250,255,.95);
  border-radius:0 0 28px 28px;
  padding:14px 20px 18px;
}
.qr-wrap{display:flex;justify-content:center;margin-bottom:10px;}
.qr-wrap img{width:150px;height:150px;border-radius:10px;box-shadow:0 4px 16px rgba(57,96,251,.15);}
.tk-code{text-align:center;font-size:8px;font-weight:700;color:#8A9AB8;letter-spacing:2.5px;margin-bottom:10px;}
.barcode{
  height:48px;border-radius:3px;margin-bottom:5px;
  background:repeating-linear-gradient(90deg,
    #0D1B4B 0,#0D1B4B 2px,transparent 2px,transparent 4px,
    #0D1B4B 4px,#0D1B4B 7px,transparent 7px,transparent 10px,
    #0D1B4B 10px,#0D1B4B 11px,transparent 11px,transparent 14px,
    #0D1B4B 14px,#0D1B4B 17px,transparent 17px,transparent 19px,
    #0D1B4B 19px,#0D1B4B 20px,transparent 20px,transparent 23px,
    #0D1B4B 23px,#0D1B4B 26px,transparent 26px,transparent 29px,
    #0D1B4B 29px,#0D1B4B 30px,transparent 30px,transparent 33px,
    #0D1B4B 33px,#0D1B4B 36px,transparent 36px,transparent 38px
  );
}
.stub-footer{text-align:center;font-size:7.5px;font-weight:600;color:#9AAAC2;letter-spacing:.8px;text-transform:uppercase;}

/* ── Wallet CTA (below card) ── */
.wallet-cta{
  width:100%;background:rgba(255,255,255,.07);
  backdrop-filter:blur(20px);-webkit-backdrop-filter:blur(20px);
  border:1px solid rgba(255,255,255,.12);border-radius:22px;
  padding:18px 20px;text-align:center;
}
.wc-title{font-size:13px;font-weight:700;color:rgba(255,255,255,.5);margin-bottom:14px;letter-spacing:.5px;text-transform:uppercase;}
.wc-hint{font-size:12px;color:rgba(255,255,255,.55);line-height:1.6;}
.wc-hint strong{color:rgba(255,255,255,.85);}

/* Google Wallet button */
.gw-btn{
  display:inline-flex;align-items:center;justify-content:center;gap:10px;
  background:#000;color:#fff;
  border:none;border-radius:14px;
  padding:13px 22px;font-size:14px;font-weight:700;
  cursor:pointer;text-decoration:none;
  box-shadow:0 4px 18px rgba(0,0,0,.5);
  transition:transform .15s,box-shadow .15s;
  width:100%;
}
.gw-btn:active{transform:scale(.97);box-shadow:0 2px 10px rgba(0,0,0,.4);}
.gw-btn svg{flex-shrink:0;}

/* iOS hint card */
.ios-hint{
  display:flex;flex-direction:column;align-items:center;gap:10px;
}
.ios-steps{display:flex;flex-direction:column;gap:8px;width:100%;}
.ios-step{
  display:flex;align-items:center;gap:11px;
  background:rgba(255,255,255,.06);border-radius:12px;
  padding:10px 14px;text-align:left;
}
.ios-step-num{
  width:24px;height:24px;border-radius:50%;
  background:rgba(255,255,255,.15);
  display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:800;color:#fff;flex-shrink:0;
}
.ios-step-txt{font-size:12px;color:rgba(255,255,255,.75);line-height:1.4;}
.ios-step-txt strong{color:#fff;}

/* Desktop hint */
.desktop-hint{font-size:12.5px;color:rgba(255,255,255,.5);line-height:1.6;}
.desktop-hint strong{color:rgba(255,255,255,.8);}

/* ── Footer ── */
.pg-footer{
  width:100%;max-width:400px;
  padding:0 16px 32px;
  display:flex;flex-direction:column;align-items:center;gap:10px;
  position:relative;z-index:1;
}
.footer-divider{
  width:48px;height:1px;
  background:linear-gradient(90deg,transparent,rgba(255,255,255,.18),transparent);
}
.footer-brand{
  display:flex;align-items:center;gap:8px;
  font-size:11px;font-weight:700;letter-spacing:.12em;
  color:rgba(255,255,255,.3);text-transform:uppercase;
}
.footer-dot{width:3px;height:3px;border-radius:50%;background:rgba(255,255,255,.2);}
.footer-meta{
  display:flex;align-items:center;gap:8px;
  font-size:9.5px;color:rgba(255,255,255,.18);letter-spacing:.04em;
}
.footer-policy{
  font-size:9px;color:rgba(255,255,255,.14);line-height:1.5;
  text-align:center;max-width:280px;
}
</style>
</head>
<body>
<div class="bg"><div class="blob b1"></div><div class="blob b2"></div><div class="blob b3"></div></div>

<div class="wrap">
  <!-- ── MAIN CARD ── -->
  <div class="card">

    <!-- HEADER -->
    <div class="hdr">
      <div class="hdr-shine"></div>
      <div class="hdr-top">
        <div class="airline-pill">AEROLINEAS PABON</div>
        <div class="flight-pill">${esc(d.flightNumber)}</div>
      </div>

      <div class="route">
        <div>
          <div class="code">${esc(d.origin)}</div>
          <div class="city">${esc(d.originCity)}</div>
        </div>
        <div class="route-mid">
          <div class="route-line">
            <div class="rdot"></div>
            <div class="rdash"></div>
            <div class="rplane">&#9992;</div>
            <div class="rdash"></div>
            <div class="rdot"></div>
          </div>
          ${d.duration ? `<div class="dur-pill">${esc(d.duration)}</div>` : ''}
        </div>
        <div style="text-align:right">
          <div class="code">${esc(d.destination)}</div>
          <div class="city">${esc(d.destCity)}</div>
        </div>
      </div>

      <div class="dep-row">
        <div>
          <span class="info-lbl">Departure</span>
          <div class="info-val">${esc(d.fmtDate)}</div>
          <div style="font-size:20px;font-weight:800;color:#fff;margin-top:1px;">${esc(d.fmtTime)}</div>
        </div>
        <div style="text-align:right">
          <span class="info-lbl">Gate</span>
          <div class="gate-big">${esc(d.gate || 'TBD')}</div>
        </div>
      </div>
    </div>

    <!-- PERF EDGE 1 -->
    <div class="perf dark"><div class="perf-dash"></div></div>

    <!-- BODY -->
    <div class="body">
      <div class="field-grid">
        <div>
          <div class="f-lbl">Seat Class</div>
          <div class="f-val f-accent">${esc(classLabel)}</div>
        </div>
        <div>
          <div class="f-lbl">Departure</div>
          <div class="f-val" style="font-size:15px">${esc(d.fmtTime)}</div>
        </div>
        <div style="text-align:right">
          <div class="f-lbl">Seat</div>
          <div class="f-val f-accent" style="font-size:18px">${esc(d.seatNumber)}</div>
        </div>
      </div>

      <div class="class-badge">
        <div class="class-badge-dot"></div>
        ${esc(classLabel)}
      </div>

      <div class="pax-row">
        <div class="avatar">${esc(initials)}</div>
        <div>
          <div class="pax-name">${esc(d.passengerName)}</div>
          <div class="pax-id">ID&#8202;: ${esc(d.passportNumber)}</div>
        </div>
        <div class="seat-badge">
          <div class="seat-lbl">Seat</div>
          <div class="seat-num">${esc(d.seatNumber)}</div>
        </div>
      </div>

      <div class="price-row">
        <div>
          <div class="f-lbl">Total Paid</div>
          <div class="price-big">${esc(d.price)}</div>
        </div>
        <div style="text-align:right">
          <div class="tk-lbl">Ticket No.</div>
          <div class="tk-val">${esc(d.ticketNumber)}</div>
        </div>
      </div>
    </div>

    <!-- PERF EDGE 2 -->
    <div class="perf"><div class="perf-dash"></div></div>

    <!-- STUB -->
    <div class="stub">
      <div class="qr-wrap">
        <img src="${qrDataUrl}" alt="Boarding Pass QR" />
      </div>
      <div class="tk-code">${esc(d.ticketNumber)}</div>
      <div class="barcode"></div>
      <div class="stub-footer">Aerolineas Pabon &middot; E-Boarding Pass &middot; 2026</div>
    </div>
  </div>

  <!-- ── WALLET CTA ── -->
  <div class="wallet-cta">
    <div class="wc-title">Save Boarding Pass</div>

    <!-- Google Wallet button: always visible when available -->
    ${d.googleWalletUrl ? `
    <a class="gw-btn" href="${esc(d.googleWalletUrl)}" target="_blank" rel="noopener">
      <svg width="22" height="22" viewBox="0 0 22 22" xmlns="http://www.w3.org/2000/svg">
        <path d="M11 0C4.925 0 0 4.925 0 11s4.925 11 11 11 11-4.925 11-11S17.075 0 11 0z" fill="#4285F4"/>
        <path d="M11 0C4.925 0 0 4.925 0 11h11V0z" fill="#EA4335"/>
        <path d="M0 11c0 6.075 4.925 11 11 11V11H0z" fill="#34A853"/>
        <path d="M22 11c0-6.075-4.925-11-11-11v11h11z" fill="#FBBC05"/>
      </svg>
      Save to Google Wallet
    </a>
    <div style="height:14px"></div>
    ` : ''}

    <!-- Platform hint: shown via JS based on user agent -->
    <div id="section-ios" style="display:none">
      <div class="ios-steps">
        <div class="ios-step">
          <div class="ios-step-num">1</div>
          <div class="ios-step-txt">Tap the <strong>Share</strong> button &#8679; at the bottom of Safari</div>
        </div>
        <div class="ios-step">
          <div class="ios-step-num">2</div>
          <div class="ios-step-txt">Scroll down and tap <strong>"Add to Home Screen"</strong></div>
        </div>
        <div class="ios-step">
          <div class="ios-step-num">3</div>
          <div class="ios-step-txt">Tap <strong>Add</strong> to save your boarding pass to the home screen</div>
        </div>
      </div>
    </div>

    <div id="section-android" style="display:none">
      <div class="ios-steps">
        <div class="ios-step">
          <div class="ios-step-num">1</div>
          <div class="ios-step-txt">Tap the <strong>&#8942; menu</strong> in your browser</div>
        </div>
        <div class="ios-step">
          <div class="ios-step-num">2</div>
          <div class="ios-step-txt">Tap <strong>"Add to Home screen"</strong> to save it as an app</div>
        </div>
      </div>
    </div>

    <div id="section-desktop" style="display:none">
      <p class="desktop-hint">Open this link on your phone to save your boarding pass</p>
    </div>
  </div>
</div>

<!-- ── FOOTER ── -->
<footer class="pg-footer">
  <div class="footer-divider"></div>
  <div class="footer-brand">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="opacity:.4">
      <path d="M21 16v-2l-8-5V3.5A1.5 1.5 0 0 0 11.5 2 1.5 1.5 0 0 0 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z" fill="rgba(255,255,255,.4)"/>
    </svg>
    Aerolineas Pabon
    <div class="footer-dot"></div>
    E-Boarding Pass
  </div>
  <div class="footer-meta">
    <span>${esc(d.origin)} &rarr; ${esc(d.destination)}</span>
    <div class="footer-dot"></div>
    <span>${esc(d.flightNumber)}</span>
    <div class="footer-dot"></div>
    <span>${esc(d.fmtDate)}</span>
  </div>
  <p class="footer-policy">
    This boarding pass is non-transferable and valid only for the passenger and flight shown above.
    Please arrive at the gate at least 30 minutes before departure.
  </p>
</footer>

<script>
(function(){
  var ua        = navigator.userAgent;
  var isIOS     = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  var isAndroid = /Android/.test(ua);
  if (isIOS)          document.getElementById('section-ios').style.display     = 'block';
  else if (isAndroid) document.getElementById('section-android').style.display = 'block';
  else                document.getElementById('section-desktop').style.display = 'block';
})();
</script>
</body>
</html>`;
    }

    // ── Cleanup old generated files ───────────────────────────────────────────

    cleanupOldFiles(maxAgeHours = 24) {
        try {
            const now   = Date.now();
            const files = fs.readdirSync(this.outputDir);
            let deleted = 0;
            for (const f of files) {
                const fp    = path.join(this.outputDir, f);
                const stats = fs.statSync(fp);
                if ((now - stats.mtimeMs) / 3_600_000 > maxAgeHours) {
                    fs.unlinkSync(fp);
                    deleted++;
                }
            }
            return { deleted, message: `Deleted ${deleted} old files` };
        } catch { return { deleted: 0 }; }
    }
}

module.exports = PDFGeneratorService;
