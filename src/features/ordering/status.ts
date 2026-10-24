import type { OrderStatus, PaymentStatus } from '../../data/types'

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  payment_confirmed: 'Payment confirmed',
  awaiting_acceptance: 'Awaiting acceptance',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready for dispatch',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
  payment_failed: 'Payment failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

export const PAYMENT_LABEL: Record<PaymentStatus, string> = {
  unpaid: 'Unpaid (pay on delivery)',
  pending_verification: 'Awaiting verification',
  paid: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
  partially_refunded: 'Partially refunded',
}

/** Formal state machine: anything not listed here is rejected. */
export const TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  awaiting_payment: ['payment_confirmed', 'payment_failed', 'cancelled'],
  payment_confirmed: ['awaiting_acceptance'],
  awaiting_acceptance: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'ready', 'cancelled'],
  delivered: ['refunded', 'partially_refunded'],
  cancelled: ['refunded'],
  rejected: ['refunded'],
  payment_failed: ['awaiting_payment'],
  refunded: [],
  partially_refunded: ['refunded'],
}

export const canTransition = (from: OrderStatus, to: OrderStatus) => TRANSITIONS[from].includes(to)

/** Statuses that hold kitchen/delivery capacity. */
export const CAPACITY_STATUSES: OrderStatus[] = ['awaiting_payment', 'payment_confirmed', 'awaiting_acceptance', 'accepted', 'preparing', 'ready', 'out_for_delivery', 'delivered']

export const TERMINAL: OrderStatus[] = ['delivered', 'cancelled', 'rejected', 'payment_failed', 'refunded']

/** The next forward step staff normally takes, for one-tap buttons. */
export const NEXT_STEP: Partial<Record<OrderStatus, { to: OrderStatus; label: string }>> = {
  awaiting_acceptance: { to: 'accepted', label: 'Accept order' },
  accepted: { to: 'preparing', label: 'Start preparing' },
  preparing: { to: 'ready', label: 'Mark ready' },
  ready: { to: 'out_for_delivery', label: 'Dispatch' },
  out_for_delivery: { to: 'delivered', label: 'Mark delivered' },
}
