export type SendMailPayloadT = {
  subject: string;
  from: string;
  to: string;
  message: string;
  cc?: string[];
};

export interface SendNotificationParamsType
  extends Omit<SendMailPayloadT, "message"> {
  variables: Record<string, string>;
}

export type sendNotificationType = "otp" | "confirmation" | "reset-password";
