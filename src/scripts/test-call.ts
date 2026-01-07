import WebSocket from 'ws';
import * as fs from 'fs';
import * as readline from 'readline';
import { randomUUID } from 'crypto';

// Configuration
const WS_URL = 'ws://localhost:8080/streams';
const OUTPUT_FILE = 'response.wav';
const SAMPLE_RATE = 8000; // Twilio standard

// WAV Header helper
function writeWavHeader(sampleRate: number, dataLength: number) {
    const buffer = Buffer.alloc(44);
    buffer.write('RIFF', 0);
    buffer.writeUInt32LE(36 + dataLength, 4);
    buffer.write('WAVE', 8);
    buffer.write('fmt ', 12);
    buffer.writeUInt32LE(16, 16);
    buffer.writeUInt16LE(1, 20); // PCM format
    buffer.writeUInt16LE(1, 22); // Mono
    buffer.writeUInt32LE(sampleRate, 24);
    buffer.writeUInt32LE(sampleRate * 2, 28); // Byte rate
    buffer.writeUInt16LE(2, 32); // Block align
    buffer.writeUInt16LE(16, 34); // Bit depth
    buffer.write('data', 36);
    buffer.writeUInt32LE(dataLength, 40);
    return buffer;
}

// Mulaw decoding table (same as backend helper)
const MULAW_BIAS = 33;
const MULAW_MAX = 0x1fff;

function mulawDecode(mulawByte: number): number {
    mulawByte = ~mulawByte;
    const sign = mulawByte & 0x80;
    const exponent = (mulawByte >> 4) & 0x07;
    const mantissa = mulawByte & 0x0f;
    let sample = mantissa << (exponent + 3);
    sample += MULAW_BIAS << exponent;
    if (exponent === 0) sample += MULAW_BIAS;
    if (sample > MULAW_MAX) sample = MULAW_MAX;
    return sign !== 0 ? -sample : sample;
}

function decodeMulawToPcm(mulawData: Buffer): Buffer {
    const pcmBuffer = Buffer.alloc(mulawData.length * 2);
    for (let i = 0; i < mulawData.length; i++) {
        const sample = mulawDecode(mulawData[i]);
        pcmBuffer.writeInt16LE(sample, i * 2);
    }
    return pcmBuffer;
}

async function main() {
    console.log(' connecting to WebSocket...');
    const ws = new WebSocket(WS_URL);
    const streamSid = `test_stream_${randomUUID()}`;
    const callSid = `test_call_${randomUUID()}`;

    let audioBuffer = Buffer.alloc(0);
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    ws.on('open', () => {
        console.log(' Connected!');

        // 1. Send Start Event (Simulate Twilio)
        const startEvent = {
            event: 'start',
            start: {
                streamSid,
                callSid,
                customParameters: {
                    teamId: 'default-team'
                }
            }
        };
        ws.send(JSON.stringify(startEvent));
        console.log(' Sent "start" event.');

        // 2. Prompt for user input
        promptUser();
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());

            if (msg.event === 'media') {
                // Decode audio and append
                const chunk = Buffer.from(msg.media.payload, 'base64');
                const pcmChunk = decodeMulawToPcm(chunk);
                audioBuffer = Buffer.concat([audioBuffer, pcmChunk]);
                process.stdout.write('.'); // progress indicator
            } else if (msg.event === 'mark') {
                console.log('\n Audio mark received.');
            }
        } catch (e) {
            console.error('Error parsing message:', e);
        }
    });

    ws.on('close', () => {
        console.log('\n Connection closed.');
        saveAudio();
        process.exit(0);
    });

    ws.on('error', (err) => {
        console.error(' WebSocket Error:', err);
    });

    function promptUser() {
        rl.question('\n📝 Enter text to say (or "exit" to quit, "save" to save audio): ', (text) => {
            if (text.toLowerCase() === 'exit') {
                ws.close();
                return;
            }

            if (text.toLowerCase() === 'save') {
                saveAudio();
                promptUser(); // Continue loop
                return;
            }

            if (text.trim()) {
                // Send test_input event
                const testEvent = {
                    event: 'test_input',
                    text: text
                };
                ws.send(JSON.stringify(testEvent));
                console.log(` Sent: "${text}"`);
            }

            // Wait a bit before next prompt to let logs appear
            setTimeout(promptUser, 1000);
        });
    }

    function saveAudio() {
        if (audioBuffer.length === 0) {
            console.log(' No audio received to save.');
            return;
        }

        const header = writeWavHeader(SAMPLE_RATE, audioBuffer.length);
        const wavFile = Buffer.concat([header, audioBuffer]);
        fs.writeFileSync(OUTPUT_FILE, wavFile);
        console.log(`\n💾 Audio saved to ${OUTPUT_FILE} (${(audioBuffer.length / 2 / SAMPLE_RATE).toFixed(1)}s)`);
    }
}

main();
