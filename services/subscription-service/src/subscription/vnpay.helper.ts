import * as crypto from 'crypto';

export interface VnpayCreateUrlParams {
  txnRef: string;       // unique order reference
  amount: number;       // amount in VND (will be multiplied by 100 per VNPay spec)
  orderInfo: string;    // human-readable description
  returnUrl: string;    // frontend redirect after payment
  ipAddr: string;
  locale?: 'vn' | 'en';
}

export interface VnpayIpnParams {
  vnp_TmnCode: string;
  vnp_Amount: string;
  vnp_BankCode: string;
  vnp_BankTranNo?: string;
  vnp_CardType?: string;
  vnp_PayDate: string;
  vnp_CurrCode: string;
  vnp_OrderInfo: string;
  vnp_TransactionNo: string;
  vnp_ResponseCode: string;
  vnp_TransactionStatus: string;
  vnp_TxnRef: string;
  vnp_SecureHashType?: string;
  vnp_SecureHash: string;
  [key: string]: string | undefined;
}

/**
 * Utility class for VNPay payment gateway integration.
 * Docs: https://sandbox.vnpayment.vn/apis/docs/thanh-toan-pay/pay.md
 */
export class VnpayHelper {
  private readonly tmnCode: string;
  private readonly hashSecret: string;
  private readonly baseUrl: string;

  constructor() {
    this.tmnCode = process.env.VNPAY_TMN_CODE ?? '';
    this.hashSecret = process.env.VNPAY_HASH_SECRET ?? '';
    this.baseUrl =
      process.env.VNPAY_BASE_URL ?? 'https://sandbox.vnpayment.vn/paymentv2/vpcpay.html';
  }

  createPaymentUrl(params: VnpayCreateUrlParams): string {
    const date = new Date();
    const createDate = this.formatDate(date);

    const vnpParams: Record<string, string> = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Amount: String(params.amount * 100), // VNPay requires amount * 100
      vnp_CurrCode: 'VND',
      vnp_TxnRef: params.txnRef,
      vnp_OrderInfo: params.orderInfo,
      vnp_OrderType: 'other',
      vnp_Locale: params.locale ?? 'vn',
      vnp_ReturnUrl: params.returnUrl,
      vnp_IpAddr: params.ipAddr,
      vnp_CreateDate: createDate,
    };

    const sortedParams = this.sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    sortedParams['vnp_SecureHash'] = signed;

    return `${this.baseUrl}?${new URLSearchParams(sortedParams).toString()}`;
  }

  verifyIpnSignature(params: VnpayIpnParams): boolean {
    const secureHash = params.vnp_SecureHash;

    // Remove signature fields before computing hash
    const { vnp_SecureHash, vnp_SecureHashType, ...rest } = params;
    const sorted = this.sortObject(
      Object.fromEntries(
        Object.entries(rest).filter(([, v]) => v !== undefined),
      ) as Record<string, string>,
    );

    const signData = new URLSearchParams(sorted).toString();
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    return signed === secureHash;
  }

  private formatDate(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return (
      `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}` +
      `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
    );
  }

  private sortObject(obj: Record<string, string>): Record<string, string> {
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, string>>((result, key) => {
        result[key] = obj[key];
        return result;
      }, {});
  }
}
