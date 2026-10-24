import crypto from "crypto";

/**
 * Verify PayHere Webhook Notification Server-to-Server Checksum
 * Formula: md5(merchant_id + order_id + payhere_amount + payhere_currency + status_code + strtoupper(md5(merchant_secret)))
 */
export function verifyPayHereChecksum(params: {
  merchantId: string;
  merchantSecret: string;
  orderId: string;
  payhereAmount: string;
  payhereCurrency: string;
  statusCode: string;
  receivedMd5sig: string;
}): boolean {
  try {
    const hashedSecret = crypto
      .createHash("md5")
      .update(params.merchantSecret)
      .digest("hex")
      .toUpperCase();

    const expectedHash = crypto
      .createHash("md5")
      .update(
        params.merchantId +
          params.orderId +
          params.payhereAmount +
          params.payhereCurrency +
          params.statusCode +
          hashedSecret
      )
      .digest("hex")
      .toUpperCase();

    return expectedHash === params.receivedMd5sig.toUpperCase();
  } catch {
    return false;
  }
}
