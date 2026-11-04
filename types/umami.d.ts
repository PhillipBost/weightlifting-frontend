declare global {
  interface Window {
    umami?: {
      track: {
        (eventName: string, eventData?: Record<string, string | number | boolean>): void;
        (customFunction: (props: Record<string, any>) => Record<string, any>): void;
      };
      identify: (sessionData: Record<string, string | number | boolean>) => void;
    };
  }
}

export {};

