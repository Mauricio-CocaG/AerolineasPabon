/**
 * SERVICIO DE GENERACIÓN DE PDF - BOARDING PASS
 * Genera pases de abordar en formato PDF
 */

const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const QRCode = require('qrcode');

class PDFGeneratorService {
    constructor() {
        this.outputDir = path.join(__dirname, '../../output');
        
        if (!fs.existsSync(this.outputDir)) {
            fs.mkdirSync(this.outputDir, { recursive: true });
        }
    }

    async generateBoardingPass(bookingData) {
        try {
            const {
                ticketNumber,
                passengerName,
                passportNumber,
                flightNumber,
                origin,
                destination,
                departureDate,
                departureTime,
                seatNumber,
                classType,
                gate,
                boardingTime,
                price
            } = bookingData;

            // Formatear fecha correctamente
            let formattedDate = departureDate;
            if (departureDate && departureDate instanceof Date) {
                formattedDate = departureDate.toLocaleDateString('es-ES');
            } else if (typeof departureDate === 'string') {
                formattedDate = departureDate.split('T')[0];
            }

            // Generar código QR
            const qrData = JSON.stringify({
                ticketNumber,
                passengerName,
                flightNumber,
                seatNumber,
                origin,
                destination,
                departureDate: formattedDate,
                departureTime
            });
            
            const qrCodeBuffer = await QRCode.toBuffer(qrData, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 150
            });

            const filename = `boarding_pass_${ticketNumber}_${Date.now()}.pdf`;
            const filePath = path.join(this.outputDir, filename);
            
            const doc = new PDFDocument({
                size: [400, 600],
                margin: 20,
                layout: 'portrait'
            });

            const writeStream = fs.createWriteStream(filePath);
            doc.pipe(writeStream);

            // Colores
            const bgColor = classType === 'FIRST' ? '#C5A572' : '#2C5F8A';
            const textColor = '#FFFFFF';
            
            // Cabecera
            doc.rect(0, 0, doc.page.width, 80).fill(bgColor);
            doc.fillColor(textColor);
            doc.fontSize(20).font('Helvetica-Bold').text('RAFAEL PABON AIRLINES', 20, 20, { align: 'center' });
            doc.fontSize(12).font('Helvetica').text('Boarding Pass', 20, 50, { align: 'center' });

            // Línea de corte
            doc.strokeColor('#CCCCCC');
            doc.lineWidth(1);
            doc.moveTo(20, 90).lineTo(doc.page.width - 20, 90).stroke();

            let yPos = 110;
            
            // Información del vuelo
            doc.fillColor('#000000');
            doc.fontSize(9).font('Helvetica-Bold').text('FLIGHT', 20, yPos);
            doc.fontSize(16).font('Helvetica-Bold').text(flightNumber, 20, yPos + 12);
            
            doc.fontSize(9).font('Helvetica-Bold').text('CLASS', 140, yPos);
            doc.fontSize(14).font('Helvetica-Bold').text(classType, 140, yPos + 12);
            
            doc.fontSize(9).font('Helvetica-Bold').text('SEAT', 260, yPos);
            doc.fontSize(16).font('Helvetica-Bold').text(seatNumber, 260, yPos + 12);
            
            yPos += 45;
            
            // Origen y Destino
            doc.fontSize(10).font('Helvetica-Bold').text('FROM', 20, yPos);
            doc.fontSize(24).font('Helvetica-Bold').text(origin, 20, yPos + 15);
            
            doc.fontSize(10).font('Helvetica-Bold').text('TO', 200, yPos);
            doc.fontSize(24).font('Helvetica-Bold').text(destination, 200, yPos + 15);
            
            // Avión
            doc.fontSize(18).text('✈', 160, yPos + 5);
            
            yPos += 60;
            
            // Fecha y Hora
            doc.fontSize(8).font('Helvetica-Bold').text('DATE', 20, yPos);
            doc.fontSize(11).font('Helvetica').text(formattedDate, 20, yPos + 12);
            
            doc.fontSize(8).font('Helvetica-Bold').text('TIME', 120, yPos);
            doc.fontSize(11).font('Helvetica').text(departureTime, 120, yPos + 12);
            
            doc.fontSize(8).font('Helvetica-Bold').text('BOARDING', 220, yPos);
            doc.fontSize(11).font('Helvetica').text(boardingTime || departureTime, 220, yPos + 12);
            
            yPos += 45;
            
            // Puerta y Pasaporte
            doc.fontSize(8).font('Helvetica-Bold').text('GATE', 20, yPos);
            doc.fontSize(14).font('Helvetica-Bold').text(gate || 'TBD', 20, yPos + 12);
            
            doc.fontSize(8).font('Helvetica-Bold').text('PASSPORT', 200, yPos);
            doc.fontSize(10).font('Helvetica').text(passportNumber, 200, yPos + 12);
            
            yPos += 50;
            
            // Línea de corte
            doc.moveTo(20, yPos).lineTo(doc.page.width - 20, yPos).stroke();
            yPos += 15;
            
            // Pasajero
            doc.fontSize(8).font('Helvetica-Bold').text('PASSENGER', 20, yPos);
            doc.fontSize(11).font('Helvetica').text(passengerName, 20, yPos + 12);
            
            doc.fontSize(8).font('Helvetica-Bold').text('TICKET', 200, yPos);
            doc.fontSize(8).font('Helvetica').text(ticketNumber, 200, yPos + 12);
            
            yPos += 50;
            
            // Código QR
            const qrX = (doc.page.width - 120) / 2;
            doc.image(qrCodeBuffer, qrX, yPos, { width: 120, height: 120 });
            
            yPos += 135;
            
            // Pie de página
            doc.fontSize(7).font('Helvetica').text('Please arrive at the gate 30 minutes before departure', 20, yPos, { align: 'center' });
            doc.fontSize(7).text('This is your electronic boarding pass', 20, yPos + 10, { align: 'center' });
            doc.fontSize(7).text('Thank you for flying with Rafael Pabon Airlines', 20, yPos + 20, { align: 'center' });

            doc.end();
            
            await new Promise((resolve) => {
                writeStream.on('finish', resolve);
            });

            return {
                success: true,
                filePath: filePath,
                filename: filename,
                message: 'Boarding pass generated successfully'
            };

        } catch (error) {
            console.error('[PDF] Error generating boarding pass:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    async getBoardingPassBase64(bookingData) {
        const result = await this.generateBoardingPass(bookingData);
        
        if (result.success) {
            const pdfBuffer = fs.readFileSync(result.filePath);
            return {
                success: true,
                base64: pdfBuffer.toString('base64'),
                filename: result.filename
            };
        }
        
        return result;
    }

    async generateWalletPass(bookingData) {
        try {
            const {
                ticketNumber,
                passengerName,
                flightNumber,
                origin,
                destination,
                departureDate,
                departureTime,
                seatNumber,
                gate
            } = bookingData;

            let formattedDate = departureDate;
            if (departureDate && departureDate instanceof Date) {
                formattedDate = departureDate.toISOString().split('T')[0];
            } else if (typeof departureDate === 'string') {
                formattedDate = departureDate.split('T')[0];
            }

            const walletData = {
                format: 'PASS',
                version: '1.0',
                passTypeIdentifier: 'pass.com.rafaelpabon.boardingpass',
                serialNumber: ticketNumber,
                description: 'Rafael Pabon Airlines Boarding Pass',
                organizationName: 'Rafael Pabon Airlines',
                logoText: 'Rafael Pabon',
                backgroundColor: '#2C5F8A',
                foregroundColor: '#FFFFFF',
                labelColor: '#CCCCCC',
                relevantDate: formattedDate + 'T' + departureTime + ':00',
                boardingPass: {
                    headerFields: [
                        { key: 'origin', label: 'FROM', value: origin },
                        { key: 'destination', label: 'TO', value: destination }
                    ],
                    primaryFields: [
                        { key: 'passenger', label: 'PASSENGER', value: passengerName },
                        { key: 'flight', label: 'FLIGHT', value: flightNumber }
                    ],
                    secondaryFields: [
                        { key: 'seat', label: 'SEAT', value: seatNumber },
                        { key: 'gate', label: 'GATE', value: gate || 'TBD' },
                        { key: 'date', label: 'DATE', value: formattedDate },
                        { key: 'time', label: 'TIME', value: departureTime }
                    ],
                    auxiliaryFields: [
                        { key: 'ticket', label: 'TICKET', value: ticketNumber }
                    ]
                }
            };

            const qrDataString = JSON.stringify(walletData);
            const qrCodeBuffer = await QRCode.toBuffer(qrDataString, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 250
            });

            const qrFilename = `wallet_qr_${ticketNumber}_${Date.now()}.png`;
            const qrFilePath = path.join(this.outputDir, qrFilename);
            fs.writeFileSync(qrFilePath, qrCodeBuffer);

            const passData = {
                ...walletData,
                qrCode: `data:image/png;base64,${qrCodeBuffer.toString('base64')}`,
                downloadUrl: `/api/v1/pass/download/${qrFilename}`,
                instructions: 'Scan the QR code to add to Wallet',
                compatibleWith: ['Apple Wallet', 'Google Pay', 'Samsung Wallet']
            };

            return {
                success: true,
                qrCode: passData.qrCode,
                qrImagePath: qrFilePath,
                passData: passData,
                message: 'Wallet pass generated successfully'
            };

        } catch (error) {
            console.error('[Wallet] Error generating wallet pass:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    cleanupOldFiles(maxAgeHours = 24) {
        const now = Date.now();
        const files = fs.readdirSync(this.outputDir);
        
        let deleted = 0;
        for (const file of files) {
            const filePath = path.join(this.outputDir, file);
            const stats = fs.statSync(filePath);
            const ageHours = (now - stats.mtimeMs) / (1000 * 60 * 60);
            
            if (ageHours > maxAgeHours) {
                fs.unlinkSync(filePath);
                deleted++;
            }
        }
        
        return { deleted, message: `Deleted ${deleted} old files` };
    }
}

module.exports = PDFGeneratorService;