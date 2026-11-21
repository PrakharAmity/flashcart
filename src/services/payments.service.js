import { db } from '../db/index.js';
import { config } from '../config.js';

export const paymentsService = {
  getPaymentByOrderId(orderId) {
    return db.findPaymentByOrderId(orderId);
  },

  verifyPayment(orderId, redirectStatus = null) {
    const order = db.findOrderById(orderId);
    if (!order) {
      return { verified: false, error: 'Order not found' };
    }

    if (!config.isReferenceMode) {
      if (redirectStatus === 'success' || (order && order.status !== 'CANCELLED')) {
        return {
          verified: true,
          orderId: order.id,
          orderNumber: order.orderNumber,
          orderStatus: order.status,
          paymentStatus: 'SUCCESS'
        };
      }
    }

    const payment = db.findPaymentByOrderId(order.id);
    if (!payment) {
      return {
        verified: false,
        orderId: order.id,
        orderStatus: order.status,
        paymentStatus: 'NOT_FOUND'
      };
    }

    return {
      verified: payment.status === 'SUCCESS' && order.status !== 'PENDING_PAYMENT',
      orderId: order.id,
      orderNumber: order.orderNumber,
      orderStatus: order.status,
      paymentStatus: payment.status,
      amount: payment.amount,
      transactionId: payment.transactionId,
      updatedAt: payment.createdAt
    };
  },

  async processPayment(orderId, paymentData = {}) {
    const order = db.findOrderById(orderId);
    if (!order) {
      throw new Error(`Order ${orderId} not found`);
    }

    const {
      method = 'UPI',
      simulatedOutcome = 'SUCCESS',
      idempotencyKey = null
    } = paymentData;

    if (config.isReferenceMode) {
      const existingSuccess = db.payments.find(
        (p) => p.orderId === order.id && p.status === 'SUCCESS'
      );

      if (existingSuccess) {
        const error = new Error(`Order ${order.orderNumber} has already been paid successfully.`);
        error.statusCode = 400;
        error.existingTransactionId = existingSuccess.transactionId;
        throw error;
      }

      if (idempotencyKey) {
        const existingAttempt = db.paymentAttempts.find(
          (pa) => pa.idempotencyKey === idempotencyKey
        );
        if (existingAttempt) {
          const matchedPayment = db.payments.find((p) => p.id === existingAttempt.paymentId);
          return {
            payment: matchedPayment,
            attempt: existingAttempt,
            isDuplicate: true
          };
        }
      }

      const isSuccess = simulatedOutcome === 'SUCCESS';
      const paymentId = `pay-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const txnId = `TXN-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentRecord = {
        id: paymentId,
        orderId: order.id,
        userId: order.userId,
        amount: order.total,
        method,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        transactionId: txnId,
        createdAt: new Date().toISOString()
      };

      db.payments.push(paymentRecord);

      const attemptRecord = {
        id: `pa-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        paymentId,
        orderId: order.id,
        attemptNumber: db.paymentAttempts.filter((pa) => pa.orderId === order.id).length + 1,
        status: paymentRecord.status,
        idempotencyKey,
        gatewayRef: `GW-${Date.now()}`,
        createdAt: new Date().toISOString()
      };

      db.paymentAttempts.push(attemptRecord);

      if (isSuccess) {
        order.status = 'PROCESSING';
        order.updatedAt = new Date().toISOString();
      }

      db.addAuditLog({
        action: isSuccess ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
        userId: order.userId,
        role: 'CUSTOMER',
        details: { orderId: order.id, transactionId: txnId, amount: order.total, method }
      });

      return {
        payment: paymentRecord,
        attempt: attemptRecord,
        isDuplicate: false
      };
    } else {
      const isSuccess = simulatedOutcome === 'SUCCESS';
      const paymentId = `pay-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
      const txnId = `TXN-DUP-${Date.now().toString().slice(-6)}-${Math.floor(1000 + Math.random() * 9000)}`;

      const paymentRecord = {
        id: paymentId,
        orderId: order.id,
        userId: order.userId,
        amount: order.total,
        method,
        status: isSuccess ? 'SUCCESS' : 'FAILED',
        transactionId: txnId,
        createdAt: new Date().toISOString()
      };

      db.payments.push(paymentRecord);

      const attemptRecord = {
        id: `pa-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
        paymentId,
        orderId: order.id,
        attemptNumber: db.paymentAttempts.filter((pa) => pa.orderId === order.id).length + 1,
        status: paymentRecord.status,
        idempotencyKey,
        gatewayRef: `GW-${Date.now()}`,
        createdAt: new Date().toISOString()
      };

      db.paymentAttempts.push(attemptRecord);

      if (isSuccess) {
        order.status = 'PROCESSING';
        order.updatedAt = new Date().toISOString();
      }

      db.addAuditLog({
        action: isSuccess ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
        userId: order.userId,
        role: 'CUSTOMER',
        details: { orderId: order.id, transactionId: txnId, amount: order.total, method }
      });

      return {
        payment: paymentRecord,
        attempt: attemptRecord,
        isDuplicate: false
      };
    }
  }
};
