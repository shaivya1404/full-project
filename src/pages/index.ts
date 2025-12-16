export interface Call {
  callId: string;
  callSid: string;
  duration: number;
  transcript: string;
  recordingUrl?: string;
  startTime: string;
  endTime?: string;
  status: "active" | "completed" | "failed";
  direction: "inbound" | "outbound";
  callerNumber?: string;
  calleeNumber?: string;
  sentiment?: "positive" | "neutral" | "negative";
  recordingPath?: string;
}

export interface CallHistory {
  id: string;
  calls: Call[];
  totalDuration: number;
  totalCalls: number;
}

export interface CallAnalytics {
  totalCalls: number;
  totalDuration: number;
  averageDuration: number;
  completedCalls: number;
  failedCalls: number;
  positiveCallsPercentage: number;
}

export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface CallDetail extends Call {
  audioTranscript: Array<{
    speaker: "user" | "assistant";
    text: string;
    timestamp: number;
  }>;
}
