import type { Settings } from './types'

/** Fallback values used until the database answers (and for any missing key). The database holds the real values. */
export const defaultSettings = (): Settings => ({
  business: {
    name: 'Rice and Spice',
    tagline: 'Good Food, Great Vibes',
    phone: '0547557772',
    whatsapp: '233547557772',
    location: 'North Legon, Accra, Ghana',
  },
  hero: {
    script: 'Delicious',
    headline: 'Fried Rice',
    subheadline: 'with Grilled Chicken',
    description:
      'Freshly prepared, packed with flavour, and made with love. Pre-order your favourite meal and let Rice and Spice bring the goodness to you.',
    image: '/hero-dish.jpg',
  },
  announcement: { enabled: false, title: 'Pre-Orders Are Open!', body: 'Freshly prepared meals, made just for you.' },
  about:
    'Rice and Spice is an emerging Ghanaian food brand specialising in freshly prepared, flavourful meals. We start with fried rice served with grilled chicken, prepared with care and available through advance pre-orders, and we plan to add more meals over time.',
  faq: [
    { q: 'How does pre-ordering work?', a: 'Choose your meal, pick an available delivery day and time window, and place your order. We prepare it fresh for your chosen day.' },
    { q: 'Is the delivery window a guaranteed arrival time?', a: 'No. It is the window you request. We will do our best to deliver within it and will contact you if anything changes.' },
  ],
  social: { instagram: '', facebook: '', tiktok: '' },
  ordering: {
    open: false,
    minNoticeHours: 12,
    maxHorizonDays: 14,
    cutoffTime: '18:00',
    cutoffDaysBefore: 1,
    deliveryWeekdays: [],
    windows: [],
    dailyCapacity: 0,
    blackoutDates: [],
    holdMinutes: 120,
  },
  services: { delivery: true, pickup: false, deliveryFee: 0, areasNote: '' },
  payments: {
    manual: { enabled: false, instructions: '' },
    cod: { enabled: false },
  },
  policies: { privacy: '', terms: '', refunds: '' },
  whatsappAssisted: true,
  notificationTemplates: {
    accepted: 'Hi {name}, your Rice and Spice order {ref} has been accepted. Delivery: {date}, {window}.',
    preparing: 'Hi {name}, your order {ref} is now being prepared.',
    out_for_delivery: 'Hi {name}, your order {ref} is out for delivery.',
    delivered: 'Hi {name}, your order {ref} has been delivered. Enjoy your meal!',
    cancelled: 'Hi {name}, your order {ref} has been cancelled. Please contact us if you have questions.',
  },
})
