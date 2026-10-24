import type { Pesewas } from '../lib/money'

export interface Category { id: string; name: string; sortOrder: number; active: boolean }

export interface MenuOption { id: string; name: string; priceDelta: Pesewas }
export interface OptionGroup {
  id: string
  name: string
  required: boolean
  multiple: boolean
  maxSelect?: number
  options: MenuOption[]
}

export interface MenuItem {
  id: string
  slug: string
  name: string
  description: string
  categoryId: string
  price: Pesewas
  images: string[] // data URLs or URLs; empty => illustrated fallback
  active: boolean
  featured: boolean
  sortOrder: number
  /** Weekdays (0=Sun..6=Sat) this item can be delivered; empty = any enabled delivery day */
  availableWeekdays: number[]
  /** Optional production cap in meals per delivery date */
  dailyLimit?: number
  allergens: string
  dietary: string
  optionGroups: OptionGroup[]
  createdAt: string
  updatedAt: string
}

export interface DeliveryWindow { id: string; label: string; start: string; end: string; capacity: number }

export interface DeliveryZone {
  id: string
  name: string
  neighbourhoods: string // comma separated, shown to customers
  fee: Pesewas
  minOrder: Pesewas
  active: boolean
}

export type CouponType = 'percent' | 'fixed' | 'free_delivery'
export interface Coupon {
  id: string
  code: string
  type: CouponType
  value: number // percent (0-100) or pesewas
  minSubtotal: Pesewas
  active: boolean
  expiresAt?: string // YYYY-MM-DD
  usageLimit?: number
  firstOrderOnly: boolean
  itemIds: string[] // empty = whole basket
}

export type OrderStatus =
  | 'awaiting_payment' | 'payment_confirmed' | 'awaiting_acceptance' | 'accepted' | 'preparing'
  | 'ready' | 'out_for_delivery' | 'delivered'
  | 'cancelled' | 'rejected' | 'payment_failed' | 'refunded' | 'partially_refunded'

export type PaymentMethod = 'manual' | 'cod' | 'momo' | 'card'
export type PaymentStatus = 'unpaid' | 'pending_verification' | 'paid' | 'failed' | 'refunded' | 'partially_refunded'

export interface OrderLineOption { groupName: string; name: string; priceDelta: Pesewas }
export interface OrderLine {
  itemId: string
  name: string // snapshot
  unitPrice: Pesewas // base + options, snapshot
  quantity: number
  options: OrderLineOption[]
  note: string
  lineTotal: Pesewas
}

export interface StatusEvent { at: string; status: OrderStatus; note?: string; by: string }
export interface Refund { at: string; amount: Pesewas; reason: string; by: string }

export interface Order {
  id: string
  reference: string // RNS-YYYYMMDD-0001
  trackingToken: string
  createdAt: string
  status: OrderStatus
  paymentStatus: PaymentStatus
  paymentMethod: PaymentMethod
  holdExpiresAt?: string
  lines: OrderLine[]
  subtotal: Pesewas
  deliveryFee: Pesewas
  discount: Pesewas
  total: Pesewas
  couponCode?: string
  customer: { name: string; phone: string; email: string }
  delivery: {
    zoneId: string
    zoneName: string
    address: string
    landmark: string
    instructions: string
    date: string // YYYY-MM-DD, Africa/Accra
    windowId: string
    windowLabel: string
  }
  notes: string
  internalNotes: string[]
  refunds: Refund[]
  refundDue: boolean
  rider?: { name: string; phone: string }
  events: StatusEvent[]
  consentWhatsApp: boolean
}

export interface OrderingConfig {
  open: boolean // master switch; false = pre-orders paused/unpublished
  minNoticeHours: number
  maxHorizonDays: number
  cutoffTime: string // HH:MM
  cutoffDaysBefore: number // 1 = day before delivery
  deliveryWeekdays: number[]
  windows: DeliveryWindow[]
  dailyCapacity: number // optional overall meals/day across windows; 0 = no daily limit (window limits still apply)
  blackoutDates: string[]
  holdMinutes: number
}

export interface Settings {
  business: { name: string; tagline: string; phone: string; whatsapp: string; location: string }
  hero: { script: string; headline: string; subheadline: string; description: string; image: string }
  announcement: { enabled: boolean; title: string; body: string }
  about: string
  faq: { q: string; a: string }[]
  social: { instagram: string; facebook: string; tiktok: string }
  ordering: OrderingConfig
  /** deliveryFee: flat fee in pesewas. areasNote: optional text telling customers where you deliver. */
  services: { delivery: boolean; pickup: boolean; deliveryFee: number; areasNote: string }
  payments: {
    manual: { enabled: boolean; instructions: string }
    cod: { enabled: boolean }
  }
  policies: { privacy: string; terms: string; refunds: string }
  whatsappAssisted: boolean
  notificationTemplates: Record<string, string>
}

export interface AuditEntry { at: string; by: string; action: string; detail: string }

export interface CapacityRow { date: string; windowId: string; meals: number }

/** In-memory snapshot of what the signed-in user is allowed to see. */
export interface DB {
  settings: Settings
  categories: Category[]
  items: MenuItem[]
  zones: DeliveryZone[]
  /** Staff only (empty for customers) */
  coupons: Coupon[]
  orders: Order[]
  audit: AuditEntry[]
  /** Public: meals already booked per date/window, and per-item booked meals by date */
  capacity: CapacityRow[]
  itemLoads: Record<string, Record<string, number>>
}
