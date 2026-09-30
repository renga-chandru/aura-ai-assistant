export type SpeechRecognitionStatus =
  | 'idle'
  | 'requesting'
  | 'listening'
  | 'denied'
  | 'unavailable'
  | 'error';

export interface SpeechRecognitionEvents {
  onStart?: () => void;
  onInterimResult?: (transcript: string) => void;
  onFinalResult?: (transcript: string) => void;
  onError?: (errorMessage: string, errorCode: string) => void;
  onEnd?: () => void;
}

export interface SpeechRecognitionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
}
