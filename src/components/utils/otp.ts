import { NODE_MAILER_SENDER_EMAIL } from "../../constants/env.ts";
import { setCache } from "../../lib/node-cache.ts";
import { CACHE_KEYS } from "../../constants/cacheKeys.ts";
import { AppError } from "./AppError.ts";
import { generateOTP } from "./genRendomString.ts";
import { sendNotification } from "./notification.ts";

export const sendOtp = async (email: string, userName: string) => {
  const otp = generateOTP(6);
  const sendMailPayload = {
    from: NODE_MAILER_SENDER_EMAIL,
    to: email,
    subject: "TaskFlow OTP Verification",
    variables: { userName, otp },
  };

  setCache({
    key: CACHE_KEYS.OTP(email),
    value: { otp },
    ttl: 1000,
  });

  const notificationResp = await sendNotification("otp", sendMailPayload);

  if (notificationResp.error) {
    throw new AppError(notificationResp.error);
  }

  return otp;
};