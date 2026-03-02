/**
 * Custom pipeline provider.
 *
 * Connects to a Python WebSocket pipeline server that runs:
 *   Silero-VAD v5 → Whisper Small+LoRA → emotion2vec+ → Qwen → Cartesia Sonic 3
 *
 * Protocol (JSON over WebSocket):
 *   Node → Python:
 *     { type: 'config',  session: CallSessionParams }
 *     { type: 'audio',   payload: '<base64 mulaw 8kHz>' }
 *     { type: 'text',    text: '...' }          // inject user text
 *     { type: 'close' }
 *
 *   Python → Node:
 *     { type: 'audio',      payload: '<base64 mulaw 8kHz>' }  // TTS output
 *     { type: 'transcript', role: 'user'|'assistant', text: '...' }
 *     { type: 'emotion',    emotion: string, score: number }
 *     { type: 'error',      message: string }
 *     { type: 'ready' }     // pipeline ready after config received
 */

import WebSocket from 'ws';
import { VoiceAIProvider, CallSessionParams } from './voiceAIProvider';
import { TwilioStreamService } from './twilioStream';
import { logger } from '../utils/logger';
import { config } from '../config/env';
import { prisma } from '../db/client';
import { runPostCallAnalysis } from './postCallAnalysisService';

export class CustomPipelineProvider implements VoiceAIProvider {
  private ws: WebSocket | null = null;
  private twilioService: TwilioStreamService;
  private pendingAudio: string[] = [];
  private isReady = false;
  private isClosing = false;
  private serverUrl: string;
  private sessionParams: CallSessionParams | null = null;
  private transcriptLog: Array<{ role: string; text: string }> = [];

  constructor(twilioService: TwilioStreamService) {
    this.twilioService = twilioService;
    this.serverUrl = config.CUSTOM_PIPELINE_URL || 'ws://localhost:8765';
  }

  connect() {
    if (this.ws) return;
    this.isClosing = false;

    logger.info(`[CustomPipeline] Connecting to pipeline server at ${this.serverUrl}`);
    this.ws = new WebSocket(this.serverUrl);

    this.ws.on('open', () => {
      logger.info('[CustomPipeline] Connected to Python pipeline server');
    });

    this.ws.on('message', (data: WebSocket.RawData) => {
      try {
        const msg = JSON.parse(data.toString());
        this.handleServerMessage(msg);
      } catch (err) {
        logger.error('[CustomPipeline] Failed to parse server message', err);
      }
    });

    this.ws.on('error', (err) => {
      logger.error('[CustomPipeline] WebSocket error', err);
    });

    this.ws.on('close', () => {
      logger.warn('[CustomPipeline] Connection to pipeline server closed');
      this.isReady = false;
      this.ws = null;
    });
  }

  private handleServerMessage(msg: { type: string; [key: string]: any }) {
    switch (msg.type) {
      case 'ready':
        logger.info('[CustomPipeline] Pipeline ready');
        this.isReady = true;
        // Flush buffered audio
        for (const chunk of this.pendingAudio) {
          this.sendRaw({ type: 'audio', payload: chunk });
        }
        this.pendingAudio = [];
        break;

      case 'audio':
        // TTS audio from Cartesia — already mulaw 8kHz, send directly to Twilio
        this.twilioService.sendRawMulawAudio(msg.payload);
        break;

      case 'transcript':
        logger.info(`[CustomPipeline] ${msg.role}: ${msg.text}`);
        this.transcriptLog.push({ role: msg.role, text: msg.text });
        // Persist to DB — use streamSid to connect to the Call record
        if (this.sessionParams?.streamSid) {
          prisma.transcript.create({
            data: {
              call: { connect: { streamSid: this.sessionParams.streamSid } },
              speaker: msg.role,
              text: msg.text,
            },
          }).catch(err => logger.error('[CustomPipeline] Failed to save transcript', err));
        }
        break;

      case 'emotion':
        logger.info(`[CustomPipeline] Emotion: ${msg.emotion} (${msg.score?.toFixed(2)})`);
        break;

      case 'error':
        logger.error(`[CustomPipeline] Pipeline error: ${msg.message}`);
        break;
    }
  }

  async initializeConversation(params: CallSessionParams) {
    logger.info(`[CustomPipeline] Initializing session for call ${params.callId}`);
    this.sessionParams = params;
    this.sendRaw({ type: 'config', session: params });
  }

  sendAudio(base64Audio: string) {
    if (!this.isReady) {
      if (this.pendingAudio.length < 200) this.pendingAudio.push(base64Audio);
      return;
    }
    this.sendRaw({ type: 'audio', payload: base64Audio });
  }

  sendUserText(text: string) {
    this.sendRaw({ type: 'text', text });
  }

  async disconnect() {
    this.isClosing = true;
    this.sendRaw({ type: 'close' });
    this.ws?.close();
    this.ws = null;

    // Run post-call analysis in the background — extract customer memories from transcript
    if (this.sessionParams && this.transcriptLog.length > 0) {
      runPostCallAnalysis({
        transcript: this.transcriptLog,
        caller: this.sessionParams.caller,
        teamId: this.sessionParams.teamId,
        callType: this.sessionParams.callType,
      }).catch(err => logger.error('[CustomPipeline] Post-call analysis failed', err));
    }
  }

  private sendRaw(msg: object) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
